// Flat illustrations of destination landmarks, drawn in SVG (no photos, no licences, instant load).
(function () {
  const P = {
    India:      { sky: ["#ffb36b", "#ffe2b8"], g: "#c96b3a", d: `<path d="M60 150h120v-8H60z"/><path d="M95 142v-46q25-38 50 0v46z"/><circle cx="120" cy="58" r="5"/><path d="M118 62h4v12h-4z"/><path d="M66 142V86h6v56zM168 142V86h6v56z"/><circle cx="69" cy="82" r="5"/><circle cx="171" cy="82" r="5"/><path d="M108 142v-22a12 12 0 0 1 24 0v22z" fill="#ffe2b8"/>` },
    Thailand:   { sky: ["#ff7a59", "#ffd2a8"], g: "#8a3b20", d: `<path d="M120 40l8 22h-16z"/><path d="M92 92l28-30 28 30z"/><path d="M84 112l36-26 36 26z"/><path d="M76 132l44-26 44 26z"/><path d="M90 132h60v18H90z"/><path d="M50 150h140v-6H50z"/>` },
    Turkey:     { sky: ["#6d8bff", "#cfd9ff"], g: "#2b3a7a", d: `<path d="M80 150v-34a40 40 0 0 1 80 0v34z"/><path d="M104 96a16 16 0 0 1 32 0z"/><path d="M60 150V70h6v80zM174 150V70h6v80z"/><path d="M63 70l-5-14h10zM177 70l-5-14h10z"/><path d="M50 150h140v-6H50z"/>` },
    Mexico:     { sky: ["#ffb03b", "#ffe9b0"], g: "#9a5a1a", d: `<path d="M60 150h120v-14H60zM72 136h96v-14H72zM84 122h72v-14H84zM96 108h48V94H96zM108 94h24V80h-24z"/><path d="M116 150v-56h8v56z" fill="#ffe9b0"/>` },
    Malaysia:   { sky: ["#3fb6a8", "#c8f0e8"], g: "#155e57", d: `<path d="M86 150V64l8-14 8 14v86zM138 150V64l8-14 8 14v86z"/><path d="M102 98h36v6h-36z"/><path d="M93 50v-14h2v14zM145 50v-14h2v14z"/><path d="M50 150h140v-6H50z"/>` },
    "South Korea": { sky: ["#8f7bff", "#ddd5ff"], g: "#3c2f86", d: `<path d="M70 120q50-28 100 0l-6 6q-44-22-88 0z"/><path d="M84 126h72v24H84z"/><path d="M168 150V62h4v88z"/><circle cx="170" cy="58" r="7"/><path d="M50 150h140v-6H50z"/>` },
    Spain:      { sky: ["#ff8b5c", "#ffe0c9"], g: "#8f2e14", d: `<path d="M84 150V78l6-24 6 24v72zM104 150V66l6-28 6 28v84zM124 150V66l6-28 6 28v84zM144 150V78l6-24 6 24v72z"/><path d="M50 150h140v-6H50z"/>` },
    Germany:    { sky: ["#7f9cff", "#dbe3ff"], g: "#24346e", d: `<path d="M64 84h112v10H64zM70 94h8v56h-8zM92 94h8v56h-8zM140 94h8v56h-8zM162 94h8v56h-8zM114 94h12v56h-12z"/><path d="M104 84l16-16 16 16z"/><path d="M50 150h140v-6H50z"/>` },
    Poland:     { sky: ["#ff8fa3", "#ffe0e6"], g: "#7a1f33", d: `<path d="M110 150V58h20v92z"/><path d="M106 58l14-22 14 22z"/><path d="M76 150v-40h28v40zM136 150v-40h28v40z"/><path d="M50 150h140v-6H50z"/>` },
    Hungary:    { sky: ["#ffb96b", "#ffe7c4"], g: "#7a3c12", d: `<path d="M60 150v-30h120v30z"/><path d="M96 120a24 24 0 0 1 48 0z"/><path d="M118 96V78h4v18z"/><path d="M68 120V96l6-10 6 10v24zM160 120V96l6-10 6 10v24z"/><path d="M40 150h160v-6H40z"/>` },
    "Costa Rica": { sky: ["#54c48b", "#d5f5e3"], g: "#1d6b43", d: `<path d="M60 150l50-70 30 30 14-12 36 52z"/><path d="M150 150v-50" stroke="#1d6b43" stroke-width="4"/><path d="M150 100q-20 0-28 10q14-4 28-6q14 2 28 6q-8-10-28-10z"/>` },
    UAE:        { sky: ["#ffc46b", "#fff0cf"], g: "#7a5212", d: `<path d="M114 150V60l6-36 6 36v90z"/><path d="M100 150v-50h14v50zM126 150v-64h14v64z"/><path d="M60 150v-30h20v30zM160 150v-40h20v40z"/>` },
    Singapore:  { sky: ["#ff6f91", "#ffd6e1"], g: "#7a1e3b", d: `<path d="M80 150V82h14v68zM113 150V76h14v74zM146 150V82h14v68z"/><path d="M74 76h92q4 0 4 4v4H70v-4q0-4 4-4z"/><path d="M50 150h140v-6H50z"/>` },
    Colombia:   { sky: ["#f9c74f", "#fff1c4"], g: "#2d6a4f", d: `<path d="M40 150l40-50 30 30 30-44 60 64z"/><path d="M118 150v-26h12v26z" fill="#fff1c4"/>` },
    Brazil:     { sky: ["#2ec4b6", "#cff6f1"], g: "#145b55", d: `<path d="M70 150q20-70 50-70t50 70z"/><path d="M118 80V56h4v24zM104 64h32v4h-32z"/>` },
  };
  const ALIAS = { "United Arab Emirates": "UAE", Dubai: "UAE", Korea: "South Korea", Czechia: "Poland", "Czech Republic": "Poland", Portugal: "Spain", Greece: "Spain", Vietnam: "Thailand", Philippines: "Malaysia", Lithuania: "Poland", Croatia: "Hungary", Israel: "UAE", Taiwan: "South Korea", Japan: "South Korea" };
  function art(country, city) {
    const k = P[country] ? country : P[ALIAS[country]] ? ALIAS[country] : null;
    const p = k ? P[k] : { sky: ["#8ea2ff", "#e3e8ff"], g: "#2643d6", d: `<path d="M60 150v-50h20v50zM86 150V80h22v70zM114 150V60h18v90zM138 150V90h20v60zM164 150v-36h16v36z"/><path d="M50 150h140v-6H50z"/>` };
    const id = "s" + Math.random().toString(36).slice(2, 8);
    return `<svg viewBox="0 0 240 170" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration of ${String(city || country).replace(/[<&"]/g, "")}">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient></defs>
      <rect width="240" height="170" fill="url(#${id})"/>
      <circle cx="190" cy="44" r="18" fill="#fff" opacity=".55"/>
      <path d="M0 132q60-14 120-4t120-6v48H0z" fill="${p.g}" opacity=".18"/>
      <g fill="${p.g}">${p.d}</g>
      <rect y="150" width="240" height="20" fill="${p.g}" opacity=".9"/>
    </svg>`;
  }
  window.Places = { art, has: (c) => !!(P[c] || ALIAS[c]) };
})();
