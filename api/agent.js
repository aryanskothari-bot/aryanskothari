// Vercel serverless function: free live-data backend for the Deal Sourcing Agent and MediBridge.
// Web search: Tavily (free 1,000 searches/month). Model: Groq (free tier).
// Set GROQ_API_KEY and TAVILY_API_KEY in Vercel > Project > Settings > Environment Variables.

const MODEL = "openai/gpt-oss-120b";
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

async function tavily(query) {
  if (!TAVILY_KEY || !query) return [];
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer " + TAVILY_KEY },
    body: JSON.stringify({ query, max_results: 5, search_depth: "basic" }),
  });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.results || []).map((x) => ({ title: x.title, url: x.url, snippet: String(x.content || "").slice(0, 380) }));
}

async function groq(prompt) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer " + GROQ_KEY },
    body: JSON.stringify({
      model: MODEL, temperature: 0.3, max_tokens: 3500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You reply with ONE valid JSON object only. No markdown fences, no commentary." },
        { role: "user", content: prompt },
      ],
    }),
  });
  const d = await r.json();
  if (!r.ok) { const e = new Error((d.error && d.error.message) || "Model error"); e.status = r.status; throw e; }
  const c = d.choices && d.choices[0];
  return { text: (c && c.message && c.message.content) || "", truncated: !!c && c.finish_reason === "length" };
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
  if (recent.length >= 6) return res.status(429).json({ error: "Too many requests. Wait a minute." });
  recent.push(now); hits.set(ip, recent);

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const prompt = String(body.prompt || "").slice(0, 6000);
  const query = String(body.query || "").slice(0, 200);
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const key = query + "||" + prompt;
  const hit = cache.get(key);
  if (hit && now - hit.t < CACHE_MS) return res.status(200).json({ ...hit.v, cached: true });

  try {
    const sources = await tavily(query);
    let full = prompt;
    if (sources.length) {
      full += "\n\nLIVE WEB RESULTS (use them for current facts and prices; trust them over memory; do not invent facts they do not support):\n" +
        sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.snippet}`).join("\n");
    }
    let out = await groq(full);
    if (!/\{[\s\S]*\}/.test(out.text) || out.truncated) out = await groq(full);
    const v = { text: out.text, truncated: out.truncated, sources: sources.map((s) => ({ title: s.title, url: s.url })) };
    if (!out.truncated) cache.set(key, { t: now, v });
    return res.status(200).json(v);
  } catch (e) {
    const busy = e.status === 429;
    return res.status(busy ? 429 : 502).json({ error: busy ? "The free AI quota is busy. Try again in a minute." : "Upstream error: " + e.message });
  }
}
