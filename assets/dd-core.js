/* Diligence Desk: shared shell (tabs, hero copy, department directory, 3D scene hooks) */
(function () {
  const $ = (id) => document.getElementById(id);
  $("yr").textContent = new Date().getFullYear();

  const DEPTS = [
    ["financial", "Financial DD", "💷", "Quality of earnings, normalised EBITDA, net debt, working capital and cash conversion."],
    ["tax", "Tax DD", "🧾", "Effective tax rate, exposures, transfer pricing, losses carried forward and structuring."],
    ["commercial", "Commercial DD", "📈", "Market size and growth, share, competitors, customers, pricing power and the plan."],
    ["operations", "Operational DD", "⚙️", "Footprint, supply chain, capex needs, unit economics and scalability."],
    ["esg", "ESG DD", "🌿", "Emissions, governance, controversies, social risks and regulation like CSRD."],
    ["legal", "Legal DD", "⚖️", "Litigation, key contracts, change-of-control clauses, IP ownership and compliance."],
    ["regulatory", "Regulatory & antitrust", "🏛️", "Merger control, foreign-investment screening, sector licences and sanctions."],
    ["tech", "IT & cyber DD", "🛡️", "Systems, technical debt, data protection, GDPR and cyber incidents."],
    ["people", "HR & management DD", "👥", "Leadership, key-person risk, culture, pensions, unions and retention."],
    ["valuation", "Valuation", "🧮", "DCF, trading comps and precedent deals, plus LBO returns and IRR sensitivity."],
    ["integration", "Synergies & integration", "🔗", "Cost and revenue synergies, costs to achieve and a 100-day plan."],
    ["ic", "Investment committee", "🎯", "Weighs every department, ranks red flags and gives the verdict and SPA protections."],
  ];
  const HERO = {
    sourcing: { t: 'Find the right <em>buyer</em> for any European company.', l: "Type a company. Four agents read live sources, build the buyer or target universe, score each name on eight pillars and draft a first deal memo.", s: [["8", "counterparties"], ["8", "pillars scored"], ["4", "agents"]] },
    company: { t: 'Twelve departments. <em>One verdict.</em>', l: "Financial, tax, commercial, operational, ESG, legal, regulatory, IT, HR, valuation and integration teams each review the target. The investment committee decides.", s: [["12", "departments"], ["60+", "data-room requests"], ["1", "IC verdict"]] },
    stock: { t: 'The next six months, <em>in probabilities.</em>', l: "Live prices, quant risk and 3,000 simulated paths, plus fundamentals, catalysts and bull, base and bear cases from the research desk.", s: [["3,000", "simulated paths"], ["126", "trading days"], ["3", "scenarios"]] },
  };

  let current = "sourcing";
  function show(tab, scroll) {
    if (!HERO[tab]) tab = "sourcing";
    current = tab;
    document.querySelectorAll(".tabs [data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
    document.querySelectorAll("[data-for]").forEach((el) => (el.hidden = el.dataset.for !== tab));
    document.querySelectorAll("[data-desk]").forEach((el) => (el.hidden = el.dataset.desk !== tab));
    const h = HERO[tab];
    $("hTitle").innerHTML = h.t; $("hLead").textContent = h.l;
    ["A", "B", "C"].forEach((k, i) => { $("hs" + k).textContent = h.s[i][0]; $("hs" + k + "l").textContent = h.s[i][1]; });
    if (location.hash.slice(1) !== tab) history.replaceState(null, "", "#" + tab);
    window.dispatchEvent(new CustomEvent("dd:tab", { detail: tab }));
    if (scroll) document.querySelector(".dhero").scrollIntoView({ behavior: "smooth" });
  }
  document.querySelectorAll(".tabs [data-tab]").forEach((b) => (b.onclick = () => show(b.dataset.tab)));
  document.querySelectorAll("[data-go]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); show(a.dataset.go, true); }));
  const start = location.hash.slice(1);
  show(HERO[start] ? start : "sourcing");

  // department directory with a light 3D tilt
  $("deptGrid").innerHTML = DEPTS.map((d, i) => `<div class="dept rv"><span class="no">${String(i + 1).padStart(2, "0")}</span><i>${d[2]}</i><b>${d[1]}</b><small>${d[3]}</small></div>`).join("");
  if (matchMedia("(hover:hover)").matches) document.querySelectorAll(".dept").forEach((el) => {
    el.onmousemove = (e) => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; el.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-3px)`; };
    el.onmouseleave = () => (el.style.transform = "");
  });
  if (window.App && App.reveal) App.reveal();

  document.querySelectorAll("[data-close]").forEach((el) => (el.onclick = () => $("drawer").classList.remove("on")));
  addEventListener("keydown", (e) => { if (e.key === "Escape") $("drawer").classList.remove("on"); });

  // shared helpers for the desks
  function board(el, items, active, done, rag) {
    $(el).innerHTML = items.map((s, i) => `<div class="stage ${i < done || (rag && rag[i]) ? "done " + ((rag && rag[i]) || "") : i === active || (Array.isArray(active) && active.includes(i)) ? "run" : ""}"><span class="dot"></span><span class="ic">${s[2] || ""}</span><b>${s[1]}</b><small>${(rag && rag[i]) || i < done ? "Done" : i === active || (Array.isArray(active) && active.includes(i)) ? "Working…" : "Queued"}</small></div>`).join("");
  }
  function logTo(el, t) { const l = $(el); l.hidden = false; const d = document.createElement("div"); d.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + "  " + t; l.appendChild(d); l.scrollTop = l.scrollHeight; }
  function errTo(el, m, retry) { $(el).innerHTML = `<div class="err" role="alert"><span>${App.esc(m)}</span>${retry ? '<button class="btn sm" data-retry>Try again</button>' : ""}</div>`; const b = $(el).querySelector("[data-retry]"); if (b) b.onclick = retry; }
  function gauge(v, label) {
    const r = 48, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, v)) / 100, id = "gg" + Math.random().toString(36).slice(2, 8);
    return `<div class="gauge"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="10"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="url(#${id})" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c * p} ${c}"/><defs><linearGradient id="${id}"><stop offset="0" stop-color="#8b7bff"/><stop offset="1" stop-color="#e8b44a"/></linearGradient></defs></svg><b>${Math.round(v)}</b><small>${label || "SCORE"}</small></div>`;
  }

  window.DD = {
    DEPTS, show, board, logTo, errTo, gauge,
    get tab() { return current; },
    goCompany(target, buyer) { show("company"); $("cCo").value = target || ""; $("cBuyer").value = buyer || ""; $("cForm").requestSubmit(); },
    pulse(kind) { window.dispatchEvent(new CustomEvent("dd:pulse", { detail: kind })); },
  };
})();
