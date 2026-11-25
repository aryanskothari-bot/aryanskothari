(function () {
  const S = window.SITE || {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $$ = (q) => [...document.querySelectorAll(q)];

  // ---- editable details from config.js ----
  $$("[data-email]").forEach((a) => {
    if (!S.email) { a.textContent = "[Add email]"; a.removeAttribute("href"); return; }
    a.href = "mailto:" + S.email; if (a.dataset.email === "text") a.textContent = S.email;
  });
  $$("[data-phone]").forEach((a) => { if (!S.phone) return a.remove(); a.href = "tel:" + S.phone.replace(/\s/g, ""); a.textContent = "Call " + S.phone; });
  $$("[data-whatsapp]").forEach((a) => { if (!S.whatsapp) return a.remove(); a.href = "https://wa.me/" + S.whatsapp; });
  $$("[data-photo]").forEach((el) => { if (!S.photo) return; const i = new Image(); i.alt = S.name || ""; i.onload = () => { el.textContent = ""; el.appendChild(i); el.classList.add("has-photo"); }; i.src = S.photo; });
  $$("[data-linkedin]").forEach((a) => { if (!S.linkedin) return a.remove(); a.href = S.linkedin; });
  $$("[data-cv]").forEach((a) => { if (!S.cv) return a.remove(); a.href = S.cv; });
  $$("[data-status]").forEach((el) => { if (!S.status) return el.remove(); el.lastChild.textContent = S.status; });
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  // ---- mobile menu ----
  const btn = document.querySelector(".menu-btn"), nav = document.getElementById("nav");
  const setMenu = (open) => {
    nav.classList.toggle("open", open); document.body.classList.toggle("menu-open", open);
    btn.setAttribute("aria-expanded", String(open)); btn.textContent = open ? "Close" : "Menu";
    if (open) setTimeout(() => nav.querySelector("a").focus({ preventScroll: true }), 60);
  };
  // keep keyboard focus inside the open menu
  nav.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [btn, ...nav.querySelectorAll("a")], i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  });
  btn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); btn.focus(); } });

  // ---- kinetic name: split into letters, re-stretch on hover ----
  $$("[data-split]").forEach((el) => {
    const t = el.textContent; el.textContent = "";
    [...t].forEach((c, i) => { const s = document.createElement("span"); s.className = "ch"; s.style.setProperty("--i", i); s.textContent = c; el.appendChild(s); });
  });
  if (!reduce) $$(".kin .ch").forEach((c) => c.addEventListener("pointerenter", () => { c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); }));

  // ---- Lottie slot: loads only if the file exists ----
  $$("[data-lottie]").forEach((slot) => {
    fetch(slot.dataset.lottie, { method: "HEAD" }).then((r) => {
      if (!r.ok) return;
      const sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js";
      sc.onload = () => window.lottie.loadAnimation({ container: slot, renderer: "svg", loop: !reduce, autoplay: !reduce, path: slot.dataset.lottie });
      document.head.appendChild(sc);
    }).catch(() => {});
  });

  // ---- project filters ----
  const fbtns = $$(".filters button");
  fbtns.forEach((b) => b.addEventListener("click", () => {
    fbtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $$(".entry").forEach((e) => { e.hidden = !(b.dataset.f === "all" || e.dataset.cat === b.dataset.f); });
  }));

  // ---- header state + active section ----
  const header = document.querySelector(".site-header");
  const onScroll = () => header.classList.toggle("solid", scrollY > 24);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const links = $$("#nav a[href^='#']");
  const spy = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((l) => (l.getAttribute("href") === "#" + e.target.id ? l.setAttribute("aria-current", "true") : l.removeAttribute("aria-current")));
  }), { rootMargin: "-40% 0px -55% 0px" });
  $$("main > section[id]").forEach((s) => spy.observe(s));

  // ---- section reveals: content is visible without JS; this only adds a short fade-up ----
  if (!reduce && "IntersectionObserver" in window) {
    document.documentElement.classList.add("motion");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    $$(".rv").forEach((el) => io.observe(el));
  }

  // ---- stat widgets: count up once when visible ----
  const counters = $$("[data-count]");
  if (!reduce && counters.length) {
    const cio = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return; cio.unobserve(e.target);
      const el = e.target, end = +el.dataset.count, pre = el.dataset.prefix || "", suf = el.dataset.suffix || "", t0 = performance.now();
      const step = (t) => { const p = Math.min(1, (t - t0) / 1100), v = Math.round(end * (1 - Math.pow(1 - p, 3))); el.textContent = pre + v + suf; if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }), { threshold: .6 });
    counters.forEach((c) => cio.observe(c));
  }

  // ---- company icons: use a logo file if you add one (assets/logos/*.png), else keep the monogram ----
  const logos = S.logos || {};
  $$(".co-icon[data-logo]").forEach((el) => {
    const file = logos[el.dataset.logo]; if (!file) return;
    const img = new Image(); img.alt = "";
    img.onload = () => { el.querySelector("span")?.remove(); el.appendChild(img); };
    img.src = file;
  });

  // ---- hero 3D: lazy, only with WebGL; still frame in reduced-motion mode ----
  const canvas = document.getElementById("value-field");
  const hasGL = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } };
  if (canvas) {
    const go = () => import("./market.js").then((m) => m.start(canvas, { still: reduce })).catch(() => {});
    "requestIdleCallback" in window ? requestIdleCallback(go, { timeout: 900 }) : setTimeout(go, 200);
  }
})();
