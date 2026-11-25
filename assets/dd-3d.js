/* Diligence Desk 3D hero: one three.js scene that morphs per desk.
   Sourcing: buyer network orbiting the deal. Company DD: 12 department satellites on rings.
   Stock DD: a fan of simulated price paths flowing out of today's price. */
const canvas = document.getElementById("scene");
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
let THREE;
try { THREE = await import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js"); } catch (e) { THREE = null; }

if (THREE && canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.6, 9);

  const GOLD = 0xe8b44a, VIOLET = 0x8b7bff, CORAL = 0xff7a59, MINT = 0x2fbf8f, WHITE = 0xffffff;
  const root = new THREE.Group(); scene.add(root);

  // stars
  const starGeo = new THREE.BufferGeometry(), SN = 900, sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sp[i * 3] = (Math.random() - 0.5) * 40; sp[i * 3 + 1] = (Math.random() - 0.5) * 22; sp[i * 3 + 2] = -Math.random() * 18 - 2; }
  starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc9c2ff, size: 0.045, transparent: true, opacity: 0.7 }));
  scene.add(stars);

  // core: the deal
  const core = new THREE.Group(); root.add(core);
  const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true, transparent: true, opacity: 0.85 }));
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 3), new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.55 }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 32), new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.07 }));
  core.add(ico, inner, halo);

  const fadeables = []; // [group, mode]
  const mat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
  const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });

  // ---- sourcing: network ----
  const net = new THREE.Group(); root.add(net); fadeables.push([net, "sourcing"]);
  const nodes = [];
  for (let i = 0; i < 14; i++) {
    const pe = i % 4 === 0, m = new THREE.Mesh(new THREE.SphereGeometry(pe ? 0.13 : 0.11, 16, 16), mat(pe ? GOLD : VIOLET));
    const r = 1.9 + (i % 3) * 0.45, a = (i / 14) * Math.PI * 2, tilt = ((i * 37) % 10) / 10 - 0.5;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const ln = new THREE.Line(geo, lineMat(0xbdb4ff, 0.22));
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat(WHITE, 0.9));
    net.add(m, ln, pulse); nodes.push({ m, ln, pulse, r, a, tilt, s: 0.12 + (i % 5) * 0.03, ph: Math.random() });
  }

  // ---- company DD: department satellites on 3 rings ----
  const firm = new THREE.Group(); root.add(firm); fadeables.push([firm, "company"]);
  const sats = [];
  const COLS = [VIOLET, GOLD, MINT, CORAL];
  for (let ring = 0; ring < 3; ring++) {
    const R = 1.9 + ring * 0.75, g = new THREE.Group();
    g.rotation.x = 1.1 + ring * 0.35; g.rotation.y = ring * 0.9;
    const tor = new THREE.Mesh(new THREE.TorusGeometry(R, 0.006, 6, 160), mat(0xcfc8ff, 0.35));
    g.add(tor);
    for (let j = 0; j < 4; j++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mat(COLS[(ring + j) % 4]));
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), mat(COLS[(ring + j) % 4], 0.12));
      s.add(glow); g.add(s); sats.push({ s, R, a: (j / 4) * Math.PI * 2, sp: 0.25 - ring * 0.05 });
    }
    firm.add(g);
  }

  // ---- stock DD: fan of simulated paths ----
  const fan = new THREE.Group(); root.add(fan); fadeables.push([fan, "stock"]);
  const PATHS = 70, STEPS = 90, paths = [];
  const rnd = (() => { let s = 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  // history strip
  const histPts = []; let hv = 0; for (let i = 0; i < 60; i++) { hv += gauss() * 0.06 + 0.01; histPts.push(new THREE.Vector3(-4.2 + i * 0.07, hv - 0.6, 0)); }
  const start = histPts[histPts.length - 1].clone();
  const hist = new THREE.Line(new THREE.BufferGeometry().setFromPoints(histPts), lineMat(WHITE, 0.95)); fan.add(hist);
  for (let p = 0; p < PATHS; p++) {
    const pts = []; let y = start.y; const z = (p / PATHS - 0.5) * 2.4;
    for (let t = 0; t <= STEPS; t++) { pts.push(new THREE.Vector3(start.x + t * 0.06, y, z * (t / STEPS))); y += gauss() * 0.075 + 0.004; }
    const geo = new THREE.BufferGeometry().setFromPoints(pts); geo.setDrawRange(0, 0);
    const end = pts[pts.length - 1].y - start.y;
    const col = end > 0.4 ? MINT : end < -0.4 ? CORAL : VIOLET;
    const l = new THREE.Line(geo, lineMat(col, 0.45)); fan.add(l); paths.push(l);
  }
  const today = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), mat(GOLD)); today.position.copy(start); fan.add(today);
  fan.position.set(0.2, 0, 0);

  // modes
  let mode = "sourcing", fanT = 0, kick = 0;
  const allMats = (g) => { const out = []; g.traverse((o) => { if (o.material) out.push(o.material); }); out.forEach((m) => (m.userData.base = m.userData.base ?? m.opacity)); return out; };
  const groups = fadeables.map(([g, m]) => ({ g, m, mats: allMats(g), k: m === "sourcing" ? 1 : 0 }));
  window.addEventListener("dd:tab", (e) => { mode = e.detail; if (mode === "stock") fanT = 0; });
  window.addEventListener("dd:pulse", () => { kick = 1; });
  mode = (location.hash.slice(1) || "sourcing");

  // layout + parallax
  let W = 0, H = 0, mx = 0, my = 0;
  function size() {
    const r = canvas.getBoundingClientRect(); W = r.width; H = r.height;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    const wide = W > 900; root.position.x = wide ? 3.7 : 0; root.position.y = wide ? 0.2 : 0.4;
    root.scale.setScalar(wide ? 0.82 : 0.72);
    canvas.style.opacity = wide ? 1 : 0.45;
  }
  new ResizeObserver(size).observe(canvas); size();
  addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });

  let vis = true, last = performance.now();
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) requestAnimationFrame(tick); }).observe(canvas);
  const v3 = new THREE.Vector3();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = still ? 0 : now / 1000;
    groups.forEach((G) => { G.k += ((G.m === mode ? 1 : 0) - G.k) * Math.min(1, dt * 4); G.g.visible = G.k > 0.01; G.mats.forEach((m) => (m.opacity = m.userData.base * G.k)); G.g.scale.setScalar(0.85 + 0.15 * G.k); });
    kick *= 0.94;
    core.rotation.y = t * 0.35; core.rotation.x = t * 0.18;
    const pul = 1 + Math.sin(t * 2.2) * 0.04 + kick * 0.25; inner.scale.setScalar(pul); halo.scale.setScalar(1 + kick * 0.5 + Math.sin(t * 1.3) * 0.05);
    const coreScale = mode === "stock" ? 0.45 : 1; core.scale.lerp(v3.set(coreScale, coreScale, coreScale), Math.min(1, dt * 3));
    core.position.lerp(v3.set(mode === "stock" ? start.x + 0.2 : 0, mode === "stock" ? start.y : 0, 0), Math.min(1, dt * 3));
    // network
    nodes.forEach((n) => {
      const a = n.a + t * n.s; n.m.position.set(Math.cos(a) * n.r, Math.sin(a) * n.r * 0.55 + n.tilt, Math.sin(a) * n.r * 0.6);
      const p = n.ln.geometry.attributes.position; p.setXYZ(1, n.m.position.x, n.m.position.y, n.m.position.z); p.needsUpdate = true;
      const f = (t * 0.5 + n.ph) % 1; n.pulse.position.copy(n.m.position).multiplyScalar(f);
    });
    // firm
    firm.rotation.y = t * 0.08;
    sats.forEach((s) => { const a = s.a + t * s.sp; s.s.position.set(Math.cos(a) * s.R, Math.sin(a) * s.R, 0); s.s.rotation.x = t; s.s.rotation.y = t * 1.3; });
    // fan
    if (mode === "stock") fanT = Math.min(1, fanT + dt * 0.45);
    paths.forEach((l, i) => l.geometry.setDrawRange(0, Math.floor(Math.max(0, Math.min(1, fanT * 1.3 - (i % 10) * 0.03)) * (STEPS + 1))));
    fan.rotation.y = -0.35 + Math.sin(t * 0.3) * 0.12 + mx * 0.3; fan.rotation.x = 0.12;
    // camera + stars
    camera.position.x += (mx * 1.2 - camera.position.x) * 0.04; camera.position.y += (0.6 - my * 0.8 - camera.position.y) * 0.04; camera.lookAt(root.position.x * 0.6, 0, 0);
    stars.rotation.y = t * 0.01; stars.position.x = -mx * 0.6;
    renderer.render(scene, camera);
    if (vis && !still) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
