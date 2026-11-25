// Vercel serverless function: free live-data backend for the Deal Sourcing Agent and MediBridge.
// Web search: Tavily, then Firecrawl keyless, LangSearch and Wikipedia as free fallbacks. Model: Groq (free tier).
// Set GROQ_API_KEY and TAVILY_API_KEY in Vercel > Project > Settings > Environment Variables.

const MODEL = "openai/gpt-oss-120b";
// Backup models on separate free-tier quotas, used when the main one is rate-limited.
const FALLBACKS = ["llama-3.3-70b-versatile", "qwen/qwen3-32b"];
// Accept the variable names as saved in Vercel.
const GROQ_KEY = process.env.GROQ_API_KEY || process.env.GROQ;
const TAVILY_KEY = process.env.TAVILY_API_KEY || process.env.TAVILY || process.env.travily;
const ALLOWED = [/^https:\/\/aryanskothari-bot\.github\.io$/, /^https:\/\/[a-z0-9-]+\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/];
const CACHE_MS = 12 * 3600 * 1000;
const cache = new Map();
const hits = new Map();

function cors(res, origin) {
  if (ALLOWED.some((r) => r.test(origin))) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

// ---------- web search: free providers tried in order until one returns results ----------
// 1) Tavily (free 1,000/month, key)  2) Firecrawl keyless (free, no key)  3) LangSearch (free, key optional)  4) Wikipedia (free, no key)
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY || process.env.FIRECRAWL || process.env.Firecrawl || process.env.firecrawl;
const LANGSEARCH_KEY = process.env.LANGSEARCH_API_KEY || process.env.LANGSEARCH || process.env.LangSearch || process.env.langsearch;
const cut = (t) => String(t || "").replace(/\s+/g, " ").slice(0, 380);
async function timed(p, ms = 9000) { return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]); }

async function tavily(query) {
  if (!TAVILY_KEY) return [];
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer " + TAVILY_KEY },
    body: JSON.stringify({ query, max_results: 5, search_depth: "basic" }),
  });
  if (r.status === 429 || r.status === 432 || r.status === 433) throw Object.assign(new Error("quota"), { quota: true });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.results || []).map((x) => ({ title: x.title, url: x.url, snippet: cut(x.content) }));
}
async function firecrawlWith(query, key) {
  const r = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { Authorization: "Bearer " + key } : {}) },
    body: JSON.stringify({ query, limit: 5 }),
  });
  if (r.status === 402 || r.status === 429) throw Object.assign(new Error("quota"), { quota: true });
  if (!r.ok) return [];
  const d = await r.json();
  const list = (d.data && (d.data.web || d.data.news)) || (Array.isArray(d.data) ? d.data : []);
  return list.map((x) => ({ title: x.title, url: x.url, snippet: cut(x.description || x.snippet || x.markdown) })).filter((x) => x.url);
}
const firecrawl = (q) => (FIRECRAWL_KEY ? firecrawlWith(q, FIRECRAWL_KEY) : []);
const firecrawlFree = (q) => firecrawlWith(q, null);
async function langsearch(query) {
  if (!LANGSEARCH_KEY) return [];
  const r = await fetch("https://api.langsearch.com/v1/web-search", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer " + LANGSEARCH_KEY },
    body: JSON.stringify({ query, count: 5, freshness: "noLimit" }),
  });
  if (r.status === 429) throw Object.assign(new Error("quota"), { quota: true });
  if (!r.ok) return [];
  const d = await r.json();
  return ((d.data && d.data.webPages && d.data.webPages.value) || []).map((x) => ({ title: x.name, url: x.url, snippet: cut(x.snippet || x.text) }));
}
async function wikipedia(query) {
  const q = query.split(" ").slice(0, 4).join(" ");
  const r = await fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=4&srsearch=" + encodeURIComponent(q), { headers: { "user-agent": "DiligenceDesk/1.0 (aryanskothari.vercel.app)" } });
  if (!r.ok) return [];
  const d = await r.json();
  return ((d.query && d.query.search) || []).map((x) => ({ title: x.title + " (Wikipedia)", url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(x.title.replace(/ /g, "_")), snippet: cut(x.snippet.replace(/<[^>]+>/g, "")) }));
}
// Order = best free quality first. An engine that hits its free quota is skipped for 6 hours, then retried.
const ENGINES = [["Firecrawl", firecrawl], ["Tavily", tavily], ["LangSearch", langsearch], ["Firecrawl keyless", firecrawlFree], ["Wikipedia", wikipedia]];
const resting = new Map();
async function search(query, only) {
  if (!query) return { sources: [], engine: "" };
  for (const [name, fn] of ENGINES) {
    if (only && only !== name) continue;
    if (!only && (resting.get(name) || 0) > Date.now()) continue;
    try { const res = await timed(fn(query)); if (res && res.length) return { sources: res, engine: name }; }
    catch (e) { if (e.quota) resting.set(name, Date.now() + 6 * 3600 * 1000); }
  }
  return { sources: [], engine: "" };
}

// ---------- market data (free, no key): Yahoo Finance chart API, Stooq as fallback ----------
const UA = { "user-agent": "Mozilla/5.0 (compatible; DiligenceDesk/1.0)", accept: "application/json,text/csv,*/*" };
function bench(sym) {
  const s = sym.toUpperCase();
  if (s.endsWith(".PA")) return "^FCHI"; if (s.endsWith(".DE") || s.endsWith(".F")) return "^GDAXI";
  if (s.endsWith(".L")) return "^FTSE"; if (s.endsWith(".NS") || s.endsWith(".BO")) return "^NSEI";
  if (s.endsWith(".AS")) return "^AEX"; if (s.endsWith(".MI")) return "FTSEMIB.MI"; if (s.endsWith(".MC")) return "^IBEX";
  if (s.endsWith(".SW")) return "^SSMI"; if (s.endsWith(".T")) return "^N225"; if (s.endsWith(".HK")) return "^HSI";
  return "^GSPC";
}
async function yahooSearch(q) {
  const r = await fetch("https://query1.finance.yahoo.com/v1/finance/search?quotesCount=6&newsCount=0&q=" + encodeURIComponent(q), { headers: UA });
  if (!r.ok) return null;
  const d = await r.json();
  const hit = (d.quotes || []).find((x) => x.quoteType === "EQUITY") || (d.quotes || [])[0];
  return hit ? { symbol: hit.symbol, name: hit.longname || hit.shortname || hit.symbol, exchange: hit.exchDisp || hit.exchange || "" } : null;
}
async function yahooChart(sym) {
  for (const host of ["query1", "query2"]) {
    const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=2y&interval=1d&includePrePost=false`, { headers: UA });
    if (!r.ok) continue;
    const d = await r.json();
    const x = d.chart && d.chart.result && d.chart.result[0];
    if (!x || !x.timestamp) continue;
    const c = (x.indicators.adjclose && x.indicators.adjclose[0].adjclose) || x.indicators.quote[0].close;
    const v = x.indicators.quote[0].volume || [];
    const pts = x.timestamp.map((t, i) => [t * 1000, c[i], v[i] || 0]).filter((p) => p[1] != null);
    const m = x.meta || {};
    return { pts, currency: m.currency || "", name: m.longName || m.shortName || sym, exchange: m.fullExchangeName || m.exchangeName || "", price: m.regularMarketPrice || pts[pts.length - 1][1], high52: m.fiftyTwoWeekHigh, low52: m.fiftyTwoWeekLow, src: "Yahoo Finance" };
  }
  return null;
}
async function stooq(sym) {
  let s = sym.toLowerCase();
  if (!s.includes(".") && !s.startsWith("^")) s += ".us";
  const r = await fetch("https://stooq.com/q/d/l/?i=d&s=" + encodeURIComponent(s), { headers: UA });
  if (!r.ok) return null;
  const rows = (await r.text()).trim().split("\n").slice(1).map((l) => l.split(","));
  const pts = rows.filter((r) => r.length >= 5 && !isNaN(+r[4])).map((r) => [Date.parse(r[0]), +r[4], +(r[5] || 0)]).slice(-505);
  if (pts.length < 60) return null;
  return { pts, currency: "", name: sym.toUpperCase(), exchange: "", price: pts[pts.length - 1][1], src: "Stooq" };
}
async function series(sym) { return (await yahooChart(sym).catch(() => null)) || (await stooq(sym).catch(() => null)); }
async function quote(input) {
  if (!input) throw new Error("Type a ticker or company name");
  const ck = "q:" + input.toUpperCase();
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.t < 3600 * 1000) return hit.v;
  let sym = input.toUpperCase(), name = "", exch = "";
  let main = /^[\^A-Z0-9.\-=]{1,15}$/.test(sym) ? await series(sym) : null;
  if (!main) {
    const s = await yahooSearch(input).catch(() => null);
    if (s) { sym = s.symbol; name = s.name; exch = s.exchange; main = await series(sym); }
  }
  if (!main) throw new Error("No price data found for " + input + ". Try the exact ticker, e.g. AAPL, MC.PA, SAP.DE, RELIANCE.NS");
  const b = bench(sym);
  const bm = await series(b).catch(() => null);
  const v = { symbol: sym, name: name || main.name, exchange: exch || main.exchange, currency: main.currency, price: main.price, high52: main.high52, low52: main.low52, source: main.src, pts: main.pts, bench: { symbol: b, pts: bm ? bm.pts : [] } };
  cache.set(ck, { t: Date.now(), v });
  return v;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  cors(res, origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (origin && !ALLOWED.some((r) => r.test(origin))) return res.status(403).json({ error: "Forbidden" });
  if (!GROQ_KEY) return res.status(500).json({ error: "The AI key is not set up yet." });

  const ip = (req.headers["x-forwarded-for"] || "x").split(",")[0];
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= 24) return res.status(429).json({ error: "Too many requests. Wait a minute." });
  recent.push(now); hits.set(ip, recent);

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (body.mode === "search") {
    const r = await search(String(body.query || "").slice(0, 200), body.engine);
    return res.status(200).json(r);
  }
  if (body.mode === "quote") {
    try { return res.status(200).json(await quote(String(body.symbol || "").trim().slice(0, 30))); }
    catch (e) { return res.status(404).json({ error: e.message || "No price data found" }); }
  }
  const prompt = String(body.prompt || "").slice(0, 6000);
  const query = String(body.query || "").slice(0, 200);
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const key = query + "||" + prompt;
  const hit = cache.get(key);
  if (hit && now - hit.t < CACHE_MS) return res.status(200).json({ ...hit.v, cached: true });

  try {
    const { sources, engine } = await search(query, body.engine);
    let full = prompt;
    if (sources.length) {
      full += "\n\nLIVE WEB RESULTS (use them for current facts and prices; trust them over memory; do not invent facts they do not support):\n" +
        sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.snippet}`).join("\n");
    }
    let out = await groq(full);
    if (!/\{[\s\S]*\}/.test(out.text) || out.truncated) out = await groq(full);
    const v = { text: out.text, truncated: out.truncated, engine, sources: sources.map((s) => ({ title: s.title, url: s.url })) };
    if (!out.truncated) cache.set(key, { t: now, v });
    return res.status(200).json(v);
  } catch (e) {
    const busy = e.status === 429;
    return res.status(busy ? 429 : 502).json({ error: busy ? "The free AI quota is busy. Try again in a minute." : "Upstream error: " + e.message });
  }
}
