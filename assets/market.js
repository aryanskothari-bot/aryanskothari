// Hero motion: "messy numbers -> clear decisions".
// Scattered points gather into sorted bars, then into a trend line with one highlighted
// decision point, then loosen and repeat. Pure canvas, no data, no external files.
export function start(canvas, opts = {}) {
  const still = !!opts.still;
  const ctx = canvas.getContext("2d");
  const COLORS = ["#2643d6", "#ff5a36", "#ffc93c", "#b9a7ff"];
  const stepEl = canvas.closest(".t-market")?.querySelector("[data-step]");
  const STEPS = ["Raw data", "Sorted", "Insight"];
  const N = 48;
  const COUNTS = [2, 3, 4, 5, 6, 8, 9, 11]; // 48 points -> 8 bars
  let W = 0, H = 0;

  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts = Array.from({ length: N }, (_, i) => ({
    i, c: COLORS[i % 4], r: 3 + rnd() * 3,
    sx: rnd(), sy: rnd(), vx: rnd() * 2 - 1, vy: rnd() * 2 - 1, // scatter
    v: 0.25 + rnd() * 0.75,                                    // value used for sorting
    x: 0, y: 0,
  }));
  const sorted = [...pts].sort((a, b) => a.v - b.v);
  sorted.forEach((p, k) => (p.rank = k));

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (still) frame(2, 1, 0);
  }

  const pad = () => ({ l: 16, r: 16, t: 18, b: 18 });
  function target(p, stage, t) {
    const P = pad(), w = W - P.l - P.r, h = H - P.t - P.b;
    if (stage === 0) { // drifting scatter
      return { x: P.l + ((p.sx + Math.sin(t * 0.6 + p.i) * 0.04 * p.vx + 1) % 1) * w, y: P.t + ((p.sy + Math.cos(t * 0.5 + p.i) * 0.05 * p.vy + 1) % 1) * h };
    }
    if (stage === 1) { // stacked into sorted bars of rising height
      const cols = COUNTS.length, bw = w / cols, sz = Math.min(bw * 0.62, h / 12);
      let acc = 0, col = 0; while (p.rank >= acc + COUNTS[col]) { acc += COUNTS[col]; col++; }
      const row = p.rank - acc;
      return { x: P.l + bw * (col + 0.5), y: P.t + h - sz / 2 - row * (sz + 3) };
    }
    // stage 2: trend line (points ride a smooth rising curve)
    const u = p.rank / (N - 1), x = P.l + u * w;
    const y = P.t + h * (0.82 - 0.62 * u + Math.sin(u * 6.3) * 0.06);
    return { x, y };
  }

  function frame(stage, mix, t, prevStage = stage) {
    ctx.clearRect(0, 0, W, H);
    const P = pad();
    // faint guide lines
    ctx.strokeStyle = "rgba(22,33,58,.06)"; ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) { const y = P.t + ((H - P.t - P.b) / 4) * g; ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(W - P.r, y); ctx.stroke(); }
    const e = mix < 0.5 ? 4 * mix ** 3 : 1 - (-2 * mix + 2) ** 3 / 2;
    pts.forEach((p) => {
      const a = target(p, prevStage, t), b = target(p, stage, t);
      p.x = a.x + (b.x - a.x) * e; p.y = a.y + (b.y - a.y) * e;
    });
    // line through points in the insight stage
    if (stage === 2) {
      ctx.globalAlpha = e; ctx.strokeStyle = "#16213a"; ctx.lineWidth = 2.2; ctx.beginPath();
      sorted.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.globalAlpha = 1;
    }
    pts.forEach((p) => {
      const r = stage === 1 ? Math.max(p.r, 5) * (0.8 + 0.2 * e) : p.r;
      ctx.fillStyle = p.c; ctx.globalAlpha = stage === 2 ? 0.35 + 0.65 * (1 - e) : 0.9;
      ctx.beginPath();
      if (stage === 1 && e > 0.5) { const s = Math.min((W - 32) / COUNTS.length * 0.62, (H - 36) / 12); ctx.roundRect ? ctx.roundRect(p.x - s / 2, p.y - s / 2, s, s, 3) : ctx.rect(p.x - s / 2, p.y - s / 2, s, s); }
      else ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (stage === 2 && e > 0.6) { // the decision point
      const p = sorted[N - 6], k = (e - 0.6) / 0.4, pulse = 8 + Math.sin(t * 3) * 3;
      ctx.strokeStyle = "rgba(38,67,214,.35)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, pulse + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffc93c"; ctx.beginPath(); ctx.arc(p.x, p.y, 8 * k, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#16213a"; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = "600 12px Inter, sans-serif"; ctx.fillStyle = "#16213a"; ctx.globalAlpha = k;
      const label = "Decision", tw = ctx.measureText(label).width, lx = Math.min(p.x - tw / 2, W - tw - 22), ly = p.y - 28;
      ctx.fillStyle = "#16213a"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx - 8, ly - 14, tw + 16, 22, 11) : ctx.rect(lx - 8, ly - 14, tw + 16, 22); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(label, lx, ly + 2); ctx.globalAlpha = 1;
    }
    if (stepEl) stepEl.textContent = STEPS[mix < 0.5 && prevStage !== stage ? prevStage : stage];
  }

  new ResizeObserver(resize).observe(canvas); resize();
  canvas.closest(".stage")?.classList.add("live");
  if (still) { frame(2, 1, 0); return; }

  // timeline: hold scatter, gather into bars, hold, form line, hold, loosen
  const HOLD = 1800, MOVE = 1300, cycle = (HOLD + MOVE) * 3;
  let visible = true, raf = 0; const t0 = performance.now();
  const step = (now) => {
    raf = requestAnimationFrame(step);
    const ms = (now - t0) % cycle, seg = Math.floor(ms / (HOLD + MOVE)), local = ms % (HOLD + MOVE);
    const from = seg, to = (seg + 1) % 3, mix = local < HOLD ? 0 : (local - HOLD) / MOVE;
    frame(mix > 0 ? to : from, mix > 0 ? mix : 1, now / 1000, mix > 0 ? from : from);
  };
  const run = () => { cancelAnimationFrame(raf); if (visible && !document.hidden) raf = requestAnimationFrame(step); };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; run(); }).observe(canvas);
  document.addEventListener("visibilitychange", run);
  run();
}
