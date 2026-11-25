// Shared helpers for the tools: live AI calls, escaping, money, storage, toasts, downloads, reveals.
(function () {
  const VERCEL_HOST = "https://aryanskothari.vercel.app";
  const host = location.hostname;
  const API_URL = /\.vercel\.app$/.test(host) ? "/api/agent"
    : /github\.io$/.test(host) || host === "localhost" || host === "127.0.0.1" ? VERCEL_HOST + "/api/agent" : "";
  let SAMPLE = null;
  if (!API_URL && window.claude && claude.use) claude.use("sample").then((s) => (SAMPLE = s)).catch(() => {});

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https:\/\//.test(String(u)) ? String(u) : "");

  function parseJSON(text) {
    const m = String(text || "").match(/\{[\s\S]*\}/);
    if (!m) throw new Error("The agent returned an unreadable answer. Please try again.");
    try { return JSON.parse(m[0]); } catch (e) { throw new Error("The agent's answer was incomplete. Please try again."); }
  }

  // ask(prompt, query) -> { data, sources }
  async function ask(prompt, query, tries = 2) {
    for (let i = 0; i < tries; i++) {
      try {
        if (API_URL) {
          const r = await fetch(API_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, query: query || "" }) });
          const j = await r.json().catch(() => ({}));
          if (r.status === 429 && i < tries - 1) { await new Promise((res) => setTimeout(res, 8000)); continue; }
          if (j.error) throw new Error(j.error);
          if (j.truncated) throw new Error("The answer was cut short. Try a narrower search.");
          return { data: parseJSON(j.text), sources: j.sources || [] };
        }
        if (!SAMPLE) throw new Error("The live agent is not reachable from this page.");
        const r = await SAMPLE(prompt, { cache: false, modelTier: "default" });
        if (r.truncated) throw new Error("The answer was cut short. Try a narrower search.");
        return { data: parseJSON(r.text), sources: [] };
      } catch (e) {
        if (i === tries - 1) throw e;
      }
    }
  }

  // quote(symbol) -> { symbol, name, currency, price, pts:[[ms, close, vol]], bench:{symbol, pts} }
  async function quote(symbol) {
    if (!API_URL) throw new Error("Live market data is only available on the hosted site.");
    const r = await fetch(API_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "quote", symbol }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || "Market data is unavailable right now.");
    return j;
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  let toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("on");
    clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove("on"), 2600);
  }

  async function download(name, text, type = "text/plain") {
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      toast("Downloaded " + name);
    } catch (e) {
      try { await navigator.clipboard.writeText(text); toast("Download blocked here, copied to clipboard instead"); } catch (x) { toast("Download is not available here"); }
    }
  }
  async function copy(text, label = "Copied") {
    try { await navigator.clipboard.writeText(text); toast(label); } catch (e) { toast("Select the text and copy it manually"); }
  }

  const RATES = { USD: 1, EUR: 0.92, GBP: 0.79, AUD: 1.52, INR: 83 }; // indicative, for display only
  const SYM = { USD: "$", EUR: "€", GBP: "£", AUD: "A$", INR: "₹" };
  function fmtMoney(usd, cur = "USD") {
    const v = Math.round(((+usd || 0) * RATES[cur]) / 10) * 10;
    return SYM[cur] + v.toLocaleString("en-US");
  }

  // scroll reveal
  function reveal(root = document) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) { root.querySelectorAll(".rv").forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
    root.querySelectorAll(".rv:not(.in)").forEach((e) => io.observe(e));
  }

  window.App = { ask, quote, esc, safeUrl, store, toast, download, copy, fmtMoney, RATES, SYM, reveal, live: !!API_URL };
  document.addEventListener("DOMContentLoaded", () => {
    reveal();
    document.querySelectorAll("[data-status]").forEach((el) => {
      const on = !!API_URL || !!(window.claude && claude.use);
      el.textContent = API_URL ? "Live web data" : "AI estimates";
      el.classList.toggle("off", !on);
    });
  });
})();
