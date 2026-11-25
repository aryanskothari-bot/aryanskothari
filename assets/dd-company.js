/* Company due diligence desk: 12 department agents + investment committee */
(function () {
  const { ask, esc, safeUrl, store, toast, download, copy } = App;
  const $ = (id) => document.getElementById(id);
  const D = DD.DEPTS; // [key, name, icon, brief]
  const idx = Object.fromEntries(D.map((d, i) => [d[0], i]));
  const items = D.map((d) => [d[0], d[1], d[2]]);
  let S = null, busy = false;

  const BASE = `For EACH department return: "rating":"green|amber|red","score":0-100 (higher = cleaner),"headline":"max 16 words","findings":["3 bullets, max 20 words each"],"red_flags":["0-2 items, max 16 words"],"requests":["4 specific data-room requests"],"risks":[{"risk":"max 8 words","likelihood":1-5,"impact":1-5}] (1-2 items).`;
  const RULES = `Use the live web results for facts; if a figure is not public, give an estimate and say "est.". Never invent lawsuits, fines or deals: if none are known, say so. Be specific to this company, not generic.`;
  const facts = (prev) => { const sn = (prev.financial || {}).snapshot; return sn ? `The financial team has established these figures; stay consistent with them and do not contradict them: ${JSON.stringify(sn)}.` : ""; };
  const ctx = () => `Target: "${S.co}".${S.buyer ? ` Prospective buyer: "${S.buyer}".` : " Buyer: a financial sponsor (private equity)."}`;

  const CALLS = [
    { keys: ["financial", "tax"], q: (c) => `${c} annual results revenue EBITDA net debt free cash flow`,
      p: () => `You are the financial and tax due-diligence teams of a transaction-services firm. ${ctx()} ${RULES}
${BASE}
The financial department ALSO returns: "snapshot":{"currency":"EUR|USD|GBP…","fy":"latest fiscal year","revenue_m":number,"revenue_growth_pct":number,"ebitda_reported_m":number,"ebitda_margin_pct":number,"net_debt_m":number,"fcf_conversion_pct":number,"employees":"approx."},"qoe":[3-5 quality-of-earnings adjustments {"item":"max 6 words","amount_m":number (positive = add-back, negative = deduction),"type":"one-off|run-rate|pro forma|accounting"}],"nwc":"working-capital view, max 22 words".
Return ONLY JSON: {"company":{"name":"","hq":"","sector":"","ownership":"","summary":"max 35 words"},"financial":{...},"tax":{...}}` },
    { keys: ["commercial", "operations", "esg"], q: (c) => `${c} market share competitors customers strategy growth`,
      p: (prev) => `You are the commercial, operational and ESG due-diligence teams. ${ctx()} ${RULES} ${facts(prev)}
${BASE}
The commercial department ALSO returns "market":{"size":"market size with unit","growth":"CAGR %","position":"rank/share, max 10 words","competitors":["4 names"]}.
Return ONLY JSON: {"commercial":{...},"operations":{...},"esg":{...}}` },
    { keys: ["legal", "regulatory", "tech", "people"], q: (c) => `${c} litigation investigation regulator fine data breach CEO management`,
      p: (prev) => `You are the legal, regulatory & antitrust, IT & cyber, and HR & management due-diligence teams. ${ctx()} ${RULES} ${facts(prev)} For regulatory, consider EU/UK merger control and foreign-investment screening for this buyer.
${BASE}
Return ONLY JSON: {"legal":{...},"regulatory":{...},"tech":{...},"people":{...}}` },
    { keys: ["valuation", "integration"], q: (c) => `${c} valuation EV/EBITDA multiple acquisition comparable transactions`,
      p: (prev) => `You are the valuation and integration teams. ${ctx()} ${RULES} Financial snapshot from colleagues: ${JSON.stringify((prev.financial || {}).snapshot || {})}. QoE: ${JSON.stringify((prev.financial || {}).qoe || [])}.
${BASE}
Valuation ALSO returns: "methods":[{"method":"DCF","low_m":n,"high_m":n},{"method":"Trading comps","low_m":n,"high_m":n},{"method":"Precedent deals","low_m":n,"high_m":n},{"method":"LBO","low_m":n,"high_m":n}] (enterprise value, same currency),"multiple":"EV/EBITDA range used, e.g. 11-13x","lbo":{"entry_multiple":number,"exit_multiple":number,"leverage_x":number,"ebitda_cagr_pct":number}.
Integration ALSO returns: "synergies":{"cost_m":n,"revenue_m":n,"cost_to_achieve_m":n},"plan":["4 bullets: first 100 days"].
Return ONLY JSON: {"valuation":{...},"integration":{...}}` },
  ];

  /* ---------- run ---------- */
  $("cForm").onsubmit = (e) => { e.preventDefault(); run(); };
  document.querySelectorAll("[data-cx]").forEach((b) => (b.onclick = () => { const [c, by] = b.dataset.cx.split("|"); $("cCo").value = c; $("cBuyer").value = by || ""; run(); }));
  DD.board("cBoard", items, -1, 0);

  async function run() {
    if (busy) return;
    const co = $("cCo").value.trim(); if (!co) { $("cCo").focus(); toast("Type a target company first"); return; }
    busy = true; $("cRun").disabled = true; $("cMsg").innerHTML = ""; $("cLog").innerHTML = "";
    S = { co, buyer: $("cBuyer").value.trim(), d: {}, sources: [], rag: {} };
    $("cOut").innerHTML = '<div class="card pad"><div class="sk" style="height:120px"></div><div class="sk" style="height:300px;margin-top:14px"></div></div>';
    document.getElementById("c-app").scrollIntoView({ behavior: "smooth" });
    DD.pulse("company");
    const addSrc = (s) => s.forEach((x) => { if (safeUrl(x.url) && !S.sources.find((y) => y.url === x.url)) S.sources.push(x); });
    const ragArr = () => D.map((d) => S.rag[d[0]] || "");
    let failed = 0;
    for (const c of CALLS) {
      const act = c.keys.map((k) => idx[k]);
      DD.board("cBoard", items, act, 0, ragArr());
      DD.logTo("cLog", `${c.keys.map((k) => D[idx[k]][1]).join(", ")}: reading live sources`);
      try {
        const r = await ask(c.p(S.d), c.q(co));
        addSrc(r.sources);
        if (r.data.company) S.company = r.data.company;
        c.keys.forEach((k) => { const v = r.data[k]; if (v) { S.d[k] = v; S.rag[k] = v.rating || "amber"; } else S.rag[k] = "n/a"; });
        DD.logTo("cLog", `${c.keys.map((k) => D[idx[k]][1]).join(", ")}: done (${r.sources.length} sources)`);
      } catch (e) {
        failed++; c.keys.forEach((k) => (S.rag[k] = "n/a"));
        DD.logTo("cLog", `${c.keys.join(", ")}: failed (${e.message}). Continuing with the other teams.`);
      }
      render();
      DD.pulse("company");
    }
    if (failed === CALLS.length) { DD.board("cBoard", items, -1, 0); DD.errTo("cMsg", "The diligence teams could not reach the AI service. Please try again in a minute.", run); $("cOut").innerHTML = ""; busy = false; $("cRun").disabled = false; return; }
    // investment committee
    DD.board("cBoard", items, idx.ic, 0, ragArr());
    DD.logTo("cLog", "Investment committee: weighing all departments");
    try {
      const brief = Object.fromEntries(Object.entries(S.d).map(([k, v]) => [k, { rating: v.rating, score: v.score, headline: v.headline, red_flags: v.red_flags }]));
      const r = await ask(`You are the investment committee of a due-diligence firm. ${ctx()} Department results: ${JSON.stringify(brief)}. Valuation: ${JSON.stringify((S.d.valuation || {}).methods || [])}.
Return ONLY JSON: {"score":0-100,"verdict":"Proceed|Proceed with conditions|Do not proceed","headline":"max 14 words","summary":"max 60 words","top_flags":["5 red flags ranked, most serious first, max 16 words"],"conditions":["4 conditions to proceed"],"spa":["5 SPA protections, e.g. specific indemnity, W&I insurance, locked box vs completion accounts, earn-out, MAC, escrow — tied to the flags"],"next_steps":["4 next steps"]}`);
      S.ic = r.data; S.rag.ic = /do not/i.test(S.ic.verdict) ? "red" : /condition/i.test(S.ic.verdict) ? "amber" : "green";
      DD.logTo("cLog", `Investment committee: ${S.ic.verdict}`);
    } catch (e) { S.rag.ic = "n/a"; DD.logTo("cLog", "Investment committee: failed (" + e.message + ")"); DD.errTo("cMsg", "The investment committee step failed. Department results are below.", null); }
    DD.board("cBoard", items, -1, 0, ragArr());
    render();
    const h = store.get("dd_hist", []).filter((x) => x.toLowerCase() !== co.toLowerCase()); h.unshift(co); store.set("dd_hist", h.slice(0, 6));
    busy = false; $("cRun").disabled = false; DD.pulse("done");
  }

  /* ---------- helpers ---------- */
  const num = (v) => (v == null || isNaN(+v) ? null : +v);
  const cur = () => ((S.d.financial || {}).snapshot || {}).currency || "EUR";
  const sym = (c) => ({ EUR: "€", USD: "$", GBP: "£", INR: "₹", CHF: "CHF ", SEK: "SEK " }[c] || c + " ");
  const m = (v) => (num(v) == null ? "n/a" : sym(cur()) + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + "bn" : Math.round(v) + "m"));
  const avgScore = () => { const v = Object.values(S.d).map((x) => num(x.score)).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const L = (a) => (a && a.length ? "<ul>" + a.map((i) => `<li>${esc(i)}</li>`).join("") + "</ul>" : "");

  function adjEbitda() { const f = S.d.financial || {}, s = f.snapshot || {}; const rep = num(s.ebitda_reported_m); if (rep == null) return null; return rep + (f.qoe || []).reduce((a, q) => a + (num(q.amount_m) || 0), 0); }

  function bridge() {
    const f = S.d.financial; if (!f || !f.snapshot || num(f.snapshot.ebitda_reported_m) == null) return "";
    const rep = +f.snapshot.ebitda_reported_m, q = (f.qoe || []).filter((x) => num(x.amount_m) != null), adj = adjEbitda();
    const steps = [{ l: "Reported", v: rep, t: "total" }, ...q.map((x) => ({ l: x.item, v: +x.amount_m, t: x.type })), { l: "Adjusted", v: adj, t: "total" }];
    const W = 520, H = 230, pad = 30, bw = (W - pad * 2) / steps.length - 10;
    let run = 0; const all = []; steps.forEach((s, i) => { if (s.t === "total") { all.push(0, s.v); run = s.v; } else { all.push(run, run + s.v); run += s.v; } });
    const lo = Math.min(0, ...all), hi = Math.max(...all) * 1.12, y = (v) => H - 40 - ((v - lo) / (hi - lo || 1)) * (H - 70);
    let g = "", r2 = 0;
    steps.forEach((s, i) => {
      const x = pad + i * (bw + 10); let a, b, col;
      if (s.t === "total") { a = 0; b = s.v; r2 = s.v; col = i ? "#1d1a4f" : "#8b7bff"; } else { a = r2; b = r2 + s.v; r2 = b; col = s.v >= 0 ? "#2fbf8f" : "#ff7a59"; }
      const top = y(Math.max(a, b)), hgt = Math.max(2, Math.abs(y(a) - y(b)));
      g += `<rect x="${x}" y="${top}" width="${bw}" height="${hgt}" rx="5" fill="${col}"><animate attributeName="height" from="0" to="${hgt}" dur=".7s" fill="freeze"/></rect>`;
      g += `<text x="${x + bw / 2}" y="${top - 6}" text-anchor="middle" font-weight="600">${s.t === "total" ? m(s.v) : (s.v > 0 ? "+" : "") + Math.round(s.v)}</text>`;
      g += `<text x="${x + bw / 2}" y="${H - 22}" text-anchor="middle">${esc(String(s.l).slice(0, 14))}</text>`;
      if (String(s.l).length > 14) g += `<text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle">${esc(String(s.l).slice(14, 28))}</text>`;
    });
    return `<div class="card pad"><p class="eyebrow">Financial DD · Quality of earnings</p><h3 style="font-size:20px;margin:6px 0 4px">EBITDA bridge, ${esc(f.snapshot.fy || "latest year")}</h3><p style="margin:0;color:var(--ink-2);font-size:13px">Reported ${m(rep)} → adjusted ${m(adj)} after ${q.length} normalisations. Green adds back, coral deducts.</p><svg class="wf" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="EBITDA bridge">${g}</svg><p class="note">${esc(f.nwc || "")}</p></div>`;
  }

  function football() {
    const v = S.d.valuation; if (!v || !v.methods) return "";
    const ms = v.methods.filter((x) => num(x.low_m) != null && num(x.high_m) != null); if (!ms.length) return "";
    const lo = Math.min(...ms.map((x) => +x.low_m)) * 0.85, hi = Math.max(...ms.map((x) => +x.high_m)) * 1.08, X = (val) => 130 + ((val - lo) / (hi - lo || 1)) * 360;
    const cols = ["#5b4cf0", "#8b7bff", "#e8b44a", "#ff7a59"];
    let g = ms.map((x, i) => `<text x="0" y="${30 + i * 40}" font-weight="600">${esc(x.method)}</text><rect x="${X(+x.low_m)}" y="${16 + i * 40}" width="${Math.max(4, X(+x.high_m) - X(+x.low_m))}" height="20" rx="6" fill="${cols[i % 4]}" opacity=".9"/><text x="${X(+x.low_m) - 4}" y="${30 + i * 40}" text-anchor="end">${m(+x.low_m)}</text><text x="${X(+x.high_m) + 4}" y="${30 + i * 40}">${m(+x.high_m)}</text>`).join("");
    return `<div class="card pad"><p class="eyebrow">Valuation · Football field</p><h3 style="font-size:20px;margin:6px 0 4px">Enterprise value ranges</h3><p style="margin:0;color:var(--ink-2);font-size:13px">${esc(v.multiple || "")}${v.headline ? " · " + esc(v.headline) : ""}</p><svg class="wf" viewBox="0 0 540 ${ms.length * 40 + 20}" width="100%" role="img" aria-label="Valuation football field">${g}</svg></div>`;
  }

  /* LBO returns: EBITDA grows at g, 45% of EBITDA minus 7% interest repays debt, 5-year hold */
  function lbo(e0, entry, exit, lev, g) {
    let debt = lev * e0, eb = e0; const eq0 = entry * e0 - debt; if (eq0 <= 0) return null;
    for (let y = 0; y < 5; y++) { eb *= 1 + g / 100; const cash = eb * 0.45 - debt * 0.07; debt = Math.max(0, debt - Math.max(0, cash)); }
    const eq5 = exit * eb - debt; if (eq5 <= 0) return { irr: -1, moic: 0 };
    return { irr: Math.pow(eq5 / eq0, 1 / 5) - 1, moic: eq5 / eq0 };
  }
  function sensHtml() {
    const e0 = adjEbitda() ?? num(((S.d.financial || {}).snapshot || {}).ebitda_reported_m); const L0 = (S.d.valuation || {}).lbo || {};
    if (!e0 || e0 <= 0) return "";
    S.lbo = S.lbo || { entry: num(L0.entry_multiple) || 10, exit: num(L0.exit_multiple) || num(L0.entry_multiple) || 10, lev: num(L0.leverage_x) || 4, g: num(L0.ebitda_cagr_pct) ?? 5 };
    return `<div class="card pad" id="sensCard"><p class="eyebrow">Valuation · LBO returns</p><h3 style="font-size:20px;margin:6px 0 4px">IRR sensitivity</h3><p style="margin:0;color:var(--ink-2);font-size:13px">Adjusted EBITDA ${m(e0)}, 5-year hold. Drag to stress the deal.</p>
    <div class="ctl"><label>Leverage <b id="lvV">${S.lbo.lev.toFixed(1)}x</b><input type="range" id="lv" min="0" max="7" step="0.5" value="${S.lbo.lev}"></label><label>EBITDA growth <b id="gV">${S.lbo.g}%</b><input type="range" id="gg2" min="-5" max="20" step="1" value="${S.lbo.g}"></label><label>Entry multiple <b id="enV">${S.lbo.entry.toFixed(1)}x</b><input type="range" id="en" min="4" max="25" step="0.5" value="${S.lbo.entry}"></label></div>
    <div id="sensT">${sensTable(e0)}</div><p class="note">Assumes 45% of EBITDA converts to cash, 7% cost of debt, all spare cash repays debt. Indicative only.</p></div>`;
  }
  function sensTable(e0) {
    e0 = e0 || adjEbitda() || num(((S.d.financial || {}).snapshot || {}).ebitda_reported_m);
    const ens = [-2, -1, 0, 1, 2].map((d) => S.lbo.entry + d), exs = [-2, -1, 0, 1, 2].map((d) => S.lbo.entry + d);
    const col = (irr) => irr == null ? "#eee" : irr >= 0.2 ? "rgba(47,191,143,.85)" : irr >= 0.15 ? "rgba(47,191,143,.45)" : irr >= 0.1 ? "rgba(232,180,74,.55)" : "rgba(255,122,89,.6)";
    let h = `<table class="sens"><thead><tr><th style="font-size:10px">Entry ↓ Exit →</th>${exs.map((x) => `<th>${x.toFixed(1)}x</th>`).join("")}</tr></thead><tbody>`;
    ens.forEach((en) => { h += `<tr><th>${en.toFixed(1)}x</th>` + exs.map((ex) => { const r = lbo(e0, en, ex, S.lbo.lev, S.lbo.g); return `<td class="${en === S.lbo.entry && ex === S.lbo.entry ? "base" : ""}" style="background:${col(r && r.irr)}" title="MOIC ${r ? r.moic.toFixed(1) + "x" : "n/a"}">${r ? (r.irr * 100).toFixed(0) + "%" : "n/a"}</td>`; }).join("") + "</tr>"; });
    return h + "</tbody></table>";
  }

  function matrix() {
    const pts = []; Object.entries(S.d).forEach(([k, v]) => (v.risks || []).forEach((r) => { if (num(r.likelihood) && num(r.impact)) pts.push({ ...r, k }); }));
    if (!pts.length) return "";
    const top = pts.sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact).slice(0, 12);
    const seen = {};
    const dots = top.map((r, i) => { const key = r.likelihood + "-" + r.impact; const o = (seen[key] = (seen[key] || 0) + 1) - 1; return `<span class="pt" style="left:${((r.likelihood - 0.5) / 5) * 100 + o * 4}%;bottom:${((r.impact - 0.5) / 5) * 100 - o * 4}%" title="${esc(r.risk)}">${i + 1}</span>`; }).join("");
    return `<div class="card pad"><p class="eyebrow">Risk · Likelihood × impact</p><h3 style="font-size:20px;margin:6px 0 12px">Risk matrix</h3><div class="matrix">${dots}<span class="ax" style="left:10px;bottom:8px">Likelihood →</span><span class="ax" style="left:10px;top:8px">↑ Impact</span></div><ol class="rlist">${top.map((r) => `<li><span>${esc(r.risk)} <small style="color:var(--ink-3)">· ${esc(D[idx[r.k]] ? D[idx[r.k]][1] : r.k)} · L${r.likelihood} × I${r.impact}</small></span></li>`).join("")}</ol></div>`;
  }

  function reqRows() { const rows = []; D.forEach((d) => { const v = S.d[d[0]]; if (v) (v.requests || []).forEach((q, i) => rows.push([d[1], q, i < 2 ? "High" : "Medium"])); }); return rows; }

  function render() {
    if (!S) return;
    const done = Object.keys(S.d).length, co = S.company || { name: S.co };
    const sc = S.ic ? num(S.ic.score) ?? avgScore() : avgScore();
    const vt = S.ic ? S.rag.ic : "";
    let h = `<div class="verdict rv in">${DD.gauge(sc, S.ic ? "IC SCORE" : "INTERIM")}<div><p class="eyebrow">${S.ic ? "Investment committee verdict" : `Diligence in progress · ${done}/11 departments`}${S.buyer ? " · buyer: " + esc(S.buyer) : ""}</p><h2>${esc(S.ic ? S.ic.headline : co.name)}</h2><p>${esc(S.ic ? S.ic.summary : co.summary || "Departments are reviewing the target.")}</p></div>${S.ic ? `<span class="vtag ${vt}">${esc(S.ic.verdict)}</span>` : ""}</div>`;
    const sn = (S.d.financial || {}).snapshot;
    if (sn) h += `<div class="kpis"><div class="kpi"><small>Revenue ${esc(sn.fy || "")}</small><b>${m(sn.revenue_m)}</b><em>${num(sn.revenue_growth_pct) != null ? (sn.revenue_growth_pct > 0 ? "+" : "") + sn.revenue_growth_pct + "% y/y" : ""}</em></div><div class="kpi"><small>EBITDA reported</small><b>${m(sn.ebitda_reported_m)}</b><em>${num(sn.ebitda_margin_pct) != null ? sn.ebitda_margin_pct + "% margin" : ""}</em></div><div class="kpi"><small>Adjusted EBITDA</small><b>${m(adjEbitda())}</b><em>after QoE</em></div><div class="kpi"><small>Net debt</small><b>${m(sn.net_debt_m)}</b><em>${num(sn.net_debt_m) != null && adjEbitda() ? (sn.net_debt_m / adjEbitda()).toFixed(1) + "x adj. EBITDA" : ""}</em></div><div class="kpi"><small>Cash conversion</small><b>${num(sn.fcf_conversion_pct) != null ? sn.fcf_conversion_pct + "%" : "n/a"}</b><em>FCF / EBITDA</em></div><div class="kpi"><small>People</small><b>${esc(sn.employees || "n/a")}</b><em>${esc(co.hq || "")}</em></div></div>`;
    const br = bridge(), fb = football();
    if (br || fb) h += `<div class="two">${br}${fb}</div>`;
    const se = sensHtml(), mx = matrix();
    if (se || mx) h += `<div class="two">${se}${mx}</div>`;
    // departments
    h += `<div class="dgrid">` + D.filter((d) => d[0] !== "ic").map((d) => {
      const v = S.d[d[0]];
      if (!v) return `<div class="dcard"><div class="hd"><i>${d[2]}</i><b>${d[1]}</b><span class="sc2">${S.rag[d[0]] === "n/a" ? "n/a" : "…"}</span></div><p style="color:var(--ink-3)">${S.rag[d[0]] === "n/a" ? "This team could not finish. Run again to retry." : "Queued"}</p></div>`;
      const extra = d[0] === "commercial" && v.market ? `<p style="font-size:12.5px;color:var(--ink-2)"><b>Market:</b> ${esc(v.market.size)} · ${esc(v.market.growth)} · ${esc(v.market.position)}${v.market.competitors ? "<br><b>Competitors:</b> " + v.market.competitors.map(esc).join(", ") : ""}</p>`
        : d[0] === "integration" && v.synergies ? `<p style="font-size:12.5px;color:var(--ink-2)"><b>Synergies:</b> cost ${m(v.synergies.cost_m)}, revenue ${m(v.synergies.revenue_m)}, cost to achieve ${m(v.synergies.cost_to_achieve_m)}</p>${v.plan ? `<details><summary>100-day plan</summary>${L(v.plan)}</details>` : ""}` : "";
      return `<div class="dcard ${esc(v.rating)} rv in"><div class="hd"><i>${d[2]}</i><b>${d[1]}</b><span class="sc2">${num(v.score) ?? "–"}/100</span></div><p>${esc(v.headline)}</p>${L(v.findings)}${extra}${(v.red_flags || []).length ? `<div class="flags">${v.red_flags.map((f) => `<span class="flag">⚑ ${esc(f)}</span>`).join("")}</div>` : ""}${(v.requests || []).length ? `<details><summary>Data-room requests (${v.requests.length})</summary>${L(v.requests)}</details>` : ""}</div>`;
    }).join("") + `</div>`;
    // IC memo + requests
    const rq = reqRows();
    if (S.ic || rq.length) {
      h += `<div class="two">`;
      if (S.ic) h += `<div class="card pad memo" id="icMemo"><div class="bar"><p class="eyebrow">Investment committee memo</p><span class="sp"></span><button class="btn sm" id="icCp">Copy</button><button class="btn sm" id="icDl">Download .md</button></div><h2>${esc(S.ic.verdict)}: ${esc(S.co)}</h2><h3>Top red flags</h3>${L(S.ic.top_flags)}<h3>Conditions to proceed</h3>${L(S.ic.conditions)}<h3>SPA protections</h3>${L(S.ic.spa)}<h3>Next steps</h3>${L(S.ic.next_steps)}<p class="note">AI-generated first draft from public sources. Verify before use.</p></div>`;
      else h += `<div class="card pad"><p class="eyebrow">Investment committee</p><p style="color:var(--ink-2)">Waiting for the departments…</p></div>`;
      if (rq.length) h += `<div class="card pad"><div class="bar"><div><p class="eyebrow">Data room</p><h3 style="font-size:20px;margin-top:4px">Request list (${rq.length})</h3></div><span class="sp"></span><button class="btn sm" id="rqCsv">Export CSV</button></div><div class="reqs tbl"><table><thead><tr><th>Team</th><th>Request</th><th>Priority</th></tr></thead><tbody>${rq.map((r) => `<tr><td style="white-space:nowrap">${esc(r[0])}</td><td>${esc(r[1])}</td><td><span class="tag ${r[2] === "High" ? "red" : "amber"}">${r[2]}</span></td></tr>`).join("")}</tbody></table></div></div>`;
      h += `</div>`;
    }
    if (S.sources.length) h += `<div class="card pad" style="margin-top:16px"><p class="eyebrow">Sources read (${S.sources.length})</p><div class="srcs" style="columns:2 280px;column-gap:24px">${S.sources.slice(0, 20).map((s) => `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(String(s.title).slice(0, 80))}</a>`).join("")}</div></div>`;
    $("cOut").innerHTML = h;
  }

  function memoText() {
    const Lm = (a) => (a || []).map((i) => "- " + i).join("\n");
    let t = `# Due diligence: ${S.co}${S.buyer ? " (buyer: " + S.buyer + ")" : ""}\n\n`;
    if (S.ic) t += `## Verdict: ${S.ic.verdict} (score ${S.ic.score}/100)\n${S.ic.summary}\n\n### Top red flags\n${Lm(S.ic.top_flags)}\n\n### Conditions\n${Lm(S.ic.conditions)}\n\n### SPA protections\n${Lm(S.ic.spa)}\n\n### Next steps\n${Lm(S.ic.next_steps)}\n\n`;
    D.forEach((d) => { const v = S.d[d[0]]; if (v) t += `## ${d[1]}: ${String(v.rating || "").toUpperCase()} ${v.score}/100\n${v.headline}\n${Lm(v.findings)}\n${(v.red_flags || []).length ? "Red flags:\n" + Lm(v.red_flags) + "\n" : ""}\n`; });
    return t + `---\nDiligence Desk (aryanskothari.vercel.app). AI-generated from public sources, verify before use.\n`;
  }

  $("cOut").addEventListener("click", (e) => {
    const id = e.target.id;
    if (id === "icCp") copy(memoText(), "Memo copied");
    if (id === "icDl") download(`due-diligence-${S.co.replace(/\W+/g, "-").toLowerCase()}.md`, memoText(), "text/markdown");
    if (id === "rqCsv") { const rows = [["Team", "Request", "Priority"], ...reqRows()]; download(`data-room-requests-${S.co.replace(/\W+/g, "-").toLowerCase()}.csv`, rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv"); }
  });
  $("cOut").addEventListener("input", (e) => {
    if (!S || !S.lbo) return; const t = e.target;
    if (t.id === "lv") { S.lbo.lev = +t.value; $("lvV").textContent = S.lbo.lev.toFixed(1) + "x"; }
    else if (t.id === "gg2") { S.lbo.g = +t.value; $("gV").textContent = S.lbo.g + "%"; }
    else if (t.id === "en") { S.lbo.entry = +t.value; $("enV").textContent = S.lbo.entry.toFixed(1) + "x"; }
    else return;
    $("sensT").innerHTML = sensTable();
  });
})();
