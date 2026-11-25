/* Deal Sourcing tab (unchanged features from the original agent) */
(function(){
const {ask,esc,safeUrl,store,toast,download,copy}=App;
const $=(id)=>document.getElementById(id);
const PILLARS=[["strategic","Strategic fit"],["capacity","Financial capacity"],["accretion","Value accretion"],["synergy","Synergies"],["regulatory","Regulatory ease"],["cultural","Cultural fit"],["precedent","Deal precedent"],["timing","Timing"]];
const PRESETS={strategic:[22,10,12,18,12,10,8,8],pe:[10,24,16,6,8,6,14,16],flat:[12,12,12,12,12,12,12,12]};
const STAGES=[["Profile agent","Reads the company"],["Sourcing agent","Builds the universe"],["Scoring agent","Scores 8 pillars"],["Memo agent","Drafts the memo"]];
let mode="buyers",W=PRESETS.flat.slice(),S=null,busy=false,picked=new Set(),short=new Set(store.get("ds_short",[]));


/* ---------- controls ---------- */
document.querySelectorAll("#searchForm .seg button").forEach(b=>b.onclick=()=>{mode=b.dataset.m;document.querySelectorAll("#searchForm .seg button").forEach(x=>x.setAttribute("aria-pressed",x===b));$("co").placeholder=mode==="buyers"?"e.g. Ipsen, Believe, Doctolib…":"Acquirer, e.g. Siemens Healthineers"});
function drawW(){$("weights").innerHTML=PILLARS.map((p,i)=>`<label class="w"><span>${p[1]}</span><span>${W[i]}</span><input type="range" min="0" max="40" value="${W[i]}" data-i="${i}" aria-label="${p[1]} weight"></label>`).join("")}
$("weights").oninput=e=>{const i=e.target.dataset.i;if(i==null)return;W[i]=+e.target.value;e.target.previousElementSibling.textContent=e.target.value;render()};
document.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{W=PRESETS[b.dataset.p].slice();drawW();render()});
drawW();
document.querySelectorAll("[data-ex]").forEach(b=>b.onclick=()=>{const[c,m]=b.dataset.ex.split("|");$("co").value=c;document.querySelector(`#searchForm .seg [data-m="${m}"]`).click();run()});
$("searchForm").onsubmit=e=>{e.preventDefault();run()};
function hist(){const h=store.get("ds_hist",[]);$("histCard").hidden=!h.length;$("hist").innerHTML=h.map(x=>`<button class="chip" data-h="${esc(x.c)}|${x.m}">${esc(x.c)}${x.m==="targets"?" · targets":""}</button>`).join("")}
$("hist").onclick=e=>{const b=e.target.closest("[data-h]");if(!b)return;const[c,m]=b.dataset.h.split("|");$("co").value=c;document.querySelector(`#searchForm .seg [data-m="${m}"]`).click();run()};
hist();

/* ---------- pipeline UI ---------- */
function pipe(active,done){$("pipe").innerHTML=STAGES.map((s,i)=>`<div class="stage ${i<done?"done":i===active?"run":""}"><span class="dot"></span><b>${s[0]}</b><small>${i===active?"Working…":i<done?"Done":s[1]}</small></div>`).join("")}
pipe(-1,0);
function log(t){const l=$("log");l.hidden=false;const d=document.createElement("div");d.textContent=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})+"  "+t;l.appendChild(d);l.scrollTop=l.scrollHeight}
function err(m,retry){$("msg").innerHTML=`<div class="err" role="alert"><span>${esc(m)}</span>${retry?'<button class="btn sm" id="retry">Try again</button>':""}</div>`;const r=$("retry");if(r)r.onclick=run}

/* ---------- run ---------- */
async function run(){
  if(busy)return;const co=$("co").value.trim();if(!co){$("co").focus();toast("Type a company name first");return}
  busy=true;$("run").disabled=true;$("msg").innerHTML="";$("log").innerHTML="";picked.clear();
  const buyers=mode==="buyers",ctry=$("ctry").value,bt=$("btype").value,size=$("size").value,notes=$("notes").value.trim();
  S={co,mode,profile:null,cands:[],sel:0,memo:null,sources:[]};
  $("out").innerHTML='<div class="card pad"><div class="sk" style="height:110px"></div><div class="sk" style="height:260px;margin-top:14px"></div></div>';
  document.getElementById("s-app").scrollIntoView({behavior:"smooth"});
  const h=store.get("ds_hist",[]).filter(x=>!(x.c.toLowerCase()===co.toLowerCase()&&x.m===mode));h.unshift({c:co,m:mode});store.set("ds_hist",h.slice(0,6));hist();
  const addSrc=s=>s.forEach(x=>{if(safeUrl(x.url)&&!S.sources.find(y=>y.url===x.url))S.sources.push(x)});
  try{
    pipe(0,0);log(`Profile agent: searching the web for ${co}`);
    let r=await ask(`You are a senior European M&A analyst. Company: "${co}". Use the live web results if given; otherwise only facts you are confident about. If you do not recognise it, say so and set confidence "low".
Return ONLY JSON: {"profile":{"name":"","hq":"","sector":"","subsector":"","revenue":"approx. latest revenue, labelled approx.","ownership":"listed|PE-backed|family|state|private|unknown","summary":"max 40 words","why_attractive":"max 25 words","facts":["3 short facts"],"confidence":"high|medium|low"}}`,`${co} company profile revenue ownership`);
    S.profile=r.data.profile;addSrc(r.sources);log(`Profile agent: read ${r.sources.length} sources, done`);render();
    pipe(1,1);log(`Sourcing agent: building the ${buyers?"buyer":"target"} universe`);
    r=await ask(`European M&A sourcing agent. ${buyers?"Find the 8 most plausible BUYERS for":"Find the 8 most plausible ACQUISITION TARGETS for the acquirer"} "${co}". Profile: ${JSON.stringify(S.profile)}.
Constraints: region ${ctry||"all of Europe"}; counterparties ${bt==="pe"?"private equity only":bt==="strategic"?"strategic only":"mix of strategic and private equity"}; deal size ${size||"any"}; notes: ${notes||"none"}. Do not invent past deals: if none known write "none known".
Return ONLY JSON: {"candidates":[{"name":"","type":"strategic|PE|infra|sovereign|family","hq":"","rationale":"max 26 words","precedent":"max 18 words","capacity":"EV capacity range"}]} with exactly 8 items.`,`${co} ${buyers?"potential acquirers buyers M&A":"acquisition targets strategy"} ${ctry}`);
    S.cands=r.data.candidates||[];addSrc(r.sources);log(`Sourcing agent: found ${S.cands.length} counterparties`);render();
    pipe(2,2);log("Scoring agent: rating 8 pillars for each name");
    r=await ask(`European M&A scoring agent. Score each candidate from 0 to 100 on eight pillars (regulatory: higher = easier antitrust/FDI). Subject: ${co} (${buyers?"seller":"acquirer"}). Candidates: ${JSON.stringify(S.cands.map(c=>({name:c.name,type:c.type,rationale:c.rationale})))}.
Return ONLY JSON: {"scored":[{"name":"","scores":{"strategic":0,"capacity":0,"accretion":0,"synergy":0,"regulatory":0,"cultural":0,"precedent":0,"timing":0},"thesis":"max 24 words","risk":"max 18 words"}]}. Spread the scores; do not cluster.`);
    S.cands.forEach((c,i)=>{const s=(r.data.scored||[]).find(x=>x.name===c.name)||(r.data.scored||[])[i];if(s){c.scores=s.scores;c.thesis=s.thesis;c.risk=s.risk}});
    log("Scoring agent: done. Click a row to inspect, or draft the memo.");pipe(-1,3);render();
  }catch(e){pipe(-1,S.cands.length?2:S.profile?1:0);err(e.message||"Something went wrong.",true);if(!S.profile)$("out").innerHTML=""}
  busy=false;$("run").disabled=false;
}

/* ---------- render ---------- */
const total=c=>{const s=W.reduce((a,b)=>a+b,0)||1;return PILLARS.reduce((a,p,i)=>a+W[i]*((c.scores||{})[p[0]]||0),0)/s};
const heat=v=>`background:rgba(59,47,201,${(.08+Math.max(0,Math.min(100,v))/100*.62).toFixed(2)});color:${v>58?"#fff":"var(--ink)"}`;
function render(){
  if(!S||!S.profile)return;const p=S.profile;
  let h=`<div class="card pad rv in"><div class="profile"><div><p class="eyebrow">${S.mode==="buyers"?"Target":"Acquirer"} profile</p><h2>${esc(p.name)}</h2><p style="margin:6px 0 0;color:var(--ink-2)">${esc(p.summary)}</p></div><span class="tag ${p.confidence==="high"?"green":p.confidence==="low"?"red":"amber"}">Confidence: ${esc(p.confidence)}</span></div>
  <div class="kv"><div><small>HQ</small><b>${esc(p.hq)}</b></div><div><small>Sector</small><b>${esc(p.sector)}${p.subsector?" · "+esc(p.subsector):""}</b></div><div><small>Revenue · ownership</small><b>${esc(p.revenue)} · ${esc(p.ownership)}</b></div></div>
  ${p.why_attractive?`<p style="margin:12px 0 0;font-size:14px"><b>Why it's interesting:</b> ${esc(p.why_attractive)}</p>`:""}
  <div class="facts">${(p.facts||[]).map(f=>`<span class="tag">${esc(f)}</span>`).join("")}</div></div>`;
  const cs=S.cands.slice();const scored=cs.length&&cs.every(c=>c.scores);
  if(cs.length){
    if(scored)cs.sort((a,b)=>total(b)-total(a));
    h+=`<div class="card pad" style="margin-top:16px"><div class="bar"><h3 style="font-size:18px">${S.mode==="buyers"?"Buyer":"Target"} universe</h3><span class="sp"></span>
      ${scored?`<button class="btn sm" id="cmpBtn" ${picked.size<2?"disabled":""}>Compare (${picked.size})</button><button class="btn sm" id="csv">Export CSV</button>`:""}</div>
      <div class="tbl"><table><thead><tr>${scored?'<th></th>':''}<th>#</th><th>Counterparty</th><th>Type</th>${scored?PILLARS.map(p=>`<th title="${p[1]}">${p[1].split(" ")[0]}</th>`).join("")+"<th>Score</th><th></th>":"<th>Why</th>"}</tr></thead><tbody>`;
    cs.forEach((c,i)=>{const k=S.cands.indexOf(c);h+=`<tr class="row ${k===S.sel?"sel":""}" data-k="${k}">${scored?`<td><input type="checkbox" class="cb" data-pick="${k}" ${picked.has(k)?"checked":""} aria-label="Select ${esc(c.name)} to compare"></td>`:""}<td class="mono">${i+1}</td><td><b>${esc(c.name)}</b><div style="color:var(--ink-3);font-size:12px">${esc(c.hq)}</div></td><td><span class="tag ${/pe|infra|sovereign/i.test(c.type)?"amber":"blue"}">${esc(c.type)}</span></td>${scored?PILLARS.map(p=>`<td><span class="sc" style="${heat(c.scores[p[0]])}">${Math.round(c.scores[p[0]]||0)}</span></td>`).join("")+`<td><div class="tot">${total(c).toFixed(0)}</div><div class="meter"><i style="width:${total(c)}%"></i></div></td><td><button class="star" data-star="${esc(c.name)}" aria-pressed="${short.has(c.name)}" aria-label="Shortlist ${esc(c.name)}">★</button></td>`:`<td style="color:var(--ink-2)">${esc(c.rationale)}</td>`}</tr>`});
    h+="</tbody></table></div></div>";
    const c=S.cands[S.sel];
    if(scored&&c){h+=`<div class="detail"><div class="card pad"><p class="eyebrow">Selected</p><h3>${esc(c.name)}</h3><div class="k">Thesis</div>${esc(c.thesis)}<div class="k">Why it fits</div>${esc(c.rationale)}<div class="k">Precedent</div>${esc(c.precedent)}<div class="k">Capacity</div>${esc(c.capacity)}<div class="k">Main risk</div>${esc(c.risk)}
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-dd="${esc(S.mode==="buyers"?S.profile.name:c.name)}">Run full due diligence →</button><button class="btn primary" id="mk">${S.memo&&S.memo.c===c.name?"Redraft memo":"Draft deal memo"} →</button></div></div>
      <div class="card pad">${radar(c)}${S.sources.length?`<div class="k" style="margin-top:6px">Sources read (${S.sources.length})</div><div class="srcs">${S.sources.slice(0,8).map(s=>`<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(String(s.title).slice(0,70))}</a>`).join("")}</div>`:""}</div></div>`}
  }
  if(S.memo)h+=memoHtml(S.memo);
  $("out").innerHTML=h;
}
function radar(c){const n=8,R=82,cx=120,cy=108,pt=(i,v)=>{const a=-Math.PI/2+i*2*Math.PI/n,r=R*v/100;return[cx+r*Math.cos(a),cy+r*Math.sin(a)]};
  let g="";[25,50,75,100].forEach(l=>g+=`<polygon fill="none" stroke="#e2ded4" points="${PILLARS.map((_,i)=>pt(i,l).join(",")).join(" ")}"/>`);
  PILLARS.forEach((p,i)=>{const[x,y]=pt(i,122);g+=`<text x="${x}" y="${y}" font-size="9" text-anchor="middle" fill="#6b7385" font-family="Inter">${p[1].split(" ")[0]}</text>`});
  g+=`<polygon fill="rgba(59,47,201,.18)" stroke="#3b2fc9" stroke-width="2" points="${PILLARS.map((p,i)=>pt(i,c.scores[p[0]]||0).join(",")).join(" ")}"/>`;
  return `<svg viewBox="0 0 240 220" width="100%" role="img" aria-label="Pillar profile of ${esc(c.name)}">${g}</svg>`}
function memoHtml(x){const m=x.m,L=a=>"<ul>"+(a||[]).map(i=>`<li>${esc(i)}</li>`).join("")+"</ul>";
  return `<div class="card pad memo" style="margin-top:16px" id="memo"><div class="bar"><p class="eyebrow">Preliminary memo · ${esc(x.c)}</p><span class="sp"></span><button class="btn sm" id="cp">Copy</button><button class="btn sm" id="dl">Download .md</button></div><h2>${esc(m.headline)}</h2>
  <h3>Situation</h3><p>${esc(m.situation)}</p><h3>Rationale</h3>${L(m.rationale)}<h3>Valuation view</h3><p>${esc(m.valuation)}</p><h3>Synergies</h3>${L(m.synergies)}<h3>Risks</h3>${L(m.risks)}<h3>Structure</h3><p>${esc(m.structure)}</p><h3>Diligence priorities</h3>${L(m.diligence)}<h3>Next steps</h3>${L(m.next_steps)}
  <p style="color:var(--ink-3);font-size:12px;margin-top:16px">AI-generated first draft from public sources. Check every figure before use.</p></div>`}
function memoText(){const x=S.memo,m=x.m,L=a=>(a||[]).map(i=>"- "+i).join("\n");return `# ${m.headline}\n\nCounterparty: ${x.c}\n\n## Situation\n${m.situation}\n\n## Rationale\n${L(m.rationale)}\n\n## Valuation view\n${m.valuation}\n\n## Synergies\n${L(m.synergies)}\n\n## Risks\n${L(m.risks)}\n\n## Structure\n${m.structure}\n\n## Diligence priorities\n${L(m.diligence)}\n\n## Next steps\n${L(m.next_steps)}\n\n---\nDraft by Deal Sourcing Agent (aryanskothari.vercel.app). AI-generated, verify before use.\n`}

/* ---------- interactions ---------- */
$("out").addEventListener("click",async e=>{
  const st=e.target.closest("[data-star]");if(st){const n=st.dataset.star;short.has(n)?short.delete(n):short.add(n);store.set("ds_short",[...short]);st.setAttribute("aria-pressed",short.has(n));toast(short.has(n)?n+" added to shortlist":n+" removed");return}
  if(e.target.closest("[data-pick]"))return;
  const r=e.target.closest("tr.row");if(r){S.sel=+r.dataset.k;render();return}
  const dd=e.target.closest("[data-dd]");if(dd){window.DD&&DD.goCompany(dd.dataset.dd,S.mode==="buyers"?S.cands[S.sel].name:S.profile.name);return}
  if(e.target.id==="mk")return memo();
  if(e.target.id==="cp")return copy(memoText(),"Memo copied");
  if(e.target.id==="dl")return download(`deal-memo-${S.co.replace(/\W+/g,"-").toLowerCase()}.md`,memoText(),"text/markdown");
  if(e.target.id==="csv"){const rows=[["Rank","Counterparty","Type","HQ",...PILLARS.map(p=>p[1]),"Weighted score","Thesis","Risk"]];S.cands.slice().sort((a,b)=>total(b)-total(a)).forEach((c,i)=>rows.push([i+1,c.name,c.type,c.hq,...PILLARS.map(p=>Math.round(c.scores[p[0]]||0)),total(c).toFixed(1),c.thesis,c.risk]));return download(`deal-universe-${S.co.replace(/\W+/g,"-").toLowerCase()}.csv`,rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n"),"text/csv")}
  if(e.target.id==="cmpBtn")return compare();
});
$("out").addEventListener("change",e=>{const p=e.target.dataset.pick;if(p==null)return;const k=+p;if(e.target.checked){if(picked.size>=3){e.target.checked=false;toast("Compare up to 3 at a time");return}picked.add(k)}else picked.delete(k);const b=$("cmpBtn");if(b){b.disabled=picked.size<2;b.textContent=`Compare (${picked.size})`}});
async function memo(){
  const c=S.cands[S.sel],b=$("mk");b.disabled=true;b.textContent="Memo agent working…";pipe(3,3);log(`Memo agent: drafting ${c.name} × ${S.profile.name}`);
  try{const r=await ask(`You are the memo agent of a European M&A team. Write a concise preliminary deal memo. ${S.mode==="buyers"?`Buyer: ${c.name}. Target: ${S.profile.name}`:`Acquirer: ${S.profile.name}. Target: ${c.name}`}. Target profile: ${JSON.stringify(S.profile)}. Counterparty notes: ${JSON.stringify({rationale:c.rationale,precedent:c.precedent,capacity:c.capacity,risk:c.risk,scores:c.scores})}. Label every figure as an estimate. Do not invent facts.
Return ONLY JSON: {"headline":"","situation":"max 50 words","rationale":["3-4 bullets"],"valuation":"methods and a rough multiple range, flagged indicative","synergies":["3 bullets"],"risks":["4 bullets incl. antitrust/FDI"],"structure":"max 40 words","diligence":["5 questions"],"next_steps":["4 bullets"]}`,`${c.name} ${S.profile.name} acquisition`);
    S.memo={c:c.name,m:r.data};r.sources.forEach(x=>{if(safeUrl(x.url)&&!S.sources.find(y=>y.url===x.url))S.sources.push(x)});pipe(-1,4);log("Memo agent: done");render();$("memo").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){pipe(-1,3);err(e.message||"The memo failed.",false);b.disabled=false;b.textContent="Draft deal memo →"}
}
function compare(){
  const cs=[...picked].map(k=>S.cands[k]),cols=["#3b2fc9","#c8962e","#b8860b"];
  $("dTitle").textContent="Compare "+cs.length+" counterparties";
  $("dBody").innerHTML=`<div class="cmp" style="--n:${cs.length}"><div class="cmp-row"><span></span>${cs.map((c,i)=>`<b style="color:${cols[i]}">${esc(c.name)}</b>`).join("")}</div>
  ${PILLARS.map(p=>`<div class="cmp-row"><span>${p[1]}</span>${cs.map((c,i)=>`<div><div class="b"><i style="width:${c.scores[p[0]]}%;background:${cols[i]}"></i></div><small class="mono">${Math.round(c.scores[p[0]])}</small></div>`).join("")}</div>`).join("")}
  <div class="cmp-row" style="border-top:1px solid var(--rule);padding-top:12px"><b>Weighted</b>${cs.map((c,i)=>`<b style="font-size:20px;color:${cols[i]}">${total(c).toFixed(0)}</b>`).join("")}</div>
  <div class="cmp-row"><span>Thesis</span>${cs.map(c=>`<small>${esc(c.thesis)}</small>`).join("")}</div><div class="cmp-row"><span>Main risk</span>${cs.map(c=>`<small>${esc(c.risk)}</small>`).join("")}</div></div>`;
  $("drawer").classList.add("on");document.querySelector("#drawer .x").focus();
}



})();
