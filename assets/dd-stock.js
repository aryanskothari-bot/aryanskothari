/* Stock due diligence desk: market data -> quant desk -> research desk -> scenarios & desk view */
(function () {
  const { ask, quote, esc, safeUrl, store, toast, download, copy } = App;
  const $ = (id) => document.getElementById(id);
  const ST = [["data", "Market data", "📡"], ["quant", "Quant desk", "📐"], ["research", "Research desk", "🔎"], ["desk", "Trading desk & scenarios", "🎲"]];
  let S = null, busy = false;
  DD.board("kBoard", ST, -1, 0);

  $("kForm").onsubmit = (e) => { e.preventDefault(); run(); };
  document.querySelectorAll("[data-kx]").forEach((b) => (b.onclick = () => { $("kSym").value = b.dataset.kx; run(); }));

  /* ---------- quant maths ---------- */
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
  const pct = (a, p) => { const s = Float64Array.from(a).sort(); const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo); };
  const sma = (c, n) => (c.length >= n ? mean(c.slice(-n)) : null);
  function rsi(c, n = 14) { let g = 0, l = 0; for (let i = c.length - n; i < c.length; i++) { const d = c[i] - c[i - 1]; d > 0 ? (g += d) : (l -= d); } return l === 0 ? 100 : 100 - 100 / (1 + g / l); }
  function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

  function quant(q) {
    const pts = q.pts.filter((p) => p[1] > 0), c = pts.map((p) => p[1]), n = c.length, last = c[n - 1];
    const ret = (k) => (n > k ? last / c[n - 1 - k] - 1 : null);
    const lr = []; for (let i = 1; i < n; i++) lr.push(Math.log(c[i] / c[i - 1]));
    const y1 = lr.slice(-252), vol = sd(y1) * Math.sqrt(252), annMean = mean(y1) * 252;
    let peak = -Infinity, mdd = 0; c.slice(-252).forEach((v) => { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); });
    // beta / correlation vs benchmark on matching days
    let beta = null, corr = null;
    if (q.bench && q.bench.pts && q.bench.pts.length > 60) {
      const day = (t) => new Date(t).toISOString().slice(0, 10), bm = new Map(q.bench.pts.map((p) => [day(p[0]), p[1]]));
      const a = [], b = []; for (let i = Math.max(1, n - 252); i < n; i++) { const d0 = bm.get(day(pts[i - 1][0])), d1 = bm.get(day(pts[i][0])); if (d0 && d1) { a.push(Math.log(c[i] / c[i - 1])); b.push(Math.log(d1 / d0)); } }
      if (a.length > 40) { const ma = mean(a), mb = mean(b); let cov = 0, vb = 0, va = 0; a.forEach((x, i) => { cov += (x - ma) * (b[i] - mb); vb += (b[i] - mb) ** 2; va += (x - ma) ** 2; }); beta = cov / vb; corr = cov / Math.sqrt(va * vb); }
    }
    const vols = pts.slice(-63).map((p) => p[1] * (p[2] || 0)), adv = mean(vols);
    const s50 = sma(c, 50), s200 = sma(c, 200);
    // Monte Carlo: bootstrap demeaned daily returns, drift blended halfway between history (capped) and a 7% long-run equity return
    const drift = (0.5 * Math.max(-0.3, Math.min(0.4, annMean)) + 0.5 * 0.07) / 252, base = mean(y1), H = 126, N = 3000, rand = rng(12345);
    const finals = new Float64Array(N), bands = Array.from({ length: H + 1 }, () => new Float64Array(N));
    for (let k = 0; k < N; k++) { let x = 0; bands[0][k] = last; for (let t = 1; t <= H; t++) { x += y1[Math.floor(rand() * y1.length)] - base + drift; bands[t][k] = last * Math.exp(x); } finals[k] = bands[H][k] / last - 1; }
    const cone = bands.map((b) => [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => pct(b, p)));
    const fin = Array.from(finals);
    return {
      last, n, vol, annMean, mdd, beta, corr, adv, s50, s200, rsi: rsi(c), mom: n > 252 ? c[n - 22] / c[n - 253] - 1 : null,
      r1m: ret(21), r3m: ret(63), r6m: ret(126), r1y: ret(252), sharpe: vol ? (annMean - 0.03) / vol : null,
      var95: -pct(y1, 0.05), worst: Math.min(...y1), hi52: Math.max(...c.slice(-252)), lo52: Math.min(...c.slice(-252)),
      mc: { cone, finals: fin, pUp: fin.filter((x) => x > 0).length / N, p10: fin.filter((x) => x > 0.1).length / N, m10: fin.filter((x) => x < -0.1).length / N, med: pct(fin, 0.5), mean: mean(fin), q5: pct(fin, 0.05), q95: pct(fin, 0.95) },
      hist: pts.slice(-252), c,
    };
  }

  /* ---------- run ---------- */
  async function run() {
    if (busy) return;
    const input = $("kSym").value.trim(); if (!input) { $("kSym").focus(); toast("Type a ticker first"); return; }
    busy = true; $("kRun").disabled = true; $("kMsg").innerHTML = ""; $("kLog").innerHTML = "";
    S = { input, sources: [] };
    $("kOut").innerHTML = '<div class="card pad"><div class="sk" style="height:120px"></div><div class="sk" style="height:320px;margin-top:14px"></div></div>';
    document.getElementById("k-app").scrollIntoView({ behavior: "smooth" });
    DD.pulse("stock");
    try {
      DD.board("kBoard", ST, 0, 0); DD.logTo("kLog", `Market data: fetching two years of daily prices for ${input}`);
      S.q = await quote(input);
      DD.logTo("kLog", `Market data: ${S.q.name} (${S.q.symbol}), ${S.q.pts.length} sessions from ${S.q.source}; benchmark ${S.q.bench.symbol}`);
      DD.board("kBoard", ST, 1, 1); DD.logTo("kLog", "Quant desk: volatility, beta, momentum, drawdown and 3,000 simulated six-month paths");
      await new Promise((r) => setTimeout(r, 30));
      S.k = quant(S.q); render();
      DD.logTo("kLog", `Quant desk: ${(S.k.mc.pUp * 100).toFixed(0)}% of simulated paths finish higher in six months`);
      DD.board("kBoard", ST, 2, 2); DD.logTo("kLog", "Research desk: reading results, guidance, analyst views and upcoming catalysts");
      const k = S.k, cur = S.q.currency || "";
      const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), lo5 = k.last * (1 + k.mc.q5), hi95 = k.last * (1 + k.mc.q95);
      const r = await ask(`Today is ${today}. You are the equity research and trading desk of an investment firm doing due diligence on ${S.q.name} (${S.q.symbol}, ${S.q.exchange}). Today's price: ${k.last.toFixed(2)} ${cur}. Quant facts: 1y return ${(k.r1y * 100).toFixed(1)}%, annualised volatility ${(k.vol * 100).toFixed(0)}%, beta ${k.beta == null ? "n/a" : k.beta.toFixed(2)} vs ${S.q.bench.symbol}, max drawdown 1y ${(k.mdd * 100).toFixed(0)}%, RSI ${k.rsi.toFixed(0)}, price vs 200-day average ${k.s200 ? ((k.last / k.s200 - 1) * 100).toFixed(0) + "%" : "n/a"}. Monte Carlo six-month range: 5th pct ${(k.mc.q5 * 100).toFixed(0)}%, median ${(k.mc.med * 100).toFixed(0)}%, 95th pct ${(k.mc.q95 * 100).toFixed(0)}%.
Think like a disciplined trading desk: expected value over scenarios, implied versus realised volatility, positioning, catalysts with dates, and what would prove the view wrong. Use the live web results for facts; mark estimates with "est.". Never give buy/sell advice; describe the setup.
Return ONLY JSON: {"company":{"sector":"","summary":"max 35 words"},"fundamentals":{"score":0-100,"sub":{"growth":0-100,"profitability":0-100,"balance_sheet":0-100,"valuation":0-100,"moat":0-100,"management":0-100},"metrics":{"pe":"","ev_ebitda":"","revenue_growth":"","net_margin":"","net_debt_ebitda":"","dividend_yield":""},"highlights":["4 bullets, max 18 words"]},"consensus":"analyst consensus and average target, max 18 words","catalysts":[{"when":"month year or date","event":"max 12 words"}] (4-5 events dated AFTER ${today} and within the next six months; use the live results for actual scheduled dates),"risks":["4 bullets, max 16 words"],"scenarios":{"bull":{"prob":0-1,"target":number,"thesis":"max 20 words"},"base":{"prob":0-1,"target":number,"thesis":"max 20 words"},"bear":{"prob":0-1,"target":number,"thesis":"max 20 words"}} (six-month price targets in ${cur || "the stock's currency"}; probabilities sum to 1; the bear target MUST be below today's price and the bull target above it; keep targets inside the simulated six-month price range ${lo5.toFixed(1)} to ${hi95.toFixed(1)} unless a specific dated catalyst justifies more),"desk":{"implied_vs_realised":"max 24 words","positioning":"max 24 words","edge":"where the market could be mispricing it, max 26 words","wrong_if":"what would make this view wrong, max 22 words","sizing":"risk-based sizing note given the volatility, max 24 words, no buy/sell call"}}`, `${S.q.name} ${S.q.symbol} earnings guidance analyst price target outlook`);
      S.r = r.data; clean(S.r, k.last); S.sources = r.sources.filter((s) => safeUrl(s.url));
      DD.board("kBoard", ST, 3, 3); DD.logTo("kLog", "Trading desk: combining quant and research into a six-month view");
      score(); render();
      DD.board("kBoard", ST, -1, 4); DD.logTo("kLog", `Done. Desk view: ${S.view.label}`);
      const h = store.get("ks_hist", []).filter((x) => x !== S.q.symbol); h.unshift(S.q.symbol); store.set("ks_hist", h.slice(0, 6));
    } catch (e) {
      DD.board("kBoard", ST, -1, S.k ? 2 : S.q ? 1 : 0);
      DD.errTo("kMsg", e.message || "Something went wrong.", run);
      if (!S.k) $("kOut").innerHTML = ""; else render();
    }
    busy = false; $("kRun").disabled = false; DD.pulse("done");
  }

  function clean(r, price) {
    const now = Date.now();
    r.catalysts = (r.catalysts || []).filter((c) => { const t = Date.parse("1 " + c.when) || Date.parse(c.when); return !t || t > now - 20 * 864e5; });
    const sc = r.scenarios;
    if (sc && sc.bull && sc.base && sc.bear) {
      const t = ["bear", "base", "bull"].map((x) => +sc[x].target).sort((a, b) => a - b);
      sc.bear.target = t[0]; sc.base.target = t[1]; sc.bull.target = t[2];
      if (sc.bear.target >= price) r.bearNote = "The research desk saw no downside target below today's price; treat the bear case with caution.";
    }
  }
  function score() {
    const k = S.k, f = (S.r && S.r.fundamentals) || {}, sc = S.r && S.r.scenarios;
    const clamp = (v) => Math.max(0, Math.min(100, v));
    const momS = clamp(50 + (k.mom ?? k.r6m ?? 0) * 150), trendS = clamp((k.s200 ? (k.last > k.s200 ? 65 : 35) : 50) + (k.s50 && k.s200 ? (k.s50 > k.s200 ? 15 : -15) : 0)), riskS = clamp(100 - ((k.vol - 0.15) / 0.6) * 100);
    const fund = +f.score || 50;
    const total = 0.45 * fund + 0.25 * momS + 0.15 * trendS + 0.15 * riskS;
    let er = null;
    if (sc && sc.bull && sc.base && sc.bear) { const ps = ["bull", "base", "bear"].map((x) => +sc[x].prob || 0), s = ps.reduce((a, b) => a + b, 0) || 1; er = ["bull", "base", "bear"].reduce((a, x, i) => a + (ps[i] / s) * (+sc[x].target / k.last - 1), 0); }
    const blended = er == null ? k.mc.mean : 0.5 * er + 0.5 * k.mc.mean;
    S.view = { total, fund, momS, trendS, riskS, er, blended, label: total >= 65 ? "Favourable setup" : total >= 45 ? "Balanced setup" : "Cautious setup", rag: total >= 65 ? "green" : total >= 45 ? "amber" : "red" };
  }

  /* ---------- render ---------- */
  const P = (v, d = 0) => (v == null || isNaN(v) ? "n/a" : (v > 0 ? "+" : "") + (v * 100).toFixed(d) + "%");
  const cls = (v) => (v == null ? "" : v >= 0 ? "up" : "dn");
  const px = (v) => (v == null ? "n/a" : (+v).toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 2 : 1 }));
  const L = (a) => (a && a.length ? "<ul>" + a.map((i) => `<li>${esc(i)}</li>`).join("") + "</ul>" : "");

  function render() {
    const q = S.q, k = S.k; if (!k) return;
    const r = S.r || {}, v = S.view, cur = q.currency || "";
    let h = `<div class="verdict rv in">${DD.gauge(v ? v.total : k.mc.pUp * 100, v ? "DESK SCORE" : "P(UP) %")}<div><p class="eyebrow">${esc(q.exchange || "")} · ${esc(q.symbol)} · ${esc(cur)} ${px(k.last)}</p><h2>${esc(q.name)}</h2><p>${v ? `Six-month expected move ${P(v.blended, 1)} (research ${P(v.er, 1)}, simulation ${P(k.mc.mean, 1)}). ${(k.mc.pUp * 100).toFixed(0)}% of simulated paths end higher.` : esc((r.company || {}).summary || "Quant desk results are in. Research desk working…")}</p></div>${v ? `<span class="vtag ${v.rag}">${v.label}</span>` : ""}</div>`;
    h += `<div class="kpis">
      <div class="kpi"><small>1 month</small><b class="${cls(k.r1m)}">${P(k.r1m, 1)}</b><em>3m ${P(k.r3m)}</em></div>
      <div class="kpi"><small>1 year</small><b class="${cls(k.r1y)}">${P(k.r1y, 1)}</b><em>52w ${px(k.lo52)}–${px(k.hi52)}</em></div>
      <div class="kpi"><small>Volatility</small><b>${(k.vol * 100).toFixed(0)}%</b><em>annualised</em></div>
      <div class="kpi"><small>Beta</small><b>${k.beta == null ? "n/a" : k.beta.toFixed(2)}</b><em>vs ${esc(q.bench.symbol)}${k.corr != null ? " · ρ " + k.corr.toFixed(2) : ""}</em></div>
      <div class="kpi"><small>Max drawdown</small><b class="dn">${P(k.mdd)}</b><em>last 12 months</em></div>
      <div class="kpi"><small>Momentum 12-1</small><b class="${cls(k.mom)}">${P(k.mom)}</b><em>RSI ${k.rsi.toFixed(0)}</em></div>
      <div class="kpi"><small>Trend</small><b>${k.s200 ? (k.last > k.s200 ? "Above" : "Below") : "n/a"}</b><em>200-day avg ${px(k.s200)}</em></div>
      <div class="kpi"><small>Sharpe (1y)</small><b>${k.sharpe == null ? "n/a" : k.sharpe.toFixed(2)}</b><em>vs 3% cash</em></div>
      <div class="kpi"><small>1-day VaR 95%</small><b>${(k.var95 * 100).toFixed(1)}%</b><em>worst day ${(k.worst * 100).toFixed(1)}%</em></div>
      <div class="kpi"><small>Liquidity</small><b>${k.adv ? (k.adv >= 1e9 ? (k.adv / 1e9).toFixed(1) + "bn" : (k.adv / 1e6).toFixed(0) + "m") : "n/a"}</b><em>avg traded value/day</em></div>
      <div class="kpi"><small>P(up 6m)</small><b>${(k.mc.pUp * 100).toFixed(0)}%</b><em>simulated</em></div>
      <div class="kpi"><small>P(±10%)</small><b><span class="up">${(k.mc.p10 * 100).toFixed(0)}%</span> / <span class="dn">${(k.mc.m10 * 100).toFixed(0)}%</span></b><em>above +10 / below −10</em></div></div>`;
    h += `<div class="card pad" style="margin-top:16px"><div class="bar"><div><p class="eyebrow">Price history → six-month simulation</p><h3 style="font-size:20px;margin-top:4px">Where ${esc(q.symbol)} could be by ${new Date(Date.now() + 182 * 864e5).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</h3></div></div><div class="chart"><canvas id="kChart"></canvas></div>
      <div class="legend2"><span><i style="background:#1d1a4f"></i>Price</span><span><i style="background:#e8b44a"></i>50-day</span><span><i style="background:#ff7a59"></i>200-day</span><span><i style="background:rgba(91,76,240,.35)"></i>90% / 50% simulated range</span><span><i style="background:#5b4cf0"></i>Median path</span>${r.scenarios ? '<span><i style="background:#2fbf8f"></i>Bull · base · bear targets</span>' : ""}</div></div>`;
    h += `<div class="two"><div class="card pad"><p class="eyebrow">Simulated six-month returns</p><h3 style="font-size:20px;margin:4px 0">Distribution of 3,000 paths</h3><div class="chart" style="height:220px"><canvas id="kHist"></canvas></div><p class="note">Resamples the last year of daily moves, with the drift set halfway between the stock's own trend and a 7% long-run equity return. Past moves do not predict future ones.</p></div>`;
    if (v && r.fundamentals) { const s = r.fundamentals.sub || {}, mt = r.fundamentals.metrics || {};
      h += `<div class="card pad"><p class="eyebrow">Research desk · Fundamentals</p><h3 style="font-size:20px;margin:4px 0">Quality score ${Math.round(v.fund)}/100</h3><div class="sub">${["growth", "profitability", "balance_sheet", "valuation", "moat", "management"].map((x) => `<div><span>${x.replace("_", " ").replace(/^./, (c) => c.toUpperCase())}</span><div class="b"><i style="width:${+s[x] || 0}%"></i></div><span>${+s[x] || "–"}</span></div>`).join("")}</div>
      <div class="kv" style="grid-template-columns:repeat(3,minmax(0,1fr))">${[["P/E", mt.pe], ["EV/EBITDA", mt.ev_ebitda], ["Revenue growth", mt.revenue_growth], ["Net margin", mt.net_margin], ["Net debt/EBITDA", mt.net_debt_ebitda], ["Dividend yield", mt.dividend_yield]].map((x) => `<div><small>${x[0]}</small><b>${esc(x[1] || "n/a")}</b></div>`).join("")}</div></div>`; }
    else h += `<div class="card pad"><p class="eyebrow">Research desk</p><div class="sk" style="height:200px;margin-top:10px"></div></div>`;
    h += `</div>`;
    if (v && r.scenarios) {
      const sc = r.scenarios, ps = ["bull", "base", "bear"].map((x) => +sc[x].prob || 0), tot = ps.reduce((a, b) => a + b, 0) || 1;
      h += `<div class="card pad" style="margin-top:16px"><p class="eyebrow">Six-month scenarios · expected value</p><h3 style="font-size:20px;margin:4px 0">Probability-weighted move ${P(v.er, 1)}</h3><div class="probs">${["bull", "base", "bear"].map((x, i) => `<i style="width:${(ps[i] / tot) * 100}%;background:${["#2fbf8f", "#5b4cf0", "#ff7a59"][i]}"></i>`).join("")}</div>
      ${r.bearNote ? `<p class="note">${esc(r.bearNote)}</p>` : ""}<div class="scen">${["bull", "base", "bear"].map((x, i) => `<div class="scn ${x}"><h4><span>${x[0].toUpperCase() + x.slice(1)} case</span><span class="mono">${Math.round((ps[i] / tot) * 100)}%</span></h4><div class="tp">${esc(cur)} ${px(sc[x].target)}</div><b class="${cls(sc[x].target / k.last - 1)}">${P(sc[x].target / k.last - 1, 1)}</b><p>${esc(sc[x].thesis)}</p></div>`).join("")}</div></div>`;
      const d = r.desk || {};
      h += `<div class="two"><div class="card pad"><p class="eyebrow">Trading desk view</p><h3 style="font-size:20px;margin:4px 0 8px">How a trading desk would frame it</h3><div class="k">Volatility</div>${esc(d.implied_vs_realised)}<div class="k">Positioning & consensus</div>${esc(d.positioning)} ${esc(r.consensus || "")}<div class="k">Possible edge</div>${esc(d.edge)}<div class="k">What would make us wrong</div>${esc(d.wrong_if)}<div class="k">Risk sizing</div>${esc(d.sizing)}<p class="note">Built on public trading principles (expected value, volatility-based sizing, implied vs realised). Not any firm's proprietary model, and not investment advice.</p></div>
      <div class="card pad"><p class="eyebrow">Next six months</p><h3 style="font-size:20px;margin:4px 0 8px">Catalyst calendar</h3><ul class="cal">${(r.catalysts || []).map((c) => `<li><b>${esc(c.when)}</b><span>${esc(c.event)}</span></li>`).join("")}</ul><div class="k" style="margin-top:16px">Key risks</div>${L(r.risks)}<div class="k">Highlights</div>${L((r.fundamentals || {}).highlights)}</div></div>`;
      h += `<div class="card pad" style="margin-top:16px"><div class="bar"><div><p class="eyebrow">Report</p><h3 style="font-size:18px;margin-top:4px">Stock due-diligence report · ${esc(q.symbol)}</h3></div><span class="sp"></span><button class="btn sm" id="kCp">Copy</button><button class="btn sm" id="kDl">Download .md</button></div>${S.sources.length ? `<div class="srcs" style="columns:2 280px;column-gap:24px">${S.sources.map((s) => `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(String(s.title).slice(0, 80))}</a>`).join("")}</div>` : ""}<p class="note">Prices: ${esc(q.source)}. Simulations use past prices; research is AI-generated from public sources. Not investment advice.</p></div>`;
    }
    $("kOut").innerHTML = h;
    requestAnimationFrame(() => { drawMain(); drawHist(); });
  }

  /* ---------- charts ---------- */
  function setup(id) { const c = $(id); if (!c) return null; const r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); c.width = r.width * d; c.height = r.height * d; const x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0); return { x, w: r.width, h: r.height }; }
  function drawMain() {
    const g = setup("kChart"); if (!g) return; const { x, w, h } = g, k = S.k, hist = k.hist.map((p) => p[1]), cone = k.mc.cone, sc = S.r && S.r.scenarios;
    const N = hist.length, H = cone.length - 1, total = N + H, padL = 8, padR = 56, padT = 14, padB = 24;
    let lo = Math.min(...hist, ...cone.map((c) => c[0])), hi = Math.max(...hist, ...cone.map((c) => c[4]));
    if (sc) ["bull", "base", "bear"].forEach((s) => { const t = +sc[s].target; if (t > 0) { lo = Math.min(lo, t); hi = Math.max(hi, t); } });
    const span = hi - lo; lo -= span * 0.06; hi += span * 0.06;
    const X = (i) => padL + (i / (total - 1)) * (w - padL - padR), Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches, t0 = performance.now();
    const ma = (n) => hist.map((_, i) => { const all = k.c, off = all.length - N + i; return off >= n ? mean(all.slice(off - n + 1, off + 1)) : null; });
    const m50 = ma(50), m200 = ma(200);
    function frame(now) {
      const p = still ? 1 : Math.min(1, (now - t0) / 1400), ease = 1 - Math.pow(1 - p, 3);
      x.clearRect(0, 0, w, h);
      x.strokeStyle = "rgba(27,24,70,.07)"; x.lineWidth = 1; x.fillStyle = "#77749a"; x.font = "10px JetBrains Mono";
      for (let i = 0; i <= 4; i++) { const v = lo + (i / 4) * (hi - lo), y = Y(v); x.beginPath(); x.moveTo(padL, y); x.lineTo(w - padR, y); x.stroke(); x.fillText(px(v), w - padR + 6, y + 3); }
      x.setLineDash([4, 4]); x.strokeStyle = "rgba(27,24,70,.25)"; x.beginPath(); x.moveTo(X(N - 1), padT); x.lineTo(X(N - 1), h - padB); x.stroke(); x.setLineDash([]);
      x.fillText("today", X(N - 1) - 14, h - 8); x.fillText("+6m", X(total - 1) - 20, h - 8);
      const upto = Math.floor(ease * (total - 1));
      const line = (arr, col, lw, off = 0) => { x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); let s = false; arr.forEach((v, i) => { if (v == null || i + off > upto) return; s ? x.lineTo(X(i + off), Y(v)) : (x.moveTo(X(i + off), Y(v)), (s = true)); }); x.stroke(); };
      line(m200, "rgba(255,122,89,.85)", 1.5); line(m50, "rgba(232,180,74,.95)", 1.5); line(hist, "#1d1a4f", 2.2);
      if (upto > N - 1) {
        const lim = Math.min(H, upto - (N - 1));
        const band = (a, b, col) => { x.fillStyle = col; x.beginPath(); for (let t = 0; t <= lim; t++) x.lineTo(X(N - 1 + t), Y(cone[t][a])); for (let t = lim; t >= 0; t--) x.lineTo(X(N - 1 + t), Y(cone[t][b])); x.closePath(); x.fill(); };
        band(0, 4, "rgba(91,76,240,.13)"); band(1, 3, "rgba(91,76,240,.22)");
        line(cone.slice(0, lim + 1).map((c) => c[2]), "#5b4cf0", 2, N - 1);
        if (lim === H) {
          x.fillStyle = "#4a4770"; x.font = "10px JetBrains Mono";
          [[4, "95%"], [2, "median"], [0, "5%"]].forEach(([j, l]) => x.fillText(l, X(total - 1) - 42, Y(cone[H][j]) - 4));
          if (sc) ["bull", "base", "bear"].forEach((s, i) => { const t = +sc[s].target; if (!(t > 0)) return; const y = Y(t), xx = X(total - 1); x.fillStyle = ["#2fbf8f", "#5b4cf0", "#ff7a59"][i]; x.beginPath(); x.arc(xx, y, 6, 0, 7); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = 2; x.stroke(); });
        }
      }
      x.fillStyle = "#1d1a4f"; x.beginPath(); x.arc(X(Math.min(N - 1, upto)), Y(hist[Math.min(N - 1, upto)]), 4, 0, 7); x.fill();
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function drawHist() {
    const g = setup("kHist"); if (!g) return; const { x, w, h } = g, f = S.k.mc.finals;
    const lo = pct(f, 0.01), hi = pct(f, 0.99), B = 36, bins = new Array(B).fill(0);
    f.forEach((v) => { const i = Math.floor(((v - lo) / (hi - lo)) * B); if (i >= 0 && i < B) bins[i]++; });
    const mx = Math.max(...bins), bw = (w - 20) / B, zero = 10 + ((0 - lo) / (hi - lo)) * (w - 20);
    bins.forEach((c, i) => { const mid = lo + ((i + 0.5) / B) * (hi - lo), bh = (c / mx) * (h - 34); x.fillStyle = mid >= 0 ? "rgba(47,191,143,.75)" : "rgba(255,122,89,.75)"; x.beginPath(); x.roundRect ? x.roundRect(10 + i * bw + 1, h - 20 - bh, bw - 2, bh, 3) : x.rect(10 + i * bw + 1, h - 20 - bh, bw - 2, bh); x.fill(); });
    x.strokeStyle = "#1d1a4f"; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(zero, 6); x.lineTo(zero, h - 20); x.stroke(); x.setLineDash([]);
    x.fillStyle = "#77749a"; x.font = "10px JetBrains Mono"; x.fillText(P(lo), 10, h - 6); x.fillText("0%", zero - 8, h - 6); x.fillText(P(hi), w - 44, h - 6);
  }
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (S && S.k && !$("d-stock").hidden) { drawMain(); drawHist(); } }, 200); });
  window.addEventListener("dd:tab", (e) => { if (e.detail === "stock" && S && S.k) setTimeout(() => { drawMain(); drawHist(); }, 50); });

  function report() {
    const q = S.q, k = S.k, r = S.r || {}, v = S.view, sc = r.scenarios || {};
    const Lm = (a) => (a || []).map((i) => "- " + i).join("\n");
    return `# Stock due diligence: ${q.name} (${q.symbol})\n\nPrice ${px(k.last)} ${q.currency} · Desk view: ${v.label} (${Math.round(v.total)}/100)\n\n## Six-month view\n- Probability-weighted research move: ${P(v.er, 1)}\n- Simulation: median ${P(k.mc.med, 1)}, 90% range ${P(k.mc.q5)} to ${P(k.mc.q95)}, P(up) ${(k.mc.pUp * 100).toFixed(0)}%\n${["bull", "base", "bear"].map((x) => sc[x] ? `- ${x}: ${px(sc[x].target)} (${Math.round(sc[x].prob * 100)}%) ${sc[x].thesis}` : "").join("\n")}\n\n## Quant\n- Volatility ${(k.vol * 100).toFixed(0)}%, beta ${k.beta == null ? "n/a" : k.beta.toFixed(2)}, max drawdown ${P(k.mdd)}, momentum 12-1 ${P(k.mom)}, RSI ${k.rsi.toFixed(0)}\n\n## Fundamentals (${Math.round(v.fund)}/100)\n${Lm((r.fundamentals || {}).highlights)}\n\n## Catalysts\n${(r.catalysts || []).map((c) => `- ${c.when}: ${c.event}`).join("\n")}\n\n## Risks\n${Lm(r.risks)}\n\n## Trading desk\n- Volatility: ${(r.desk || {}).implied_vs_realised}\n- Positioning: ${(r.desk || {}).positioning}\n- Edge: ${(r.desk || {}).edge}\n- Wrong if: ${(r.desk || {}).wrong_if}\n- Sizing: ${(r.desk || {}).sizing}\n\n---\nDiligence Desk (aryanskothari.vercel.app). Not investment advice.\n`;
  }
  $("kOut").addEventListener("click", (e) => {
    if (e.target.id === "kCp") copy(report(), "Report copied");
    if (e.target.id === "kDl") download(`stock-dd-${S.q.symbol.replace(/\W+/g, "-").toLowerCase()}.md`, report(), "text/markdown");
  });
})();
