"use strict";
/* ================= UI (DOM + eventos) =================
   Depende de engine.js, que se carga antes. */
const PIPMAP={0:[],1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,4,7,3,6,9]};
const ROLE={0:"TÚ",1:"RD",2:"CO",3:"RI"};

function halfHTML(n){const on=new Set(PIPMAP[n]);let c="";for(let i=1;i<=9;i++)c+=`<span class="pip ${on.has(i)?'on':''}"></span>`;return `<span class="half">${c}</span>`;}
function tileHTML(a,b,cls=""){return `<span class="domino ${cls}">${halfHTML(a)}<span class="divider"></span>${halfHTML(b)}</span>`;}
function tileK(k,cls=""){const t=kt(k);return tileHTML(t[0],t[1],cls+(t[0]===t[1]?" vert":""));}

const $=s=>document.querySelector(s);
const SCREENS=['liveSetup','liveGame','liveResult','simDeal','simGame','simResult','simBulk'];
function show(id){SCREENS.forEach(s=>document.getElementById(s).classList.toggle('hidden',s!==id));window.scrollTo(0,0);}
// la mesa es la pantalla de entrada y de salida: volver = mesa vacía (idle)
function goTable(){analisis=null;partidaAbierta=null;GS=null;simIdle();show('simGame');}
document.querySelectorAll('[data-mesa]').forEach(b=>b.onclick=goTable);
document.querySelectorAll('[data-simdeal]').forEach(b=>b.onclick=()=>{simDealInit();show('simDeal');});
$("#tbLive").onclick=()=>{liveRestart();show('liveSetup');};

let toastT=null;
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),1400);}

/* ============================================================
   MODO 1 · ASISTENTE EN VIVO  (solo conoces tu mano)
   ============================================================ */
let LS=null; const L_PARTNER=2,L_OPPS=[1,3],L_OTHERS=[1,2,3];
let liveSel=new Set(), liveStarter=null;

function buildPicker(){
  const grid=$("#pickGrid");grid.innerHTML="";
  allTiles().forEach(t=>{
    const k=key(t[0],t[1]);const d=document.createElement("div");d.className="pick";d.dataset.k=k;
    d.innerHTML=tileHTML(t[0],t[1]);
    d.onclick=()=>{
      if(liveSel.has(k)){liveSel.delete(k);d.classList.remove("sel");}
      else{if(liveSel.size>=7){toast("Ya elegiste 7");return;}liveSel.add(k);d.classList.add("sel");}
      $("#selCount").textContent=liveSel.size;liveUpdateStart();
      grid.querySelectorAll(".pick").forEach(el=>el.classList.toggle("dis",liveSel.size>=7&&!liveSel.has(el.dataset.k)));
    };
    grid.appendChild(d);
  });
}
function liveUpdateStart(){$("#startBtn").disabled=!(liveSel.size===7&&liveStarter!==null);}
$("#seatPick").querySelectorAll("button").forEach(b=>b.onclick=()=>{
  $("#seatPick").querySelectorAll("button").forEach(x=>x.classList.remove("sel"));
  b.classList.add("sel");liveStarter=+b.dataset.seat;liveUpdateStart();
});
$("#startBtn").onclick=()=>{
  const unseen=new Set(allTiles().map(t=>key(t[0],t[1])));liveSel.forEach(k=>unseen.delete(k));
  LS={hand:new Set(liveSel),ends:null,sequence:[],unseen,remaining:{1:7,2:7,3:7},
      forbidden:{1:new Set(),2:new Set(),3:new Set()},current:liveStarter,passes:0,history:[],over:false,hist:[]};
  liveMarca=null;
  show('liveGame');liveRender();
};
function liveRestart(){liveSel=new Set();liveStarter=null;LS=null;$("#selCount").textContent="0";
  $("#seatPick").querySelectorAll("button").forEach(x=>x.classList.remove("sel"));$("#startBtn").disabled=true;buildPicker();}
$("#undoBtn").onclick=()=>{if(!LS.history.length){toast("Nada que deshacer");return;}liveRestore(LS.history.pop());liveRender();};

let liveMarca=null;                       // CPP / SPP / null ("no vi") para la proxima jugada ajena
function liveSnap(){return JSON.stringify({hand:[...LS.hand],ends:LS.ends,sequence:LS.sequence,unseen:[...LS.unseen],hist:(LS.hist||[]).slice(),
  remaining:{...LS.remaining},forbidden:{1:[...LS.forbidden[1]],2:[...LS.forbidden[2]],3:[...LS.forbidden[3]]},current:LS.current,passes:LS.passes,over:LS.over});}
function livePush(){LS.history.push(liveSnap());if(LS.history.length>60)LS.history.shift();}
function liveRestore(s){const o=JSON.parse(s);LS.hand=new Set(o.hand);LS.ends=o.ends;LS.sequence=o.sequence;LS.unseen=new Set(o.unseen);
  LS.remaining=o.remaining;LS.forbidden={1:new Set(o.forbidden[1]),2:new Set(o.forbidden[2]),3:new Set(o.forbidden[3])};LS.current=o.current;LS.passes=o.passes;LS.over=o.over;LS.hist=o.hist||[];}

function liveSuggest(numProb){
  const moves=legalMoves([...LS.hand],LS.ends);
  moves.forEach(m=>{const t=kt(m.k);const[e0,e1]=m.newEnds;let oppT=0,pH=0;
    if(numProb){for(const v of[e0,e1])oppT+=(numProb[L_OPPS[0]][v]+numProb[L_OPPS[1]][v])/2;pH=numProb[L_PARTNER][e0]+numProb[L_PARTNER][e1];}
    m.score=(-1.0*oppT)+(0.5*pH)+(0.12*pip(t))+(isDouble(t)?0.6:0);m.oppT=oppT;m.pH=pH;
    const r=[];if(numProb){r.push(`rivales enganchan ~${Math.round(oppT/2*100)}%`);r.push(`tu compa ~${Math.round(pH/2*100)}%`);}
    if(isDouble(t))r.push("suelta un doble");if(pip(t)>=9)r.push("ficha pesada");m.reason=r.join(" · ");
  });
  moves.sort((a,b)=>b.score-a.score);return moves;
}
function liveRender(){
  if(LS.over)return;const cur=LS.current;const who=$("#whoTurn");
  who.innerHTML=(cur===0?`Tu turno`:cur===L_PARTNER?`Turno de tu compañero`:`Turno de rival`)+` <span class="tag tag${cur}">${ROLE[cur]}</span>`;
  const ev=$("#endsView");
  ev.innerHTML=LS.ends===null?`<div class="muted">Tablero vacío — falta la primera ficha</div>`:
    `<div class="endbox"><div class="lbl">IZQ</div><div class="val">${LS.ends[0]}</div></div><div class="muted">•••</div><div class="endbox"><div class="lbl">DER</div><div class="val">${LS.ends[1]}</div></div>`;
  $("#chainView").innerHTML=LS.sequence.map(t=>tileHTML(t[0],t[1],"sm"+(t[0]===t[1]?" vert":""))).join("");
  $("#countsView").innerHTML=`<span class="chip">Tu mano: <b>${LS.hand.size}</b></span>`+L_OTHERS.map(p=>`<span class="chip">${ROLE[p]}: <b>${LS.remaining[p]}</b></span>`).join("");
  const f=L_OTHERS.filter(p=>LS.forbidden[p].size).map(p=>`${ROLE[p]} sin ${[...LS.forbidden[p]].sort().join(",")}`);
  $("#faltasView").innerHTML=f.length?"🔎 "+f.join("  ·  "):"";
  if(cur===0)liveYourTurn();else liveOtherTurn(cur);
}
function liveYourTurn(){
  $("#analysisCard").classList.remove("hidden");
  const est=liveEstimate();const numProb=est?est.numProb:null;liveAnalysis(est);
  const moves=liveSuggest(numProb);const bestKey=moves.length?moves[0].k:null;
  const playable={};moves.forEach(m=>{(playable[m.k]=playable[m.k]||[]).push(m.side);});
  const ac=$("#actionCard");ac.innerHTML=`<h2>Tu jugada</h2>`;
  const hand=document.createElement("div");hand.className="hand";
  [...LS.hand].sort((a,b)=>pip(kt(b))-pip(kt(a))).forEach(k=>{const t=kt(k);const d=document.createElement("div");d.className="pick";
    const can=!!playable[k];d.innerHTML=tileHTML(t[0],t[1])+(k===bestKey?`<span class="star">⭐</span>`:"");
    if(!can)d.classList.add("dis");d.onclick=()=>{if(can)liveChoose(k,playable[k]);};hand.appendChild(d);});
  ac.appendChild(hand);
  const box=document.createElement("div");box.id="sideBox";ac.appendChild(box);
  const row=document.createElement("div");row.className="btnrow grow";row.style.marginTop="12px";
  const pb=document.createElement("button");pb.className="btn ghost";pb.textContent=moves.length?"No quiero / no puedo — Paso":"No tienes jugada — Paso";
  pb.onclick=()=>liveUserPass(moves.length>0);row.appendChild(pb);ac.appendChild(row);
}
function liveChoose(k,sides){
  if(LS.ends!==null&&sides.length===2){const box=$("#sideBox");
    box.innerHTML=`<div class="sidechoice"><span class="muted">${tileK(k)} ¿por qué punta?</span><button class="btn gold" data-s="I">IZQ (${LS.ends[0]})</button><button class="btn gold" data-s="D">DER (${LS.ends[1]})</button></div>`;
    box.querySelectorAll("button").forEach(b=>b.onclick=()=>livePlay(k,b.dataset.s));
  }else livePlay(k,LS.ends===null?"inicio":sides[0]);
}
function livePlay(k,side){livePush();
  (LS.hist=LS.hist||[]).push({jugador:0,ficha:k,punta:LS.ends===null?null:side,pensada:null,veredicto:null,comentario:null});
  placeOnBoard(LS,k,side);LS.unseen.delete(k);LS.hand.delete(k);LS.passes=0;toast(`Jugaste ${k}`);liveAfter();}
function liveUserPass(had){livePush();(LS.hist=LS.hist||[]).push({jugador:0,paso:true,pensada:null,veredicto:null,comentario:null});if(had&&!confirm("Sí tienes jugada legal. ¿Seguro que pasas?")){LS.history.pop();return;}LS.passes++;liveAfter();}
function liveOtherTurn(p){
  $("#analysisCard").classList.add("hidden");const ac=$("#actionCard");
  ac.innerHTML=`<h2>¿Qué hizo ${ROLE[p]}?</h2><div class="muted">Toca la ficha que jugó, o “Se pasó”.</div>`;
  const fits=[];[...LS.unseen].forEach(k=>{const t=kt(k);if(LS.ends===null)fits.push({k,sides:["inicio"]});
    else{const s=[];if(t.includes(LS.ends[0]))s.push("I");if(t.includes(LS.ends[1]))s.push("D");if(s.length)fits.push({k,sides:s});}});
  fits.sort((a,b)=>pip(kt(b.k))-pip(kt(a.k)));
  const grid=document.createElement("div");grid.className="hand";grid.style.marginTop="8px";
  fits.forEach(f=>{const t=kt(f.k);const d=document.createElement("div");d.className="pick";d.innerHTML=tileHTML(t[0],t[1]);d.onclick=()=>liveChooseOther(p,f.k,f.sides);grid.appendChild(d);});
  // ¿viste la pensada? Por defecto no: se anota null y no se inventa nada.
  const mb=document.createElement("div");mb.className="btnrow grow";mb.style.marginTop="10px";
  mb.innerHTML=`<div class="muted" style="width:100%;font-size:.75rem;margin-bottom:4px">¿Con qué pensada la jugó?</div>`+
    ["CPP","SPP","no vi"].map(v=>{const val=(v==="no vi")?"":v;
      return `<button class="btn ${((liveMarca||"")===val)?"gold":"ghost"}" data-marca="${val}" style="padding:7px 10px;font-size:.8rem">${v}</button>`;}).join("");
  mb.querySelectorAll("[data-marca]").forEach(b=>b.onclick=()=>{liveMarca=b.dataset.marca||null;liveOtherTurn(p);});
  ac.appendChild(mb);                 // primero la marca, luego se toca la ficha
  ac.appendChild(grid);
  const box=document.createElement("div");box.id="sideBox";ac.appendChild(box);
  const row=document.createElement("div");row.className="btnrow grow";row.style.marginTop="12px";
  const pb=document.createElement("button");pb.className="btn red";pb.textContent=`${ROLE[p]} se pasó`;pb.onclick=()=>liveOtherPass(p);
  row.appendChild(pb);ac.appendChild(row);
}
function liveChooseOther(p,k,sides){
  if(LS.ends!==null&&sides.length===2){const box=$("#sideBox");
    box.innerHTML=`<div class="sidechoice"><span class="muted">${tileK(k)} ¿por qué punta?</span><button class="btn gold" data-s="I">IZQ (${LS.ends[0]})</button><button class="btn gold" data-s="D">DER (${LS.ends[1]})</button></div>`;
    box.querySelectorAll("button").forEach(b=>b.onclick=()=>liveOtherPlay(p,k,b.dataset.s));
  }else liveOtherPlay(p,k,LS.ends===null?"inicio":sides[0]);
}
function liveOtherPlay(p,k,side){livePush();
  const cast=LS.ends===null?null:(side==="I"?LS.ends[0]:LS.ends[1]);
  (LS.hist=LS.hist||[]).push({jugador:p,ficha:k,punta:LS.ends===null?null:side,castiga:cast,pensada:liveMarca,veredicto:null,comentario:null});
  placeOnBoard(LS,k,side);LS.unseen.delete(k);LS.remaining[p]--;LS.passes=0;
  toast(`${ROLE[p]} jugó ${k}${liveMarca?" · "+liveMarca:""}`);liveMarca=null;liveAfter();}
function liveOtherPass(p){livePush();(LS.hist=LS.hist||[]).push({jugador:p,paso:true,pensada:null,veredicto:null,comentario:null});if(LS.ends!==null){LS.forbidden[p].add(LS.ends[0]);LS.forbidden[p].add(LS.ends[1]);}LS.passes++;toast(`${ROLE[p]} se pasó`);liveAfter();}
function liveAfter(){
  if(LS.current===0&&LS.hand.size===0)return liveEnd("Te quedaste sin fichas 🎉",0);
  if(LS.current!==0&&LS.remaining[LS.current]===0)return liveEnd(`${ROLE[LS.current]} se quedó sin fichas`,LS.current);
  if(LS.passes>=4)return liveEnd("TRANCA — nadie puede jugar",null);
  LS.current=(LS.current+1)%4;liveRender();window.scrollTo({top:0,behavior:"smooth"});
}
function heat(v){const r=Math.round(60+v*195),g=Math.round(200-v*160),b=Math.round(120-v*70);return `background:rgba(${r},${g},${b},.28)`;}
function liveAnalysis(est){
  const pt=$("#probTable"),sv=$("#sugView");
  if(!est){pt.innerHTML=`<div class="muted">Aún no hay suficiente info para estimar.</div>`;sv.innerHTML="";return;}
  const np=est.numProb;let h=`<div class="muted">Prob. de que cada jugador pueda jugar cada número:</div><table><tr><th></th>`;
  for(let v=0;v<=6;v++)h+=`<th>${v}</th>`;h+=`</tr>`;
  L_OTHERS.forEach(p=>{h+=`<tr><td class="name ${p===L_PARTNER?"compa":"rival"}">${ROLE[p]}${p===L_PARTNER?" 🤝":""}</td>`;
    for(let v=0;v<=6;v++){const x=np[p][v];h+=`<td class="heat" style="${heat(x)}">${Math.round(x*100)}</td>`;}h+=`</tr>`;});
  h+=`</table>`;pt.innerHTML=h;
  const moves=liveSuggest(np);
  if(!moves.length){sv.innerHTML=`<div class="sug"><b>No tienes jugada legal.</b> Te toca pasar.</div>`;return;}
  const b=moves[0];const et=b.side==="inicio"?"":` por <b>${b.side==="I"?"IZQ":"DER"}</b>`;
  let s=`<div class="sug"><div class="top"><span>⭐ Mejor jugada:</span> ${tileK(b.k)} ${et}<span class="muted">→ deja puntas [${b.newEnds.join(" · ")}]</span></div><div class="reason">${b.reason}</div>`;
  if(moves.length>1)s+=`<div class="alt">Alternativas: `+moves.slice(1,3).map(m=>tileK(m.k,"sm")+(m.side==="inicio"?"":` (${m.side})`)).join(" &nbsp; ")+`</div>`;
  sv.innerHTML=s+`</div>`;
}
function liveEnd(motivo,winner){
  LS.over=true;const tuPts=[...LS.hand].reduce((s,k)=>s+pip(kt(k)),0);
  let h=`<div><b>${motivo}</b></div><div>Puntos en tu mano: <b>${tuPts}</b></div>`;
  const est=liveEstimate(1500);
  if(est){h+=`<div style="margin-top:8px" class="muted">Puntos estimados en mano de los demás:</div>`;
    L_OTHERS.forEach(p=>{let e=0;[...LS.unseen].forEach(k=>e+=pip(kt(k))*est.tileProbByKey[k][p]);h+=`<div>${ROLE[p]}: ~${Math.round(e)} pts</div>`;});}
  if(winner!==null){const mine=(winner===0||winner===L_PARTNER);
    h+=`<div style="margin-top:10px" class="${mine?'win':'lose'}">Domino de ${ROLE[winner]} → gana ${mine?"TU PAREJA (tú + CO) 🎉":"la pareja rival"}.</div>`;
  }else h+=`<div style="margin-top:10px" class="muted">Tranca: gana la pareja con menos puntos sumados en mano.</div>`;
  $("#resultView").innerHTML=h;show('liveResult');
}

/* ============================================================
   MODO 2 · SIMULADOR (las 4 manos conocidas)
   ============================================================ */
let owner={}; // key -> playerIdx
let selOwner=0, simStarter=null;
let simDealMode="manual";
let GS=null;

function simDealInit(){
  // no borrar si ya hay reparto en curso; init sólo si vacío
  if(Object.keys(owner).length===0){ buildOwnerGrid(); }
  refreshOwner();
}
function buildOwnerGrid(){
  const g=$("#ownerGrid");g.innerHTML="";
  allTiles().forEach(t=>{const k=key(t[0],t[1]);const d=document.createElement("div");d.className="pick";d.dataset.k=k;
    d.innerHTML=tileHTML(t[0],t[1])+`<span class="owner"></span>`;
    d.onclick=()=>{
      simDealMode="manual";
      if(owner[k]===selOwner){delete owner[k];}
      else{const cnt=Object.values(owner).filter(v=>v===selOwner).length;if(cnt>=7){toast(`${ROLE[selOwner]} ya tiene 7`);return;}owner[k]=selOwner;}
      refreshOwner();
    };
    g.appendChild(d);
  });
}
$("#ownerPick").querySelectorAll("button").forEach(b=>b.onclick=()=>{selOwner=+b.dataset.p;
  $("#ownerPick").querySelectorAll("button").forEach(x=>x.classList.remove("sel"));b.classList.add("sel");});
$("#ownerPick").querySelector('button[data-p="0"]').classList.add("sel");
function refreshOwner(){
  $("#ownerGrid").querySelectorAll(".pick").forEach(el=>{
    const k=el.dataset.k;const ow=el.querySelector(".owner");ow.className="owner";
    if(owner[k]!==undefined)ow.classList.add("own"+owner[k]);
  });
  const cnt=[0,0,0,0];Object.values(owner).forEach(v=>cnt[v]++);
  for(let p=0;p<4;p++)$("#ownerPick span[data-c='"+p+"']").textContent=cnt[p];
  // detectar doble 6 -> salidor por defecto (si no elegido manualmente)
  const d6=owner["6-6"];
  if(d6!==undefined){setSimStarter(d6,true);}
  const complete=cnt.every(c=>c===7);
  const ready=complete&&simStarter!==null;
  $("#simPlay").disabled=!ready;
  $("#saveDeal").disabled=!ready;
}
$("#saveDeal").onclick=()=>doSave(posFromDeal(),"Reparto "+nowISO());
function setSimStarter(p,auto){
  simStarter=p;$("#simSeatPick").querySelectorAll("button").forEach(b=>b.classList.toggle("sel",+b.dataset.seat===p));
}
$("#simSeatPick").querySelectorAll("button").forEach(b=>b.onclick=()=>{setSimStarter(+b.dataset.seat,false);refreshOwner();});
$("#dealRandom").onclick=()=>{owner={};simDealMode="aleatoria";const t=shuffle(allTiles().map(x=>key(x[0],x[1])));t.forEach((k,i)=>owner[k]=Math.floor(i/7));refreshOwner();toast("Repartido al azar");};
$("#dealFill").onclick=()=>{
  const cnt=[0,0,0,0];Object.values(owner).forEach(v=>cnt[v]++);
  const free=shuffle(allTiles().map(x=>key(x[0],x[1])).filter(k=>owner[k]===undefined));
  free.forEach(k=>{for(let p=0;p<4;p++)if(cnt[p]<7){owner[k]=p;cnt[p]++;break;}});refreshOwner();
};
$("#dealClear").onclick=()=>{owner={};simStarter=null;$("#simSeatPick").querySelectorAll("button").forEach(b=>b.classList.remove("sel"));refreshOwner();};
$("#simPlay").onclick=()=>{startSimGame();};
$("#simBulkBtn").onclick=()=>{bulkSource="global";bulkUI();show('simBulk');};

/* ---- juego paso a paso (manual + IA) ---- */
function startSimGame(){
  const hands=[0,1,2,3].map(p=>new Set(Object.keys(owner).filter(k=>owner[k]===p)));
  GS={hands,ends:null,sequence:[],current:simStarter,passes:0,over:false,history:[],log:[],hist:[]};
  GS.initial=simSnap();
  show('simGame');simRender();
}
function simSnap(){return JSON.stringify({hands:GS.hands.map(s=>[...s]),ends:GS.ends,sequence:GS.sequence,current:GS.current,passes:GS.passes,over:GS.over,log:GS.log.slice(),hist:GS.hist.slice()});}
function simPush(){GS.history.push(simSnap());if(GS.history.length>400)GS.history.shift();}
function simRestore(s){sugeridaK=null;const o=JSON.parse(s);GS.hands=o.hands.map(a=>new Set(a));GS.ends=o.ends;GS.sequence=o.sequence;GS.current=o.current;GS.passes=o.passes;GS.over=o.over;GS.log=o.log;GS.hist=o.hist||[];GS.lastKey=null;}
function simUndo(){if(!GS||!GS.history.length){toast("Estás al inicio");return;}simRestore(GS.history.pop());GS.over=false;show('simGame');simRender();}
function simToStart(){if(!GS){return;}if(!GS.history.length&&!GS.initial){toast("Ya al inicio");return;}simRestore(GS.initial);GS.history=[];GS.over=false;show('simGame');simRender();}
$("#sUndo").onclick=simUndo;
$("#sStart").onclick=simToStart;
$("#rBack").onclick=simUndo;
$("#rStart").onclick=simToStart;
let verTodas=false;
$("#rotView").onclick=()=>{viewAnchor=(viewAnchor+1)%4;simRender();};
$("#tbVer").onclick=()=>{verTodas=!verTodas;simRender();};
$("#tbAzar").onclick=()=>{ // nuevo reparto al azar y reinicia la mano
  owner={};simDealMode="aleatoria";const t=shuffle(allTiles().map(x=>key(x[0],x[1])));t.forEach((k,i)=>owner[k]=Math.floor(i/7));
  simStarter=owner["6-6"]!==undefined?owner["6-6"]:0;startSimGame();
};
$("#tbPasa").onclick=()=>{ if(!GS){toast("Primero reparte: Al Azar o Reparto");return;} const m=aiBestMovesDeep(GS.hands,GS.ends,GS.current,GS.passes); if(m.length){toast(`${ROLE[GS.current]} sí tiene jugada`);return;} simPass(); };
$("#aiOne").onclick=()=>{ if(!GS){toast("Primero reparte: Al Azar o Reparto");return;} simAIMove(); };
$("#aiAll").onclick=()=>{ if(!GS){toast("Primero reparte: Al Azar o Reparto");return;} let guard=0;while(!GS.over&&guard<200){simAIMove(true);guard++;}simRender(); };

// posiciones por rotación de vista: 0=abajo(Sur),1=der(Este),2=arriba(Norte),3=izq(Oeste)
const POS_COMPASS=["Sur","Este","Norte","Oeste"];
const COMPASS={0:"Sur",1:"Este",2:"Norte",3:"Oeste"}; // por defecto (vista sin girar)
let viewAnchor=0;   // qué asiento se muestra abajo
function posOf(seat){return (seat-viewAnchor+4)%4;}
function backTile(portrait){return `<span class="domino back md${portrait?" vert":""}"></span>`;}
function boardCenterHTML(cur){
  const banner=`<div class="banner">Partida ${simDealMode}. Sale ${ROLE[simStarter]} (${POS_COMPASS[posOf(simStarter)]}).</div>`;
  if(GS.ends===null)return banner+`<div class="muted center">Mesa vacía — sale ${ROLE[cur]}</div>`;
  return banner+`<div class="board" id="boardChain"></div>`;
}
// Dibuja la cadena como un tren de dominó real: fichas tendidas y conectadas
// extremo con extremo, los dobles cruzados (perpendiculares a la línea) y la
// línea serpenteando en filas alternas para caber en el ancho disponible.
// La geometría de la ficha (.domino.sm) se MIDE en el propio tablero en cada
// pintado, para que valga con cualquier tamaño que dicte el CSS (la mesa en
// vertical usa fichas más chicas). Los valores fijos son solo el respaldo si
// no se puede medir (caja oculta). Las fichas solapan 1px por lado para que
// los bordes se toquen sin doblarse; eso no depende del tamaño.
const BT_LONG=58, BT_SHORT=34, BT_OVERLAP=2;
function boardTileGeom(box){
  const probe=document.createElement("span");
  probe.style.cssText="position:absolute;visibility:hidden;pointer-events:none";
  probe.innerHTML=tileHTML(1,2,"sm");        // acostada: ancho=larga, alto=corta
  box.appendChild(probe);
  const r=probe.firstElementChild.getBoundingClientRect();
  probe.remove();
  return {long:Math.round(r.width)||BT_LONG, short:Math.round(r.height)||BT_SHORT};
}
function fillBoardChain(){
  const box=document.getElementById("boardChain");
  if(!box) return;
  box.innerHTML="";
  const line=orientedLine(GS.sequence);
  if(!line.length) return;
  const {long:L,short:S}=boardTileGeom(box);
  const ancho=box.clientWidth||(box.parentElement&&box.parentElement.clientWidth)||320;
  const avail=Math.max(L+S, ancho-10);

  // 1) Tiende la línea con un cursor que gira al llegar al borde. Cada ficha
  //    avanza lo que ocupa de verdad: la larga menos el solape acostada, la
  //    corta menos el solape el doble cruzado.
  //    'ini' es el borde por donde arranca la fila (izquierdo si va →,
  //    derecho si va ←), y es siempre donde terminó la fila anterior: así el
  //    tren gira en la esquina en vez de cortarse y saltar de sitio.
  const rows=[{dir:1,ini:0,span:0,tiles:[]}];
  line.forEach(o=>{
    let r=rows[rows.length-1];
    const w=(o.dbl?S:L)-BT_OVERLAP;
    const cupo=(r.dir===1)?(avail-r.ini):r.ini;
    if(r.tiles.length && r.span+w+BT_OVERLAP>cupo){
      // el giro cae en el canto exterior de la fila que se cierra
      const fin=(r.dir===1)?(r.ini+r.span+BT_OVERLAP):(r.ini-r.span-BT_OVERLAP);
      r={dir:-r.dir,ini:fin,span:0,tiles:[]};
      rows.push(r);
    }
    r.tiles.push(o); r.span+=w;
  });

  // 2) La fila que va der→izq se dibuja con row-reverse y la ficha volteada,
  //    para que los números sigan casando extremo con extremo al leerla.
  rows.forEach(r=>{
    const rtl=(r.dir===-1);
    const span=r.span+BT_OVERLAP;
    const izq=rtl?(r.ini-span):r.ini;
    const el=document.createElement("div");
    el.className="brow"+(rtl?" rtl":"");
    el.style.width=span+"px";
    el.style.marginLeft=(rows.length===1?(avail-span)/2:Math.max(0,izq))+"px";
    r.tiles.forEach(o=>{
      const a=rtl?o.b:o.a, b=rtl?o.a:o.b;
      const jp=(key(o.a,o.b)===GS.lastKey)?" justplayed":"";
      let marca="";
      if(jp){const u=(GS.hist||[]).filter(h=>!h.paso).slice(-1)[0];
        if(u&&u.pensada)marca=`<span class="pmark">${u.pensada}</span>`;}
      el.insertAdjacentHTML("beforeend",`<span class="pwrap">${tileHTML(a,b,"sm"+(o.dbl?" vert":"")+jp)}${marca}</span>`);
    });
    box.appendChild(el);
  });

  // deja a la vista la última jugada si la cadena ya no cabe de una
  const jp=box.querySelector(".justplayed");
  if(jp) jp.scrollIntoView({block:"nearest",inline:"nearest"});
}
// al rotar o redimensionar cambia el ancho: hay que recalcular el serpenteo
window.addEventListener("resize",()=>{
  const g=document.getElementById("simGame");
  if(GS&&!GS.over&&g&&!g.classList.contains("hidden")) fillBoardChain();
});
// posición de cada asiento en la mesa (según el giro): seat en la posición 'pos' = (pos+viewAnchor)%4
function seatAtPos(pos){return (pos+viewAnchor)%4;}
function renderBand(id,pos,ctx){
  const el=document.getElementById(id);if(!el)return;el.innerHTML="";
  const seat=seatAtPos(pos);
  const portrait=(pos===0||pos===2);          // Norte/Sur de pie; Este/Oeste acostadas
  const isCur=(seat===ctx.cur);
  el.classList.toggle("active",isCur);
  const lab=document.createElement("div");lab.className="lbl";
  lab.innerHTML=`${isCur?"▸ ":""}${ROLE[seat]} · ${POS_COMPASS[pos]} · ${GS.hands[seat].size}·${pipsOf(GS.hands[seat])}p`;
  const wrap=document.createElement("div");wrap.className=portrait?"hand":"handv";
  const vis=ctx.showAll||isCur||seat===0;      // TÚ siempre visible
  [...GS.hands[seat]].sort((a,b)=>pip(kt(b))-pip(kt(a))).forEach(k=>{
    const t=kt(k);const d=document.createElement("div");d.className="pick";
    if(!vis){d.innerHTML=backTile(portrait);}
    else{
      d.innerHTML=tileHTML(t[0],t[1],portrait?"md vert":"md")+((isCur&&k===ctx.best)?'<span class="star">⭐</span>':'')
        +((isCur&&k===sugeridaK)?'<span class="star sug">💡</span>':'');
      if(isCur){ if(ctx.playable[k]){ d.classList.add("playable"); d.dataset.k=k; d.dataset.sides=ctx.playable[k].join(","); d.onclick=()=>simChoose(k,ctx.playable[k]); } else if(ctx.hasPlayable) d.classList.add("dim"); }
    }
    wrap.appendChild(d);
  });
  if(pos===0){
    el.appendChild(wrap);
    if(enAnalisis()){const c=document.createElement("div");c.innerHTML=barraCursor();if(c.firstChild)el.appendChild(c.firstChild);}
    if(seat===0&&sistemas[0]!=="ninguno"&&!enAnalisis()){const c=document.createElement("div");c.innerHTML=conmutadorPensada();el.appendChild(c.firstChild);}
    el.appendChild(lab);
  }else{el.appendChild(lab);el.appendChild(wrap);}
}
function simIdle(){
  ["bandN","bandS","bandW","bandE"].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.innerHTML="";el.classList.remove("active");});
  const dc=document.getElementById("dcenter");if(dc)dc.innerHTML=`<div class="muted center" style="font-size:1.05rem">Elige un modo arriba para comenzar</div>`;
  const sc=document.getElementById("dscore");if(sc)sc.innerHTML="";
  const tv=document.getElementById("tbVer");if(tv)tv.textContent="👁 Ver todas";
  clearPanel();
}
function simRender(){
  if(!GS){simIdle();return;}
  if(GS.over)return;const cur=GS.current;
  const moves=aiBestMovesDeep(GS.hands,GS.ends,cur,GS.passes);const best=moves.length?moves[0].k:null;
  const hasPlayable=moves.length>0;
  const playable={};moves.forEach(m=>{(playable[m.k]=playable[m.k]||[]).push(m.side);});
  const ctx={cur,best,hasPlayable,playable,showAll:verTodas};
  const sc=document.getElementById("dscore");if(sc)sc.innerHTML=`S-N <b>0</b> · E-O <b>0</b>`;
  renderBand("bandN",2,ctx); renderBand("bandS",0,ctx); renderBand("bandW",3,ctx); renderBand("bandE",1,ctx);
  const dc=document.getElementById("dcenter");if(dc)dc.innerHTML=boardCenterHTML(cur);
  fillBoardChain();
  const tv=document.getElementById("tbVer");if(tv)tv.textContent=verTodas?"🙈 Ocultar":"👁 Ver todas";
}
function dpanel(html){const dp=document.getElementById("dpanel");if(!dp)return;dp.innerHTML=html;dp.style.display="block";}
function clearPanel(){const dp=document.getElementById("dpanel");if(dp){dp.innerHTML="";dp.style.display="none";}}
function simChoose(k,sides){
  if(GS.ends!==null&&sides.length===2){
    dpanel(`<div class="ovcard"><div class="center" style="margin-bottom:8px">${tileK(k)} ¿por qué punta?</div>`+
      `<div class="btnrow grow"><button class="btn gold" data-s="I">IZQ (${GS.ends[0]})</button><button class="btn gold" data-s="D">DER (${GS.ends[1]})</button></div></div>`);
    document.querySelectorAll("#dpanel button[data-s]").forEach(b=>b.onclick=()=>{clearPanel();simDo(k,b.dataset.s);});
  }else simDo(k,GS.ends===null?"inicio":sides[0]);
}
function simDo(k,side){
  if(enAnalisis()){
    const t=analisis.partida.jugadas.length;
    if(analisis.soloLectura){ ofrecerVariante(k,side); return; }
    if(analisis.n<t){ ofrecerVariante(k,side); return; }
    analisisSalir();                       // jugar en la ultima posicion sigue la partida
  }
  sugeridaK=null;simPush();const p=GS.current;
  const pen=(p===0&&pensadaForzada)?pensadaForzada:calcularPensada(p,k,side);
  // veredicto/comentario quedan preparados para anotar partidas; aun sin interfaz
  GS.hist.push({jugador:p,ficha:k,punta:GS.ends===null?null:side,pensada:pen,veredicto:null,comentario:null});
  if(p===0){avisoPensada(k,pen);pensadaForzada=null;}
  placeOnBoard(GS,k,side);GS.hands[p].delete(k);GS.lastKey=k;GS.passes=0;GS.log.push(`${ROLE[p]} juega ${k}${side==="I"?" → izq":side==="D"?" → der":""}${pen?" · "+pen:""}`);simNext();}

/* ---------- jugar arrastrando la ficha al tablero ----------
   Con eventos de puntero, no con el arrastre nativo de HTML: el nativo solo
   responde al ratón y en un teléfono no pasa nada. El toque se queda como
   estaba (el onclick de renderBand); esto solo añade el arrastre, y solo
   cuenta como arrastre si el puntero se movió más que el umbral: un toque
   con pulso tembloroso sigue siendo un toque. */
const DRAG_UMBRAL=8;
let drag=null, dragJugo=false;

function dragZona(x,y){const el=document.elementFromPoint(x,y);return el?el.closest("#dcenter"):null;}

// Con la ficha encajando en las dos puntas, la mitad del tablero donde la
// sueltas decide: izquierda -> I, derecha -> D. Sin caja medible no se infiere
// y decide el usuario en el panel de siempre.
function dragLado(x){
  const b=document.getElementById("boardChain")||document.getElementById("dcenter");
  const r=b&&b.getBoundingClientRect();
  if(!r||!r.width)return null;
  return x<r.left+r.width/2?"I":"D";
}
function dragPintar(sobre,lado){
  const dc=document.getElementById("dcenter");if(!dc)return;
  dc.classList.toggle("dropOk",!!sobre);
  dc.classList.toggle("dropI",!!sobre&&lado==="I");
  dc.classList.toggle("dropD",!!sobre&&lado==="D");
}

// Quita el fantasma y los escuchadores del arrastre en curso y lo devuelve.
function dragLimpiar(){
  if(!drag)return null;
  const d=drag;drag=null;
  d.fantasma.remove();
  d.ficha.removeEventListener("pointermove",dragMover);
  d.ficha.removeEventListener("pointerup",dragSoltar);
  d.ficha.removeEventListener("pointercancel",dragSoltar);
  dragPintar(false,null);
  return d;
}

function dragEmpezar(ev){
  dragJugo=false;                 // un clic huérfano no sobrevive a la pulsación siguiente
  dragLimpiar();                  // si se perdió un pointerup, no dejes el fantasma anterior colgado
  if(!GS||GS.over)return;
  const ficha=ev.target.closest(".pick.playable");
  if(!ficha||ficha.dataset.k===undefined)return;
  const k=ficha.dataset.k, t=kt(k);
  const fantasma=document.createElement("div");
  fantasma.className="dragghost";
  fantasma.innerHTML=tileHTML(t[0],t[1],"md");
  document.body.appendChild(fantasma);
  drag={k,sides:(ficha.dataset.sides||"").split(",").filter(Boolean),ficha,fantasma,
        x0:ev.clientX,y0:ev.clientY,movido:false};
  dragMover(ev);
  // Si el puntero ya no está activo (toques muy rápidos), capturar lanza; sin
  // el try el arrastre se quedaría a medias y el fantasma pegado en pantalla.
  try{ ficha.setPointerCapture?.(ev.pointerId); }catch(_){}
  ficha.addEventListener("pointermove",dragMover);
  ficha.addEventListener("pointerup",dragSoltar);
  ficha.addEventListener("pointercancel",dragSoltar);
}

function dragMover(ev){
  if(!drag)return;
  if(Math.hypot(ev.clientX-drag.x0,ev.clientY-drag.y0)>DRAG_UMBRAL)drag.movido=true;
  // La ficha se dibuja POR ENCIMA del punto de contacto: si va debajo, el
  // pulgar la tapa y no ves lo que llevas.
  drag.fantasma.style.transform=`translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -150%)`;
  const sobre=drag.movido&&!!dragZona(ev.clientX,ev.clientY);
  dragPintar(sobre,sobre&&drag.sides.length===2?dragLado(ev.clientX):null);
}

function dragSoltar(ev){
  const d=dragLimpiar();
  if(!d)return;
  const {k,sides,movido}=d;
  if(!movido)return;                                    // fue un toque: lo juega el onclick
  // Hubo arrastre. La captura de puntero redirige a la ficha el clic que el
  // navegador manda al soltar, aunque sueltes en otro sitio: si no lo anulamos,
  // su onclick jugaría la ficha igual y "soltar fuera" no devolvería nada.
  dragJugo=true;
  if(ev.type==="pointercancel")return;                  // gesto abortado: nada cambia
  if(!dragZona(ev.clientX,ev.clientY))return;           // fuera del tablero: vuelve a la mano
  if(!GS||GS.over)return;
  if(GS.ends===null){simDo(k,"inicio");return;}
  if(sides.length===1){simDo(k,sides[0]);return;}
  const lado=dragLado(ev.clientX);
  if(lado)simDo(k,lado); else simChoose(k,sides);
}

// Tras un arrastre jugado, el clic que el navegador manda después llamaría a
// simChoose con una ficha que ya no está en la mano.
document.addEventListener("click",ev=>{
  if(!dragJugo)return;
  dragJugo=false;ev.stopPropagation();ev.preventDefault();
},true);
document.addEventListener("pointerdown",dragEmpezar);

function simPass(){
  if(enAnalisis()){
    const t=analisis.partida.jugadas.length;
    if(analisis.soloLectura){ ofrecerVariante(null,null); return; }
    if(analisis.n<t){ ofrecerVariante(null,null); return; }
    analisisSalir();
  }
  sugeridaK=null;simPush();GS.hist.push({jugador:GS.current,paso:true,pensada:null,veredicto:null,comentario:null});GS.log.push(`${ROLE[GS.current]} se pasa`);GS.passes++;simNext();}
function simAIMove(silent){
  if(!GS||GS.over)return;const cur=GS.current;const moves=aiBestMovesDeep(GS.hands,GS.ends,cur,GS.passes);
  if(!silent)simPush();else GS.history.push(simSnap());
  if(moves.length){const m=moves[0];GS.hist.push({jugador:cur,ficha:m.k,punta:GS.ends===null?null:m.side,pensada:calcularPensada(cur,m.k,m.side),veredicto:null,comentario:null});placeOnBoard(GS,m.k,m.side);GS.hands[cur].delete(m.k);GS.lastKey=m.k;GS.passes=0;GS.log.push(`${ROLE[cur]} juega ${m.k}${m.side==="I"?" → izq":m.side==="D"?" → der":""}${GS.hist[GS.hist.length-1].pensada?" · "+GS.hist[GS.hist.length-1].pensada:""}`);}
  else{GS.hist.push({jugador:cur,paso:true,pensada:null,veredicto:null,comentario:null});GS.passes++;GS.log.push(`${ROLE[cur]} se pasa`);}
  simNext(silent);
}
function simNext(silent){
  const cur=GS.current;
  if(GS.hands[cur].size===0)return simEnd("domino",cur);
  if(GS.passes>=4)return simEnd("tranca",null);
  GS.current=(GS.current+1)%4;if(!silent){simRender();window.scrollTo({top:0,behavior:"smooth"});}
}
function simEnd(type,winner){
  GS.over=true;const res=roundScore(GS.hands,winner!==null?teamOf(winner):null,type,0,simStarter,winner);
  let h="";
  if(type==="domino"){const mine=teamOf(winner)===0;
    h+=`<div class="${mine?'win':'lose'}">Domino de ${ROLE[winner]} → gana ${mine?"TU PAREJA (TÚ+CO) 🎉":"pareja rival (RD+RI)"}</div>`;
    h+=`<div>Puntos ganados: <b>${res.points}</b> (suma de la pareja perdedora)</div>`;
  }else{
    if(res.tie)h+=`<div>TRANCA — empate a puntos, ronda cerrada.</div>`;
    else{const mine=res.winTeam===0;h+=`<div class="${mine?'win':'lose'}">TRANCA → gana ${mine?"TU PAREJA (TÚ+CO) 🎉":"pareja rival (RD+RI)"} (menos puntos)</div>`;
      h+=`<div>Puntos: TÚ+CO=${res.tpips[0]}, RD+RI=${res.tpips[1]} → ganador se anota ${res.points}</div>`;}
  }
  h+=`<div style="margin-top:8px" class="muted">Puntos que quedaron en cada mano:</div>`;
  for(let p=0;p<4;p++)h+=`<div class="lab${p}" style="font-weight:700">${ROLE[p]}: ${pipsOf(GS.hands[p])} pts (${GS.hands[p].size} fichas)</div>`;
  $("#sResultView").innerHTML=h;
  $("#sLog").innerHTML=GS.log.map((l,i)=>`<div>${i+1}. ${l}</div>`).join("");
  show('simResult');
}

/* ============================================================
   Guardar / recuperar "fotos" de las manos
   - Modo backend: si el host (dominopro) inyecta window.DOMINOPRO
     { apiBase, token } (por variable global o postMessage), usa la API.
   - Modo local: si no hay backend o falla la red, usa localStorage.
   Formato transportado = contrato (ver INTEGRATION.md): {id,name,createdAt,position,meta,summary}
   ============================================================ */
const Store={
  cfg:(typeof window!=="undefined"&&window.DOMINOPRO&&window.DOMINOPRO.apiBase)?window.DOMINOPRO:null,
  api(){return this.cfg&&this.cfg.apiBase?String(this.cfg.apiBase).replace(/\/$/,""):null;},
  headers(){const h={"Content-Type":"application/json"};if(this.cfg&&this.cfg.token)h["Authorization"]="Bearer "+this.cfg.token;return h;},
  online(){return !!this.api();},
  localAll(){try{return JSON.parse(localStorage.getItem("domino_saves")||"[]");}catch(e){return memSaves;}},
  localSet(a){memSaves=a;try{localStorage.setItem("domino_saves",JSON.stringify(a));}catch(e){}},
  async list(){
    if(this.online()){try{const r=await fetch(this.api()+"/api/sim/positions",{headers:this.headers()});if(r.ok)return await r.json();}catch(e){}}
    return this.localAll();
  },
  async get(id){
    if(this.online()){try{const r=await fetch(this.api()+"/api/sim/positions/"+id,{headers:this.headers()});if(r.ok)return await r.json();}catch(e){}}
    return this.localAll().find(x=>x.id===id);
  },
  async save(item){
    if(this.online()){try{const r=await fetch(this.api()+"/api/sim/positions",{method:"POST",headers:this.headers(),body:JSON.stringify(item)});if(r.ok){const j=await r.json();return {id:j.id,remote:true};}}catch(e){}}
    const a=this.localAll();item.id="loc-"+Date.now();a.unshift(item);this.localSet(a.slice(0,60));return {id:item.id,remote:false};
  },
  async remove(id){
    if(this.online()){try{const r=await fetch(this.api()+"/api/sim/positions/"+id,{method:"DELETE",headers:this.headers()});if(r.ok||r.status===204)return;}catch(e){}}
    this.localSet(this.localAll().filter(x=>x.id!==id));
  }
};
let memSaves=[];
// el host puede enviar la config por postMessage (para iframes)
window.addEventListener("message",e=>{
  const d=e.data;if(d&&d.type==="DOMINOPRO_CONFIG"&&d.apiBase){Store.cfg={apiBase:d.apiBase,token:d.token};toast("Conectado a dominopro");}
});

function askName(def){try{const n=prompt("Nombre de la foto:",def);return n===null?null:(n.trim()||def);}catch(e){return def;}}
function posFromGame(){return {hands:GS.hands.map(s=>[...s]),ends:GS.ends?GS.ends.slice():null,sequence:GS.sequence.slice(),current:GS.current,passes:GS.passes,starter:simStarter,dealMode:simDealMode,sistemas:Object.assign({},sistemas),hist:(GS.hist||[]).slice()};}
function posFromDeal(){return {hands:[0,1,2,3].map(p=>Object.keys(owner).filter(k=>owner[k]===p)),ends:null,sequence:[],current:simStarter,passes:0,starter:simStarter,dealMode:simDealMode,sistemas:Object.assign({},sistemas)};}
function nowISO(){try{return new Date().toISOString();}catch(e){return "";}}
function buildItem(name,pos){
  const played=28-pos.hands.reduce((n,h)=>n+h.length,0);
  return {name,createdAt:nowISO(),position:pos,meta:{app:"domino-sim",version:1},summary:{played,starter:pos.starter}};
}
async function doSave(pos,defName){
  const name=askName(defName);if(name===null)return;
  const res=await Store.save(buildItem(name,pos));
  toast((res.remote?"Guardado en dominopro: ":"Guardado (local): ")+name);
}
function itemPos(s){return s.position||s.pos;}          // compat con formato antiguo
function itemPlayed(s){return s.summary?s.summary.played:(28-itemPos(s).hands.reduce((n,h)=>n+h.length,0));}
function itemDate(s){try{return new Date(s.createdAt||s.ts).toLocaleString();}catch(e){return "";}}
async function renderSaves(targetId){
  const box=$("#"+targetId);box.innerHTML=`<div class="muted" style="margin-top:8px">Cargando…</div>`;
  const a=await Store.list();
  if(!a||!a.length){box.innerHTML=`<div class="muted" style="margin-top:8px">No hay manos guardadas todavía${Store.online()?" en dominopro":""}.</div>`;return;}
  const wrap=document.createElement("div");wrap.className="saves";
  a.forEach(s=>{
    const it=document.createElement("div");it.className="saveitem";
    it.innerHTML=`<span class="nm">${s.name}<br><span class="dt">${itemDate(s)} · ${itemPlayed(s)} jugadas · sale ${COMPASS[itemPos(s)?itemPos(s).starter:s.summary.starter]}</span></span>`;
    const load=document.createElement("button");load.className="btn gold";load.textContent="Cargar";
    load.onclick=async()=>{const full=await Store.get(s.id);const pos=full?itemPos(full):itemPos(s);if(pos)loadPosition(pos);else toast("No se pudo cargar");};
    const del=document.createElement("button");del.className="btn red";del.textContent="🗑";
    del.onclick=async()=>{await Store.remove(s.id);renderSaves(targetId);};
    it.appendChild(load);it.appendChild(del);wrap.appendChild(it);
  });
  box.innerHTML="";box.appendChild(wrap);
}
function loadPosition(pos){
  simStarter=pos.starter;simDealMode=pos.dealMode||"guardada";
  if(pos.sistemas)[0,1,2,3].forEach(p2=>{if(pos.sistemas[p2])sistemas[p2]=pos.sistemas[p2];});
  GS={hands:pos.hands.map(a=>new Set(a)),ends:pos.ends?pos.ends.slice():null,sequence:pos.sequence.slice(),
      current:pos.current,passes:pos.passes||0,over:false,history:[],log:[],hist:(pos.hist||[]).slice()};
  GS.initial=simSnap();
  clearPanel();show('simGame');simRender();toast("Mano cargada");
}
$("#savePos").onclick=()=>{ if(!GS){toast("Primero reparte: Al Azar o Reparto");return;} doSave(posFromGame(),"Foto "+itemDate({createdAt:nowISO()})); };
$("#openSaves").onclick=()=>{
  dpanel(`<div class="ovcard"><div class="center" style="margin-bottom:6px"><b>Manos guardadas</b></div><div id="gameSaves"></div><button class="btn ghost" style="width:100%;margin-top:8px" onclick="clearPanel()">Cerrar</button></div>`);
  renderSaves("gameSaves");
};
let dealSavesOpen=false;
$("#simOpenSaves").onclick=()=>{dealSavesOpen=!dealSavesOpen;if(dealSavesOpen)renderSaves("dealSaves");else $("#dealSaves").innerHTML="";};

$("#winProb").onclick=()=>{
  if(!GS){toast("Primero reparte: Al Azar o Reparto");return;}
  if(GS.over){toast("La ronda ya terminó");return;}
  dpanel(`<div class="ovcard"><div class="muted center">Calculando…</div></div>`);
  setTimeout(()=>{
    const r=winProbMC(posFromGame(),2000,1.1);
    const pa=Math.round(r.pA*100),pb=Math.round(r.pB*100),pt=Math.round(r.pTie*100);
    dpanel(`<div class="ovcard"><div class="probpanel">
      <div class="row"><b class="lab0">TÚ+CO (S-N)</b><b>${pa}%</b></div>
      <div class="bar"><div class="seg" style="width:${pa}%;background:var(--pTU)"></div><div class="seg" style="width:${pb}%;background:var(--pRD)"></div><div class="seg" style="width:${pt}%;background:#666"></div></div>
      <div class="row" style="margin-top:6px"><b class="lab1">RD+RI (E-O)</b><b>${pb}%</b></div>
      <div class="row"><span class="muted">empate (tranca)</span><span>${pt}%</span></div>
      <div class="row" style="margin-top:6px"><span class="muted">terminan en dominó</span><span>${Math.round(r.pDom*100)}%</span></div>
      <div class="row"><span class="muted">puntos medios si gana cada una</span><span>${r.avgA.toFixed(0)} / ${r.avgB.toFixed(0)}</span></div>
      <div class="muted" style="margin-top:6px;font-size:.72rem">${r.N} simulaciones (Monte Carlo).</div>
      </div><button class="btn ghost" style="width:100%;margin-top:8px" onclick="clearPanel()">Cerrar</button></div>`);
  },30);
};

/* ---- análisis didáctico de la mano (criterios del taller) ----
   El cálculo vive en conocimiento.js (puro); aquí solo se elige qué mano se
   analiza y se redacta el panel. En partida se analiza la mano viva de Sur y
   se pasan las fichas de la mesa, para medir la fuerza contra lo que queda
   vivo de cada palo; con solo el reparto hecho, la mano repartida. */
function decimal(v){return String(v).replace(".",",");}
function listaPalos(ps){
  const t=ps.map(p=>NOMBRE_PALO[p]);          // mismos nombres que las filas de palo
  if(t.length<=1)return t.join("");
  return t.slice(0,-1).join(", ")+" y "+t[t.length-1];
}
function conMayuscula(t){return t.charAt(0).toUpperCase()+t.slice(1);}
function fichasHTML(lista){
  return `<div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;margin:6px 0">`+
    lista.map(k=>{const t=kt(k);return tileHTML(t[0],t[1],"xs");}).join("")+`</div>`;
}
function textoDobles(d){
  if(!d.n) return `Ninguno. Manos sin dobles hay un ${decimal(PROB_DOBLES[0])}%.`;
  const p=d.prob===null?"menos del 0,01":decimal(d.prob);
  return `${d.n===1?"Un doble":d.n+" dobles"}: el ${p}% de las manos lleva ${d.n}.`;
}
function textoFallas(f){
  // Los palos ya salen en la fila de arriba; aquí solo la referencia.
  if(!f.n) return `No fallas a nada. Eso pasa en el ${decimal(PROB_FALLAS[0])}% de las manos.`;
  const p=f.prob===null?"menos del 0,01":decimal(f.prob);
  return `Con ${f.n} falla${f.n>1?"s":""} estás en el ${p}% de las manos.`;
}
function bloqueSalida(sal){
  if(!sal) return "";
  const t=kt(sal.ficha);
  const col={alta:"var(--ok)",media:"var(--gold)",baja:"var(--dim)"}[sal.confianza]||"var(--dim)";
  return `<div class="probpanel" style="border:1px solid var(--gold)">
    <div class="muted" style="font-size:.72rem;margin-bottom:4px">Salida recomendada</div>
    <div style="display:flex;align-items:center;gap:8px">
      ${tileHTML(t[0],t[1],"md")}
      <div><div style="font-weight:800">${sal.ficha} · ${sal.pensada==="SPP"?"sin pensada":"con pensada"}</div>
        <div class="muted" style="font-size:.68rem">${sal.pensada}</div></div>
    </div>
    <div class="muted" style="font-size:.72rem;margin-top:6px">${sal.motivo}</div>
    <div style="font-size:.7rem;margin-top:4px">Confianza: <b style="color:${col}">${sal.confianza}</b></div>
  </div>`;
}
function panelMano(a,salida){
  const fila=(izq,der)=>`<div class="row"><span class="muted">${izq}</span><span>${der}</span></div>`;
  const palos=a.porPalo.map(x=>{
    const nombre=`<b>${conMayuscula(x.nombre)}</b>`;
    if(!x.n) return `<div class="row" style="opacity:.45"><span>${nombre}</span><span>falla</span></div>`;
    const marca=x.fuerza?` · <b style="color:var(--ok)">fuerza ${x.claseFuerza==="origen"?"de origen":"adquirida"}</b>`:"";
    const det=x.fuerza?`<div class="muted" style="font-size:.68rem;text-align:right">(${x.motivo})</div>`:"";
    return `<div class="row"><span>${nombre}</span><span>${x.n} ficha${x.n>1?"s":""}${marca}</span></div>${det}`;
  }).join("");
  const frec=a.frecuenciaPaloMasLargo
    ? `<div class="muted" style="margin-top:4px;font-size:.72rem">Tu palo más largo: <b>${conMayuscula(a.paloMasLargo.nombre)}</b>, con ${a.paloMasLargo.n} fichas. Llevar ${a.paloMasLargo.n} de un palo es ${a.frecuenciaPaloMasLargo}.</div>` : "";
  const etiq=a.etiquetas.length
    ? a.etiquetas.map(e=>`<span class="badge" style="position:static;display:inline-block;margin:0 4px 4px 0">${e}</span>`).join("")
    : `<span class="muted">sin etiqueta del taller</span>`;
  // Los porcentajes del taller describen la mano REPARTIDA, de 7. A media
  // partida siguen siendo útiles como referencia, pero hay que decir que ya
  // no es una mano de 7 o el panel estaría mintiendo.
  const aviso=a.n===7?"":`<div class="muted center" style="font-size:.7rem;margin-bottom:4px">Te quedan ${a.n} fichas: los porcentajes de referencia son de manos de 7.</div>`;
  return `<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="center" style="margin-bottom:4px"><b>🔎 Tu mano (Sur)</b></div>
    ${aviso}
    ${fichasHTML(a.fichas)}
    ${bloqueSalida(salida)}
    <div class="probpanel">
      ${fila("Puntos",`<b>${a.puntos}</b> · mano <b>${a.categoria}</b>`)}
      <div class="muted" style="font-size:.68rem">Baja ≤32 · Media 33–49 · Alta ≥50</div>
      ${fila("Dobles",a.dobles.n?a.dobles.lista.join(" "):"ninguno")}
      <div class="muted" style="font-size:.72rem">${textoDobles(a.dobles)}</div>
      ${fila("Fallas",a.fallas.n?`<b>${a.fallas.n}</b> (${listaPalos(a.fallas.lista)})`:"ninguna")}
      <div class="muted" style="font-size:.72rem">${textoFallas(a.fallas)}</div>
    </div>
    <div class="probpanel">
      <div class="muted" style="font-size:.72rem;margin-bottom:4px">Fuerza por palo${a.conJugadas?" (contra lo que queda vivo)":""}:</div>
      ${palos}
      ${frec}
    </div>
    <div class="probpanel"><div class="center">${etiq}</div></div>
    <button class="btn ghost" style="width:100%;margin-top:8px" onclick="clearPanel()">Cerrar</button>
  </div>`;
}
$("#tbMano").onclick=()=>{
  if(!GS&&!dealCompleto()){toast("Primero reparte");return;}
  const mias=GS?[...GS.hands[0]]:Object.keys(owner).filter(k=>owner[k]===0);
  const jugadas=GS?GS.sequence:[];
  // El consejo de salida solo tiene sentido con la mesa vacía y saliendo tú.
  const saleSur=GS?(GS.ends===null&&GS.current===0):(simStarter===0);
  dpanel(panelMano(analizarMano(mias,jugadas),saleSur?asesorSalida(mias):null));
};

/* ---- sistemas de pensada y registro de la marca ----
   Cada asiento juega con 'ninguno' (por defecto), 'clasico' o 'moderno'. La
   pensada NUNCA se infiere: la calcula el sistema de quien juega, o la anota
   quien la vio. Se elige en el reparto y viaja con la partida. */
let sistemas={0:"ninguno",1:"ninguno",2:"ninguno",3:"ninguno"};
let pensadaForzada=null;                 // Auto / CPP / SPP para tu proxima jugada
function jugadasEnMesa(){return (GS&&GS.sequence?GS.sequence:[]).map(t=>key(t[0],t[1]));}
// Calcula la pensada de una jugada ANTES de ponerla en la mesa.
function calcularPensada(p,k,side){
  const cast=GS.ends===null?null:(side==="I"?GS.ends[0]:GS.ends[1]);
  const t=kt(k); const gen=cast===null?null:(t[0]===cast?t[1]:t[0]);
  return pensadaPara({ficha:k,lado:side,numeroCastigado:cast,numeroGenerado:gen,
    mano:[...GS.hands[p]],sistema:sistemas[p],jugadas:jugadasEnMesa()});
}
function avisoPensada(k,pen){
  if(!pen)return;
  const sis=sistemas[0];
  const t=kt(k), doble=t[0]===t[1];
  const que=doble?"es doble":sis==="clasico"?"informa el número que castigas":"informa el número que generas";
  toast(`Jugaste ${k} ${pen}: ${que} (${sis})`);
}
/* ---- selector de sistema en el reparto ---- */
function selectorSistema(seat){
  const op=SISTEMAS.map(x=>`<option value="${x}"${sistemas[seat]===x?" selected":""}>${x}</option>`).join("");
  return `<select class="selsis" data-seat="${seat}" title="Sistema de pensada de ${ROLE[seat]}">${op}</select>`;
}
document.addEventListener("change",ev=>{
  const sel=ev.target.closest(".selsis");
  if(!sel)return;
  sistemas[+sel.dataset.seat]=sel.value;
  if(GS)simRender(); else simIdle();
});
/* ---- conmutador Auto / CPP / SPP junto a tu mano ---- */
document.addEventListener("click",ev=>{
  const b=ev.target.closest("[data-pensada]");
  if(!b)return;
  const v=b.dataset.pensada;
  pensadaForzada=(v==="auto")?null:v;
  simRender();
});
function conmutadorPensada(){
  if(sistemas[0]==="ninguno")return "";
  const uno=(v,txt)=>`<button class="tb ${((v==="auto")===(pensadaForzada===null))&&(v==="auto"||v===pensadaForzada)?"b-sug":"b-copiar"}" data-pensada="${v}" style="padding:3px 7px;font-size:.66rem">${txt}</button>`;
  return `<div class="pensadabar">${uno("auto","Auto")}${uno("CPP","CPP")}${uno("SPP","SPP")}</div>`;
}
/* ---- lectura de pensadas para el panel de Sugerir ---- */
function bloqueLecturas(lecturas){
  if(!lecturas||!lecturas.length)return "";
  const filas=lecturas.slice(-6).map(n=>
    `<div class="row"><span>${ROLE[n.jugador]} jugó ${n.ficha} <b>${n.pensada}</b> <span class="muted">(${n.sistema})</span></span></div>
     <div class="muted" style="font-size:.68rem;text-align:right">→ ${n.dice}</div>`).join("");
  return `<div class="probpanel" style="margin-top:8px">
    <div class="muted" style="font-size:.72rem;margin-bottom:4px">Lectura de pensadas:</div>${filas}
    <div class="muted" style="font-size:.66rem;margin-top:4px">CPP = con pensada previa · SPP = sin pensada previa. En clásico la marca habla del número que castiga; en moderno, del que genera.</div>
  </div>`;
}

/* ---- sugerir jugada con explicación ----
   El consejo sale de conocimiento.js, que solo mira lo que tú sabes: tu mano,
   las puntas, quién jugó qué y quién pasó. La IA (aiBestMovesDeep) ve las
   cuatro manos, así que se muestra aparte, como contraste. */
let sugeridaK=null;                     // ficha marcada con 💡 en tu mano
function estadoParaSugerir(){
  if(!GS||GS.over) return null;
  const hist=GS.hist||[];
  let mesa; try{ mesa=reconstruirMesa(hist); }catch(e){ return null; }
  // la marca viaja con la jugada: reconstruirMesa no la inventa, solo la copia
  let i=0; mesa.secuencia.forEach(sq=>{ while(i<hist.length&&hist[i].paso)i++; if(i<hist.length)sq.pensada=hist[i++].pensada||null; });
  const primera=hist.find(h=>!h.paso);
  // La pensada de la salida solo se sabe de verdad si saliste TÚ: de la mano
  // ajena no puedes deducir el acompañamiento. Si no, va null (peso normal).
  // La pensada de la salida sale del historial: la marco quien la jugo.
  const pensada=primera?(primera.pensada||null):null;
  return {
    yo:GS.current, miMano:[...GS.hands[GS.current]], ends:GS.ends,
    secuencia:mesa.secuencia, pases:mesa.pases, salidor:simStarter,
    salida:primera?{ficha:primera.ficha,jugador:primera.jugador,pensada:pensada}:null,
    sistemas:sistemas, pasesSeguidos:GS.passes,
  };
}
function panelSugerir(s,ia){
  const t=kt(s.recomendada.ficha);
  const col={alta:"var(--ok)",media:"var(--gold)",baja:"var(--dim)"}[s.confianza]||"var(--dim)";
  const punta=s.recomendada.punta==="I"?"punta izquierda":s.recomendada.punta==="D"?"punta derecha":"salida";
  const razones=s.razones.map(r=>`<div class="row"><span>${r.texto}</span><span class="muted" style="white-space:nowrap">&nbsp;${r.principio}</span></div>`).join("")
    || `<div class="muted">Sin razones de peso: es la menos mala.</div>`;
  const contras=s.contras.length
    ? `<div class="muted" style="font-size:.7rem;margin-top:4px">En contra: ${s.contras.map(r=>r.texto).join("; ")}.</div>` : "";
  const alts=s.alternativas.slice(0,3).map(a=>
    `<div class="row"><span>${a.ficha} <span class="muted">(${a.punta==="I"?"izq":"der"})</span></span><span>${a.puntos}</span></div>`).join("");
  const coincide=ia&&ia.k===s.recomendada.ficha;
  const bloqueIA=ia
    ? `<div class="probpanel" style="margin-top:8px">
         <div class="muted" style="font-size:.72rem">La IA con información completa jugaría:</div>
         <div style="font-weight:800">${ia.k} <span class="muted" style="font-weight:400">(${ia.side==="I"?"izq":ia.side==="D"?"der":"salida"})</span></div>
         <div class="muted" style="font-size:.7rem;margin-top:2px">${coincide
             ? "✅ Coincide con el consejo."
             : "↔️ No coincide: la IA ve las cuatro manos; el consejo solo lo que tú sabes."}</div>
       </div>` : "";
  return `<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="center" style="margin-bottom:4px"><b>💡 Jugada sugerida</b></div>
    <div style="display:flex;align-items:center;gap:8px;justify-content:center;margin:6px 0">
      ${tileHTML(t[0],t[1],"md")}
      <div><div style="font-weight:800">${s.recomendada.ficha}</div>
        <div class="muted" style="font-size:.7rem">por la ${punta}</div></div>
    </div>
    <div class="probpanel">
      <div class="muted" style="font-size:.72rem;margin-bottom:4px">Por qué:</div>
      ${razones}${contras}
      <div style="font-size:.7rem;margin-top:6px">Confianza: <b style="color:${col}">${s.confianza}</b></div>
    </div>
    ${s.porQueNo?`<div class="muted" style="font-size:.72rem;margin-top:6px">${s.porQueNo}</div>`:""}
    ${alts?`<div class="probpanel" style="margin-top:8px"><div class="muted" style="font-size:.72rem;margin-bottom:4px">Alternativas:</div>${alts}</div>`:""}
    ${bloqueLecturas(s.lecturas)}
    ${bloqueIA}
    <button class="btn ghost" style="width:100%;margin-top:8px" onclick="clearPanel()">Cerrar</button>
  </div>`;
}
$("#tbSug").onclick=()=>{
  if(!GS){toast("Primero reparte");return;}
  if(GS.over){toast("La ronda ya terminó");return;}
  if(GS.current!==0){toast(`No es tu turno (le toca a ${ROLE[GS.current]})`);return;}
  const est=estadoParaSugerir();
  if(!est){toast("No puedo reconstruir la mesa");return;}
  const s=sugerirJugada(est);
  if(!s){toast("No tienes jugada");return;}
  const mv=aiBestMovesDeep(GS.hands,GS.ends,GS.current,GS.passes);
  const ia=mv.length?{k:mv[0].k,side:mv[0].side}:null;
  sugeridaK=s.recomendada.ficha;
  simRender();
  dpanel(panelSugerir(s,ia));
};

/* ---- simulación masiva ----
   Dos fuentes:
   · "global": repartos nuevos al azar en cada ronda (lo de siempre). Mide el
     juego, no una mano: por eso usa simulateRound, que es determinista.
   · "reparto": las 4 manos y el salidor de AHORA, repetidos N veces. Aquí
     simulateRound no sirve — con la mano fija devolvería N veces el mismo
     resultado —, así que se juega con playoutRandom, el mismo motor con
     temperatura que usa "Prob", que sí explora variantes. */
let bulkStartMode="d6";
let bulkSource="global";
const BULK_T=1.1;                 // misma temperatura que el botón Prob
function dealCompleto(){const c=[0,0,0,0];Object.values(owner).forEach(v=>c[v]++);return c.every(n=>n===7);}
function bulkUI(){
  const deReparto=(bulkSource==="reparto");
  const row=$("#bulkStartRow"); if(row) row.style.display=deReparto?"none":"";
  const ctx=$("#bulkCtx");
  if(ctx) ctx.innerHTML=deReparto
    ? `Sobre el <b>reparto actual</b> · sale ${ROLE[simStarter]} (${POS_COMPASS[posOf(simStarter)]})`
    : `Sobre <b>repartos nuevos al azar</b> en cada ronda`;
  $("#bulkOut").innerHTML="";
}
$("#tbBulk").onclick=()=>{
  if(!dealCompleto()){toast("Primero reparte");return;}
  if(simStarter===null){toast("Elige quién sale");return;}
  bulkSource="reparto";bulkUI();show('simBulk');
};
$("#bulkBack").onclick=()=>{show('simGame');simRender();};   // vuelve a la mesa tal como estaba
$("#bulkN").oninput=e=>$("#bulkNlab").textContent=e.target.value;
$("#startD6").onclick=()=>{bulkStartMode="d6";$("#startD6").classList.add("sel","gold");$("#startD6").classList.remove("ghost");$("#startRnd").classList.add("ghost");$("#startRnd").classList.remove("sel","gold");};
$("#startRnd").onclick=()=>{bulkStartMode="rnd";$("#startRnd").classList.add("sel","gold");$("#startRnd").classList.remove("ghost");$("#startD6").classList.add("ghost");$("#startD6").classList.remove("sel","gold");};
$("#runBulk").onclick=()=>{
  const N=+$("#bulkN").value;$("#bulkOut").innerHTML=`<div class="muted center" style="margin-top:12px">Simulando ${N} rondas…</div>`;
  setTimeout(()=>runBulk(N),30);
};
function runBulk(N){
  if(bulkSource==="reparto")return runBulkDeal(N);
  let winA=0,winB=0,ties=0,domino=0,tranca=0,starterWin=0,ptsSum=0,turnsSum=0;
  const allK=allTiles().map(x=>key(x[0],x[1]));
  for(let i=0;i<N;i++){
    const sh=shuffle(allK.slice());const hands=[0,1,2,3].map(p=>sh.slice(p*7,p*7+7));
    let starter;
    if(bulkStartMode==="d6"){starter=hands.findIndex(h=>h.includes("6-6"));}
    else starter=Math.floor(Math.random()*4);
    const r=simulateRound(hands,starter);
    if(r.type==="domino")domino++;else tranca++;
    if(r.winTeam===0)winA++;else if(r.winTeam===1)winB++;else ties++;
    if(r.winTeam!==null&&r.winTeam===teamOf(starter))starterWin++;
    ptsSum+=r.points;turnsSum+=r.turns;
  }
  const decided=winA+winB;
  const pct=x=>Math.round(x/N*100);
  const seg=(a,b,c)=>`<div class="bar"><div class="seg" style="width:${a}%;background:var(--pTU)"></div><div class="seg" style="width:${b}%;background:var(--pRD)"></div><div class="seg" style="width:${c}%;background:#666"></div></div>`;
  let h=`<div class="stat">
    <div class="box"><div class="n">${pct(winA)}%</div><div class="l">gana TÚ+CO</div></div>
    <div class="box"><div class="n">${pct(winB)}%</div><div class="l">gana RD+RI</div></div>
    <div class="box"><div class="n">${decided?Math.round(starterWin/decided*100):0}%</div><div class="l">gana la pareja que SALE</div></div>
    <div class="box"><div class="n">${pct(domino)}%</div><div class="l">terminan en dominó</div></div>
    <div class="box"><div class="n">${pct(tranca)}%</div><div class="l">terminan en tranca</div></div>
    <div class="box"><div class="n">${(ptsSum/N).toFixed(1)}</div><div class="l">puntos medios/ronda</div></div>
  </div>`;
  h+=`<div class="muted" style="margin-top:10px">Reparto de victorias (TÚ+CO / RD+RI / empate):</div>${seg(pct(winA),pct(winB),pct(ties))}`;
  h+=`<div class="muted" style="margin-top:8px">Turnos medios por ronda: ${(turnsSum/N).toFixed(1)} · empates (tranca): ${pct(ties)}%</div>`;
  h+=`<div class="muted" style="margin-top:10px">Salida: ${bulkStartMode==="d6"?"sale quien tiene el 6|6":"sale un jugador al azar"}. Con reparto y estrategia simétricos, la ventaja sobre 50% mide lo que pesa <b>salir</b>.</div>`;
  $("#bulkOut").innerHTML=h;
}

// Reparto fijo: playoutRandom reparte el juego con temperatura, así que las N
// rondas son variantes de LA MISMA mano. No informa de turnos porque
// playoutRandom no los cuenta (devuelve turns:0), ni de "gana quien sale",
// que aquí sería siempre la misma pareja.
function runBulkDeal(N){
  const pos=posFromDeal();
  let winA=0,winB=0,ties=0,domino=0,tranca=0,ptsA=0,ptsB=0;
  for(let i=0;i<N;i++){
    const r=playoutRandom(pos,BULK_T);
    if(r.type==="domino")domino++;else tranca++;
    if(r.winTeam===0){winA++;ptsA+=r.points;}
    else if(r.winTeam===1){winB++;ptsB+=r.points;}
    else ties++;
  }
  const pct=x=>Math.round(x/N*100);
  const manos=[0,1,2,3].map(p=>`${ROLE[p]} ${pos.hands[p].length}`).join(" · ");
  let h=`<div class="stat">
    <div class="box"><div class="n">${pct(winA)}%</div><div class="l">gana TÚ+CO</div></div>
    <div class="box"><div class="n">${pct(winB)}%</div><div class="l">gana RD+RI</div></div>
    <div class="box"><div class="n">${pct(domino)}%</div><div class="l">terminan en dominó</div></div>
    <div class="box"><div class="n">${pct(tranca)}%</div><div class="l">terminan en tranca</div></div>
    <div class="box"><div class="n">${winA?(ptsA/winA).toFixed(0):0}</div><div class="l">puntos si gana TÚ+CO</div></div>
    <div class="box"><div class="n">${winB?(ptsB/winB).toFixed(0):0}</div><div class="l">puntos si gana RD+RI</div></div>
  </div>`;
  h+=`<div class="muted" style="margin-top:10px">Reparto de victorias (TÚ+CO / RD+RI / empate):</div>`;
  h+=`<div class="bar"><div class="seg" style="width:${pct(winA)}%;background:var(--pTU)"></div><div class="seg" style="width:${pct(winB)}%;background:var(--pRD)"></div><div class="seg" style="width:${pct(ties)}%;background:#666"></div></div>`;
  h+=`<div class="muted" style="margin-top:8px">Empates (tranca): ${pct(ties)}%.</div>`;
  h+=`<div class="muted" style="margin-top:10px">Siempre la misma mano (${manos} fichas), sale ${ROLE[pos.starter]} (${POS_COMPASS[posOf(pos.starter)]}). Las ${N} rondas son formas distintas de jugarla, así que el reparto de victorias mide cuánto pesa <b>la mano</b> y cuánto el juego.</div>`;
  $("#bulkOut").innerHTML=h;
}

/* ---- partidas: copiar / pegar y biblioteca local ----
   La conversion vive en partida.js (puro). Aqui solo el pegamento con la UI
   y el almacen en localStorage bajo la clave partidas_v1. */
const CLAVE_PARTIDAS="partidas_v1";
/* writeText devuelve una promesa: sin catch, un fallo (sin foco, sin permiso,
   navegador viejo) sale como rechazo no capturado. Siempre queda el textarea. */
function alPortapapeles(txt){
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).catch(()=>{});
      return true;
    }
  }catch(e){}
  return false;
}
let partidaAbierta=null;          // {id,titulo,etiquetas,notas} de la que esta cargada

function nuevoId(){return "p"+Date.now().toString(36)+Math.floor(performance.now()%1000).toString(36);}
function ahoraISO(){try{return new Date().toISOString();}catch(e){return "";}}
function tituloPorDefecto(){try{return new Date().toLocaleString();}catch(e){return "Partida";}}

function leerBiblioteca(){
  let lista=[];
  try{lista=JSON.parse(localStorage.getItem(CLAVE_PARTIDAS)||"[]");}catch(e){lista=[];}
  if(!Array.isArray(lista))lista=[];
  // migracion: el guardado unico anterior pasa a la lista, una sola vez
  try{
    if(!localStorage.getItem(CLAVE_PARTIDAS+"_migrado")){
      const viejo=JSON.parse(localStorage.getItem("domino_saves_v1")||localStorage.getItem("domino_saves")||"[]");
      (Array.isArray(viejo)?viejo:[]).forEach(s=>{
        const pos=s.position||s.pos; if(!pos||!pos.hands)return;
        lista.push({id:nuevoId(),titulo:s.name||"Importada",fecha:s.createdAt||s.ts||ahoraISO(),
          etiquetas:["importada"],modo:"simulador",partida:partidaDesdePos(pos,s.name)});
      });
      localStorage.setItem(CLAVE_PARTIDAS+"_migrado","1");
      if(viejo&&viejo.length)guardarBiblioteca(lista);
    }
  }catch(e){}
  return lista;
}
function guardarBiblioteca(lista){
  try{localStorage.setItem(CLAVE_PARTIDAS,JSON.stringify(lista));}catch(e){toast("No se pudo guardar");}
}
// convierte una "foto" del formato antiguo en una partida v1
function partidaDesdePos(pos,titulo){
  const est={hands:(pos.hands||[]).map(a=>new Set(a)),hist:[]};
  return desdeEstado(est,{salidor:pos.starter||0,sistemas:{0:"ninguno",1:"ninguno",2:"ninguno",3:"ninguno"},
    modo:"simulador",id:nuevoId(),titulo:titulo||"Importada",fecha:ahoraISO()});
}

/* ---- de la mesa actual a partida ---- */
function partidaActual(extra){
  const o=Object.assign({
    salidor:simStarter===null?0:simStarter, sistemas:sistemas, modo:"simulador",
    id:(partidaAbierta&&partidaAbierta.id)||nuevoId(),
    titulo:(partidaAbierta&&partidaAbierta.titulo)||"",
    etiquetas:(partidaAbierta&&partidaAbierta.etiquetas)||[],
    notas:(partidaAbierta&&partidaAbierta.notas)||"",
    fecha:ahoraISO(), autor:"",
  },extra||{});
  if(GS) return desdeEstado(GS,o);
  if(LS) return desdeEstado(LS,Object.assign({},o,{modo:"vivo",salidor:liveStarter===null?0:liveStarter}));
  return null;
}

/* ---- Copiar ---- */
$("#tbCopiar").onclick=()=>{
  const p=partidaActual();
  if(!p||!p.jugadas.length){toast("No hay partida que copiar");return;}
  const txt=aTexto(p);
  const copiado=alPortapapeles(txt);
  dpanel(`<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="center" style="margin-bottom:6px"><b>📋 Texto de la partida</b></div>
    <div class="muted" style="font-size:.72rem;margin-bottom:6px">${copiado?"Copiado al portapapeles. ":""}Si no se copió, selecciona y copia a mano:</div>
    <textarea id="txtPartida" class="txtpartida" readonly>${txt.replace(/</g,"&lt;")}</textarea>
    <button class="btn ghost" style="width:100%;margin-top:8px" onclick="clearPanel()">Cerrar</button>
  </div>`);
  const ta=$("#txtPartida"); if(ta){ta.focus();ta.select();}
};

/* ---- Pegar ---- */
$("#tbPegar").onclick=()=>{
  dpanel(`<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="center" style="margin-bottom:6px"><b>📥 Pegar partida</b></div>
    <div class="muted" style="font-size:.72rem;margin-bottom:6px">Pega aquí el texto de una partida y pulsa Cargar.</div>
    <textarea id="txtPegar" class="txtpartida" placeholder="# Partida: ..."></textarea>
    <div id="pegarErr"></div>
    <div class="btnrow grow" style="margin-top:8px">
      <button class="btn gold" id="btnCargarTexto">Cargar</button>
      <button class="btn ghost" onclick="clearPanel()">Cerrar</button>
    </div></div>`);
  $("#btnCargarTexto").onclick=()=>{
    const p=desdeTexto($("#txtPegar").value);
    const errs=(p._errores||[]).concat(validar(p).errores||[]);
    if(errs.length){
      $("#pegarErr").innerHTML=`<div class="probpanel" style="margin-top:8px">
        <div class="muted" style="font-size:.72rem;margin-bottom:4px">No pude cargarla:</div>`+
        errs.slice(0,6).map(e=>`<div class="row"><span>${e.texto}</span><span class="muted">${e.linea?"línea "+e.linea:""}</span></div>`).join("")+
        `</div>`;
      return;
    }
    cargarPartida(p);
  };
};

/* ---- cargar una partida en la mesa, en su ultima jugada ----
   Se reproduce jugada a jugada desde el reparto: asi la pila de deshacer
   queda completa y Atras recorre la partida hacia atras de verdad. */
function cargarPartida(p){
  let est;
  try{ est=aEstado(p); }catch(e){ toast("Partida inválida"); return; }
  [0,1,2,3].forEach(i=>{ sistemas[i]=est.sistemas[i]||"ninguno"; });
  simStarter=est.salidor; simDealMode=p.modo==="vivo"?"en vivo":"guardada";
  owner={}; ["S","E","N","O"].forEach((L,i)=>{ (p.manos[L]||[]).forEach(k=>{owner[k]=i;}); });

  // arranca en el reparto, con las manos completas
  GS={hands:["S","E","N","O"].map(L=>new Set((p.manos[L]||[]).map(k=>{const t=kt(k);return key(t[0],t[1]);}))),
      ends:null,sequence:[],current:est.salidor,passes:0,over:false,history:[],log:[],hist:[]};
  GS.initial=simSnap();

  est.hist.forEach(h=>{
    GS.history.push(simSnap());            // foto antes de cada jugada: eso es Atras
    if(h.paso){
      GS.hist.push({jugador:h.jugador,paso:true,pensada:null,veredicto:null,comentario:null});
      GS.log.push(`${ROLE[h.jugador]} se pasa`); GS.passes++;
    }else{
      const lado=GS.ends===null?"inicio":(h.punta||"D");
      GS.hist.push({jugador:h.jugador,ficha:h.ficha,punta:GS.ends===null?null:lado,
                    pensada:h.pensada||null,veredicto:h.veredicto||null,comentario:h.comentario||null});
      placeOnBoard(GS,h.ficha,lado);
      GS.hands[h.jugador].delete(h.ficha);
      GS.lastKey=h.ficha; GS.passes=0;
      GS.log.push(`${ROLE[h.jugador]} juega ${h.ficha}${lado==="I"?" → izq":lado==="D"?" → der":""}${h.pensada?" · "+h.pensada:""}`);
    }
    GS.current=(h.jugador+1)%4;
  });

  partidaAbierta={id:p.id||nuevoId(),titulo:p.titulo||"",etiquetas:(p.etiquetas||[]).slice(),notas:p.notas||""};
  if(!p.variante_de) analisis={partida:JSON.parse(JSON.stringify(p)),n:p.jugadas.length};
  else analisis=null;              // una variante se abre para seguir jugando
  clearPanel();show('simGame');simRender();
  toast(`Cargada: ${p.titulo||"partida"} (${p.jugadas.length} jugadas)`+(analisis?" · modo análisis":""));
}

/* ---- biblioteca ---- */
function guardarEnBiblioteca(comoNueva){
  const p=partidaActual();
  if(!p||!p.jugadas.length){toast("No hay partida que guardar");return;}
  const sugerido=(partidaAbierta&&partidaAbierta.titulo)||tituloPorDefecto();
  let titulo;
  try{ titulo=prompt("Título de la partida:",comoNueva?sugerido+" (copia)":sugerido); }catch(e){ titulo=sugerido; }
  if(titulo===null)return;
  titulo=(titulo||"").trim()||sugerido;
  const lista=leerBiblioteca();
  const id=(!comoNueva&&partidaAbierta&&partidaAbierta.id)||nuevoId();
  p.id=id; p.titulo=titulo; p.fecha=ahoraISO();
  const entrada={id:id,titulo:titulo,fecha:p.fecha,etiquetas:p.etiquetas||[],modo:p.modo,
                 jugadas:p.jugadas.length,partida:p};
  const i=lista.findIndex(x=>x.id===id);
  if(i>=0&&!comoNueva)lista[i]=entrada; else lista.push(entrada);
  guardarBiblioteca(lista);
  partidaAbierta={id:id,titulo:titulo,etiquetas:p.etiquetas||[],notas:p.notas||""};
  toast(i>=0&&!comoNueva?"Partida actualizada":"Partida guardada");
}

function panelBiblioteca(){
  const lista=leerBiblioteca();
  const filas=lista.slice().reverse().map(e=>{
    let f=""; try{f=new Date(e.fecha).toLocaleString();}catch(x){f=e.fecha||"";}
    return `<div class="saveitem" style="flex-wrap:wrap">
      <div class="nm" title="${(e.titulo||"").replace(/"/g,"'")}">${e.titulo||"(sin título)"}</div>
      <div class="dt">${f}</div>
      <div class="muted" style="width:100%;font-size:.68rem">${e.jugadas||0} jugadas · ${e.modo||"simulador"}${(e.etiquetas&&e.etiquetas.length)?" · "+e.etiquetas.join(", "):""}</div>
      <div class="btnrow" style="width:100%;margin-top:4px">
        <button class="btn gold" data-abrir="${e.id}">Abrir</button>
        <button class="btn ghost" data-dup="${e.id}">Duplicar</button>
        <button class="btn ghost" data-txt="${e.id}">Copiar texto</button>
        <button class="btn red" data-del="${e.id}">Borrar</button>
      </div></div>`;
  }).join("")||`<div class="muted center">Aún no hay partidas guardadas.</div>`;
  dpanel(`<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="center" style="margin-bottom:6px"><b>📚 Biblioteca de partidas</b></div>
    <div class="saves">${filas}</div>
    <div class="btnrow grow" style="margin-top:8px">
      <button class="btn ghost" id="btnGuardarAqui">Guardar la actual</button>
      <button class="btn ghost" onclick="clearPanel()">Cerrar</button>
    </div></div>`);
  $("#btnGuardarAqui").onclick=()=>{guardarEnBiblioteca(false);panelBiblioteca();};
  const dame=id=>leerBiblioteca().find(x=>x.id===id);
  document.querySelectorAll("#dpanel [data-abrir]").forEach(b=>b.onclick=()=>{const e=dame(b.dataset.abrir);if(e)cargarPartida(e.partida);});
  document.querySelectorAll("#dpanel [data-dup]").forEach(b=>b.onclick=()=>{
    const e=dame(b.dataset.dup); if(!e)return;
    const lista=leerBiblioteca(); const c=JSON.parse(JSON.stringify(e));
    c.id=nuevoId(); c.titulo=(c.titulo||"")+" (copia)"; c.fecha=ahoraISO(); c.partida.id=c.id; c.partida.titulo=c.titulo;
    lista.push(c); guardarBiblioteca(lista); panelBiblioteca(); toast("Duplicada");
  });
  document.querySelectorAll("#dpanel [data-txt]").forEach(b=>b.onclick=()=>{
    const e=dame(b.dataset.txt); if(!e)return;
    const txt=aTexto(e.partida);
    alPortapapeles(txt);
    dpanel(`<div class="ovcard" style="max-height:82vh;overflow:auto">
      <div class="center" style="margin-bottom:6px"><b>📋 ${e.titulo||"Partida"}</b></div>
      <textarea id="txtPartida" class="txtpartida" readonly>${txt.replace(/</g,"&lt;")}</textarea>
      <div class="btnrow grow" style="margin-top:8px">
        <button class="btn ghost" id="volverBib">← Biblioteca</button>
        <button class="btn ghost" onclick="clearPanel()">Cerrar</button></div></div>`);
    const ta=$("#txtPartida"); if(ta){ta.focus();ta.select();}
    $("#volverBib").onclick=panelBiblioteca;
  });
  document.querySelectorAll("#dpanel [data-del]").forEach(b=>b.onclick=()=>{
    const e=dame(b.dataset.del); if(!e)return;
    let ok=false; try{ok=confirm(`¿Borrar "${e.titulo||"la partida"}"? No se puede deshacer.`);}catch(x){ok=true;}
    if(!ok)return;
    guardarBiblioteca(leerBiblioteca().filter(x=>x.id!==e.id)); panelBiblioteca(); toast("Borrada");
  });
}

/* ---- datos de la partida abierta: titulo y etiquetas ---- */
function panelDatosPartida(){
  const a=partidaAbierta||{titulo:"",etiquetas:[],notas:""};
  dpanel(`<div class="ovcard">
    <div class="center" style="margin-bottom:6px"><b>🏷️ Datos de la partida</b></div>
    <label class="fld">Título</label>
    <input id="pTitulo" class="txtcampo" value="${(a.titulo||"").replace(/"/g,"&quot;")}">
    <label class="fld">Etiquetas (separadas por comas)</label>
    <input id="pEtiq" class="txtcampo" value="${(a.etiquetas||[]).join(", ").replace(/"/g,"&quot;")}">
    <label class="fld">Notas</label>
    <textarea id="pNotas" class="txtpartida" style="height:70px">${(a.notas||"").replace(/</g,"&lt;")}</textarea>
    <div class="btnrow grow" style="margin-top:8px">
      <button class="btn gold" id="pOk">Guardar datos</button>
      <button class="btn ghost" onclick="clearPanel()">Cerrar</button>
    </div></div>`);
  $("#pOk").onclick=()=>{
    partidaAbierta=Object.assign({id:(partidaAbierta&&partidaAbierta.id)||nuevoId()},{
      titulo:$("#pTitulo").value.trim(),
      etiquetas:$("#pEtiq").value.split(",").map(x=>x.trim()).filter(Boolean),
      notas:$("#pNotas").value,
    });
    // si ya estaba en la biblioteca, actualiza tambien alli
    const lista=leerBiblioteca(); const i=lista.findIndex(x=>x.id===partidaAbierta.id);
    if(i>=0){lista[i].titulo=partidaAbierta.titulo;lista[i].etiquetas=partidaAbierta.etiquetas;
      lista[i].partida.titulo=partidaAbierta.titulo;lista[i].partida.etiquetas=partidaAbierta.etiquetas;
      lista[i].partida.notas=partidaAbierta.notas;guardarBiblioteca(lista);}
    clearPanel();toast("Datos guardados");
  };
}

$("#tbBiblio").onclick=panelBiblioteca;
$("#tbDatos").onclick=panelDatosPartida;

/* ---- modo analisis: cursor, anotacion y resumen ----
   Al abrir o pegar una partida se entra en modo analisis: el cursor recorre
   las jugadas sin borrar nada. Jugar desde una posicion que no es la ultima
   no modifica la partida: se ofrece duplicarla truncada como variante. */
let analisis=null;      // {partida, n} o null cuando se juega normal

function enAnalisis(){return !!analisis;}
function analisisAbrir(p,n){
  analisis={partida:JSON.parse(JSON.stringify(p)),n:(n===undefined?p.jugadas.length:n)};
  analisisPintar();
}
function analisisSalir(){analisis=null;}

// monta GS con la posicion del cursor (solo para pintar y para Mano/Sugerir/Prob)
function analisisPintar(){
  const p=analisis.partida, pos=posicionEn(p,analisis.n);
  [0,1,2,3].forEach(i=>{sistemas[i]=pos.sistemas[i]||"ninguno";});
  simStarter=pos.salidor; simDealMode=p.modo==="vivo"?"en vivo":"guardada";
  GS={hands:["S","E","N","O"].map(L=>new Set(pos.manos[L]||[])),
      ends:null,sequence:[],current:pos.current,passes:pos.passes,over:false,
      history:[],log:[],hist:pos.hist.slice()};
  pos.hist.filter(h=>!h.paso).forEach(h=>{placeOnBoard(GS,h.ficha,GS.ends===null?"inicio":(h.punta||"D"));});
  GS.lastKey=(pos.hist.filter(h=>!h.paso).slice(-1)[0]||{}).ficha||null;
  GS.log=pos.hist.map(h=>h.paso?`${ROLE[h.jugador]} se pasa`
    :`${ROLE[h.jugador]} juega ${h.ficha}${h.punta==="I"?" → izq":h.punta==="D"?" → der":""}${h.pensada?" · "+h.pensada:""}`);
  GS.initial=simSnap();
  show('simGame');simRender();
}
function analisisIr(n){
  if(!analisis)return;
  analisis.n=Math.max(0,Math.min(n,analisis.partida.jugadas.length));
  analisisPintar();
}

/* barra del cursor, encima de tu mano */
function barraCursor(){
  if(!enAnalisis())return "";
  const t=analisis.partida.jugadas.length;
  return `<div class="cursorbar">
    <button class="tb b-rew" data-cur="0">⏮</button>
    <button class="tb b-back" data-cur="${analisis.n-1}">◀</button>
    <span class="curnum">jugada <b>${analisis.n}</b> de ${t}</span>
    <button class="tb b-back" data-cur="${analisis.n+1}">▶</button>
    <button class="tb b-rew" data-cur="${t}">⏭</button>
    <button class="tb b-copiar" id="curHist">📜 Historial</button>
    ${analisis.soloLectura?'<button class="tb b-user" id="curComp">🔒 compartida</button>':""}
  </div>`;
}
document.addEventListener("click",ev=>{
  const b=ev.target.closest("[data-cur]");
  if(b){analisisIr(+b.dataset.cur);return;}
  if(ev.target.closest("#curHist")){panelHistorial();return;}
  if(ev.target.closest("#curComp")){panelCompartida();return;}
});

/* ---- historial navegable y anotable ---- */
const ICONO={correcta:"✓",dudosa:"?",error:"✗"};
function panelHistorial(){
  if(!enAnalisis()){toast("Solo en modo análisis");return;}
  const p=analisis.partida;
  const filas=p.jugadas.map(j=>{
    const marca=j.veredicto?`<b class="vd v-${j.veredicto}">${ICONO[j.veredicto]}</b>`:"";
    const com=j.comentario?`<span title="${j.comentario.replace(/"/g,"'")}">💬</span>`:"";
    const txt=j.pase?"pasa":`${j.ficha}${j.lado?" "+(j.lado==="I"?"izq":"der"):""}${j.pensada?" · "+j.pensada:""}`;
    return `<div class="row histrow${analisis.n===j.n?" aqui":""}" data-jug="${j.n}">
      <span>${j.n}. <b>${j.jugador}</b> ${txt}</span><span>${marca} ${com}</span></div>`;
  }).join("");
  dpanel(`<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="center" style="margin-bottom:6px"><b>📜 Historial</b></div>
    <div class="muted" style="font-size:.7rem;margin-bottom:4px">Toca una jugada para ir a ella y anotarla.</div>
    <div class="probpanel">${filas||'<div class="muted">Sin jugadas.</div>'}</div>
    <div class="btnrow grow" style="margin-top:8px">
      <button class="btn ghost" id="verResumen">📊 Resumen</button>
      <button class="btn ghost" onclick="clearPanel()">Cerrar</button></div></div>`);
  document.querySelectorAll("#dpanel [data-jug]").forEach(el=>el.onclick=()=>{
    analisisIr(+el.dataset.jug); panelJugada(+el.dataset.jug);
  });
  $("#verResumen").onclick=panelResumen;
}

/* ficha de anotacion de una jugada */
function panelJugada(n){
  const p=analisis.partida, j=p.jugadas[n-1];
  if(!j){clearPanel();return;}
  const seat=SEAT_DE(j.jugador);
  // que habria sugerido el propio jugador, con lo que el sabia
  let sug=null, est=null;
  try{ est=estadoPara(p,n-1,j.jugador); if(est) sug=sugerirJugada(est); }catch(e){}
  // y la IA con informacion completa, solo si se conocen las cuatro manos
  let ia=null;
  const completas=["S","E","N","O"].every(L=>Array.isArray(p.manos[L]));
  if(completas&&!j.pase){
    try{
      const pos=posicionEn(p,n-1);
      const manos=["S","E","N","O"].map(L=>new Set(pos.manos[L]));
      const mv=aiBestMovesDeep(manos,pos.ends,seat,pos.passes);
      if(mv.length)ia={k:mv[0].k,side:mv[0].side};
    }catch(e){}
  }
  const jugado=j.pase?null:j.ficha;
  const difiere=sug&&jugado&&sug.recomendada.ficha!==jugado;
  const bot=(v,txt)=>`<button class="btn ${j.veredicto===v?"gold":"ghost"}" data-vd="${v===null?"":v}">${txt}</button>`;
  dpanel(`<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="center" style="margin-bottom:4px"><b>Jugada ${n} · ${j.jugador}</b></div>
    <div class="center" style="margin-bottom:6px">${j.pase?'<span class="muted">pasa</span>'
      :tileHTML(kt(j.ficha)[0],kt(j.ficha)[1],"md")+`<div class="muted" style="font-size:.7rem">${j.lado==="I"?"por la izquierda":j.lado==="D"?"por la derecha":"salida"}${j.pensada?" · "+j.pensada:""}</div>`}</div>
    <div class="probpanel">
      ${analisis.soloLectura
        ? `<div class="row"><span class="muted">Veredicto</span><span>${j.veredicto?ICONO[j.veredicto]+" "+j.veredicto:"sin veredicto"}</span></div>`+
          (j.comentario?`<div class="muted" style="font-size:.72rem;margin-top:4px">“${j.comentario.replace(/</g,"&lt;")}”</div>`:"")
        : `<div class="muted" style="font-size:.72rem;margin-bottom:4px">Veredicto (lo pones tú):</div>
      <div class="btnrow grow">${bot("correcta","✓ correcta")}${bot("dudosa","? dudosa")}${bot("error","✗ error")}</div>
      <div class="btnrow grow" style="margin-top:6px">${bot(null,"sin veredicto")}</div>
      <label class="fld">Comentario</label>
      <textarea id="jComent" class="txtpartida" style="min-height:60px">${(j.comentario||"").replace(/</g,"&lt;")}</textarea>`}
    </div>
    <div class="probpanel" style="margin-top:8px">
      <div class="muted" style="font-size:.72rem;margin-bottom:4px">Sugerir aquí (solo con lo que ${j.jugador} sabía):</div>
      ${!est?'<div class="muted">No se conoce su mano.</div>'
        :!sug?'<div class="muted">Sin jugada posible.</div>'
        :`<div class="row"><span><b>${sug.recomendada.ficha}</b> ${sug.recomendada.punta==="I"?"izq":sug.recomendada.punta==="D"?"der":"salida"}</span><span class="muted">${sug.confianza}</span></div>`+
          sug.razones.map(r=>`<div class="muted" style="font-size:.7rem">· ${r.texto} <i>${r.principio}</i></div>`).join("")}
      ${difiere?`<div class="difiere">Sugerir habría jugado <b>${sug.recomendada.ficha}</b> por la ${sug.recomendada.punta==="I"?"izquierda":"derecha"} · tú jugaste ${jugado}</div>`:""}
    </div>
    ${ia?`<div class="probpanel" style="margin-top:8px">
      <div class="muted" style="font-size:.72rem">IA aquí (ve las cuatro manos):</div>
      <div><b>${ia.k}</b> <span class="muted">${ia.side==="I"?"izq":ia.side==="D"?"der":"salida"}</span>${ia.k===jugado?' <span class="muted">— coincide</span>':""}</div>
    </div>`:(completas?"":`<div class="muted" style="font-size:.7rem;margin-top:6px">IA aquí no disponible: no se conocen las cuatro manos.</div>`)}
    <div class="btnrow grow" style="margin-top:8px">
      ${analisis.soloLectura?"":'<button class="btn gold" id="jGuardar">Guardar anotación</button>'}
      <button class="btn ghost" id="jVolver">← Historial</button>
    </div>
    <div class="btnrow grow" style="margin-top:6px">
      <button class="btn blue" id="jProbar">🔀 Probar desde aquí</button>
    </div></div>`);
  document.querySelectorAll("#dpanel [data-vd]").forEach(b=>b.onclick=()=>{
    j.veredicto=b.dataset.vd||null; panelJugada(n);
  });
  const gb=$("#jGuardar"); if(gb) gb.onclick=()=>{ j.comentario=$("#jComent").value; guardarAnalisis(); panelHistorial(); };
  $("#jVolver").onclick=()=>{ if($("#jComent")) j.comentario=$("#jComent").value; panelHistorial(); };
  $("#jProbar").onclick=()=>probarDesdeAqui(n);
}
function SEAT_DE(L){return {S:0,E:1,N:2,O:3}[L];}

/* persistencia de las anotaciones en la entrada de la biblioteca */
function guardarAnalisis(){
  if(!analisis)return;
  const lista=leerBiblioteca(), i=lista.findIndex(x=>x.id===analisis.partida.id);
  if(i<0)return;
  lista[i].partida=JSON.parse(JSON.stringify(analisis.partida));
  guardarBiblioteca(lista); toast("Anotación guardada");
}

/* jugar desde una posicion intermedia no altera la partida guardada */
function ofrecerVariante(k,side){
  const n=analisis.n, t=analisis.partida.jugadas.length;
  dpanel(`<div class="ovcard">
    <div class="center" style="margin-bottom:6px"><b>${analisis.soloLectura?"Partida compartida (solo lectura)":"Estás en la jugada "+n+" de "+t}</b></div>
    <div class="muted" style="font-size:.74rem">${analisis.soloLectura?"No se puede jugar ni anotar sobre una partida que te han compartido.":"Retroceder no borra nada: la partida guardada se queda como está."}
      Si quieres seguir por otro camino desde aquí, se crea una variante aparte.</div>
    <div class="btnrow grow" style="margin-top:10px">
      <button class="btn gold" id="varSi">🔀 Probar desde aquí</button>
      <button class="btn ghost" id="varFin">⏭ Ir al final</button>
    </div>
    <div class="btnrow grow" style="margin-top:6px"><button class="btn ghost" onclick="clearPanel()">Cancelar</button></div>
  </div>`);
  $("#varSi").onclick=()=>{ probarDesdeAqui(n); if(k)simDo(k,side); };
  $("#varFin").onclick=()=>{ analisisIr(t); clearPanel(); };
}

/* ---- probar desde aqui ---- */
function probarDesdeAqui(n){
  const v=truncar(analisis.partida,n,{id:nuevoId(),fecha:ahoraISO()});
  const lista=leerBiblioteca();
  lista.push({id:v.id,titulo:v.titulo,fecha:v.fecha,etiquetas:v.etiquetas||[],
              modo:v.modo,jugadas:v.jugadas.length,partida:v});
  guardarBiblioteca(lista);
  analisisSalir();
  cargarPartida(v);
  toast("Variante creada desde la jugada "+n);
}

/* ---- resumen del analisis ---- */
function panelResumen(){
  if(!enAnalisis()){toast("Solo en modo análisis");return;}
  const p=analisis.partida;
  const cuenta={}; ["S","E","N","O"].forEach(L=>cuenta[L]={correcta:0,dudosa:0,error:0,total:0});
  const difs=[];
  p.jugadas.forEach(j=>{
    cuenta[j.jugador].total++;
    if(j.veredicto)cuenta[j.jugador][j.veredicto]++;
    if(j.pase)return;
    let s=null; try{const e=estadoPara(p,j.n-1,j.jugador); if(e)s=sugerirJugada(e);}catch(x){}
    if(s&&s.recomendada.ficha!==j.ficha)
      difs.push({n:j.n,jugador:j.jugador,jugado:j.ficha,sugerido:s.recomendada.ficha,
                 punta:s.recomendada.punta,veredicto:j.veredicto||null});
  });
  const filas=["S","E","N","O"].map(L=>`<div class="row"><span><b>${L}</b> <span class="muted">(${cuenta[L].total})</span></span>
    <span><b class="v-correcta">✓ ${cuenta[L].correcta}</b> · <b class="v-dudosa">? ${cuenta[L].dudosa}</b> · <b class="v-error">✗ ${cuenta[L].error}</b></span></div>`).join("");
  const listaDif=difs.length?difs.map(d=>`<div class="row" data-jug="${d.n}"><span>${d.n}. <b>${d.jugador}</b> jugó ${d.jugado}</span><span class="muted">Sugerir: ${d.sugerido} ${d.punta==="I"?"izq":"der"}</span></div>`).join("")
    :`<div class="muted">Ninguna: coincide en todas (o no se conocen las manos).</div>`;
  dpanel(`<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="center" style="margin-bottom:6px"><b>📊 Resumen del análisis</b></div>
    <div class="probpanel"><div class="muted" style="font-size:.72rem;margin-bottom:4px">Veredictos por jugador:</div>${filas}</div>
    <div class="probpanel" style="margin-top:8px">
      <div class="muted" style="font-size:.72rem;margin-bottom:4px">Difieren de Sugerir (${difs.length}):</div>${listaDif}</div>
    <div class="btnrow grow" style="margin-top:8px">
      <button class="btn blue" id="expPos">📤 Exportar posiciones</button>
      <button class="btn ghost" id="resVolver">← Historial</button></div>
    <div class="btnrow grow" style="margin-top:6px"><button class="btn ghost" onclick="clearPanel()">Cerrar</button></div>
    </div>`);
  document.querySelectorAll("#dpanel [data-jug]").forEach(el=>el.onclick=()=>{
    analisisIr(+el.dataset.jug); panelJugada(+el.dataset.jug);});
  $("#resVolver").onclick=panelHistorial;
  $("#expPos").onclick=()=>exportarPosiciones(p);
}

/* semilla del corpus de calibracion */
function exportarPosiciones(p){
  const out=[];
  p.jugadas.forEach(j=>{
    if(!j.veredicto&&!j.comentario)return;          // solo las anotadas
    let estado=null,sug=null;
    try{ estado=estadoPara(p,j.n-1,j.jugador); if(estado)sug=sugerirJugada(estado); }catch(e){}
    out.push({
      partida:p.id||null, titulo:p.titulo||"", n:j.n, jugador:j.jugador,
      estado:estado,
      jugado:j.pase?{pase:true}:{ficha:j.ficha,lado:j.lado,pensada:j.pensada||null},
      sugerido:sug?{ficha:sug.recomendada.ficha,punta:sug.recomendada.punta,
                    confianza:sug.confianza,razones:sug.razones}:null,
      veredicto:j.veredicto||null, comentario:j.comentario||"",
    });
  });
  const txt=JSON.stringify(out,null,2);
  alPortapapeles(txt);
  dpanel(`<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="center" style="margin-bottom:6px"><b>📤 Posiciones anotadas (${out.length})</b></div>
    <div class="muted" style="font-size:.7rem;margin-bottom:6px">JSON con el estado legítimo de cada jugada anotada, lo jugado, lo sugerido y tu veredicto.</div>
    <textarea id="txtPartida" class="txtpartida" readonly>${txt.replace(/</g,"&lt;")}</textarea>
    <div class="btnrow grow" style="margin-top:8px">
      <button class="btn ghost" id="expVolver">← Resumen</button>
      <button class="btn ghost" onclick="clearPanel()">Cerrar</button></div></div>`);
  const ta=$("#txtPartida"); if(ta){ta.focus();ta.select();}
  $("#expVolver").onclick=panelResumen;
}

/* ---- compartir por enlace y abrir una partida compartida ----
   Todo el acceso a "la nube" pasa por nube.js. Hoy el enlace lleva la partida
   dentro del fragmento; manana sera el backend y esta parte no cambia. */

function kb(n){return (n/1024).toFixed(1).replace(".",",")+" KB";}

$("#tbEnlace").onclick=async()=>{
  const p=enAnalisis()?analisis.partida:partidaActual();
  if(!p||!p.jugadas.length){toast("No hay partida que compartir");return;}
  dpanel(`<div class="ovcard"><div class="muted center">Preparando el enlace…</div></div>`);
  let r;
  try{ r=await publicar(p); }catch(e){ toast("No pude generar el enlace"); clearPanel(); return; }
  if(r.ok){ mostrarEnlace(r); return; }
  // demasiado largo: nunca devolvemos en silencio una URL que el navegador corte
  const sinCom=await publicar(p,{sinComentarios:true});
  dpanel(`<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="center" style="margin-bottom:6px"><b>🔗 El enlace no cabe</b></div>
    <div class="muted" style="font-size:.74rem">Ocupa ${r.tamano} caracteres y el límite seguro son ${r.limite}.
      Algunos navegadores lo cortarían sin avisar, así que no te lo doy tal cual.</div>
    <div class="btnrow grow" style="margin-top:10px">
      <button class="btn gold" id="enSinCom">Sin comentarios de jugada (${sinCom.tamano} car.)</button>
    </div>
    <div class="btnrow grow" style="margin-top:6px">
      <button class="btn blue" id="enTexto">Compartir el texto en su lugar</button>
      <button class="btn ghost" onclick="clearPanel()">Cancelar</button>
    </div></div>`);
  $("#enSinCom").onclick=()=>{
    if(!sinCom.ok){toast("Sigue sin caber: comparte el texto");return;}
    mostrarEnlace(sinCom,"Sin los comentarios de jugada.");
  };
  $("#enTexto").onclick=()=>{clearPanel();$("#tbCopiar").click();};
};

function mostrarEnlace(r,nota){
  const copiado=alPortapapeles(r.url);
  dpanel(`<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="center" style="margin-bottom:6px"><b>🔗 Enlace de la partida</b></div>
    <div class="muted" style="font-size:.72rem;margin-bottom:6px">
      ${copiado?"Copiado al portapapeles. ":""}Si no se copió, selecciona y copia a mano:</div>
    <textarea id="txtPartida" class="txtpartida" style="min-height:110px" readonly>${r.url}</textarea>
    <div class="row" style="margin-top:6px"><span class="muted">Tamaño</span>
      <span>${kb(r.tamano)} de ${kb(r.limite)}</span></div>
    ${nota?`<div class="muted" style="font-size:.7rem">${nota}</div>`:""}
    <div class="muted" style="font-size:.68rem;margin-top:6px">La partida viaja dentro del enlace, en la parte que el navegador no manda a ningún servidor.</div>
    <button class="btn ghost" style="width:100%;margin-top:8px" onclick="clearPanel()">Cerrar</button>
  </div>`);
  const ta=$("#txtPartida"); if(ta){ta.focus();ta.select();}
}

/* ---- abrir una partida compartida (solo lectura) ---- */
async function abrirDesdeEnlace(){
  const h=location.hash||"";
  if(h.indexOf("p=")<0)return false;
  let p;
  try{ p=await abrir(h); }
  catch(e){
    dpanel(`<div class="ovcard">
      <div class="center" style="margin-bottom:6px"><b>No pude abrir el enlace</b></div>
      <div class="muted" style="font-size:.74rem">${(e.message||"Enlace no válido").replace(/</g,"&lt;")}</div>
      <div class="muted" style="font-size:.7rem;margin-top:6px">Puede haberse cortado al copiarlo. Pide que te lo manden otra vez, o usa 📥 Pegar con el texto de la partida.</div>
      <button class="btn ghost" style="width:100%;margin-top:8px" onclick="clearPanel()">Seguir a la mesa</button>
    </div>`);
    return false;                       // la app arranca normal igualmente
  }
  compartidaAbrir(p);
  return true;
}

function compartidaAbrir(p){
  partidaAbierta={id:p.id||nuevoId(),titulo:p.titulo||"",etiquetas:(p.etiquetas||[]).slice(),notas:p.notas||""};
  analisis={partida:JSON.parse(JSON.stringify(p)),n:p.jugadas.length,soloLectura:true};
  analisisPintar();
  panelCompartida();
}

function panelCompartida(){
  const p=analisis.partida;
  let f=""; try{f=p.fecha?new Date(p.fecha).toLocaleString():"";}catch(e){f=p.fecha||"";}
  dpanel(`<div class="ovcard" style="max-height:82vh;overflow:auto">
    <div class="solectura">Partida compartida · solo lectura</div>
    <div class="center" style="margin:6px 0 2px"><b>${(p.titulo||"(sin título)").replace(/</g,"&lt;")}</b></div>
    <div class="muted center" style="font-size:.72rem">${p.autor?p.autor+" · ":""}${f}${p.etiquetas&&p.etiquetas.length?" · "+p.etiquetas.join(", "):""}</div>
    <div class="muted center" style="font-size:.7rem;margin-top:4px">${p.jugadas.length} jugadas · ${p.modo||"simulador"}</div>
    ${p.notas?`<div class="probpanel" style="margin-top:8px"><div class="muted" style="font-size:.72rem">${p.notas.replace(/</g,"&lt;")}</div></div>`:""}
    <div class="muted" style="font-size:.7rem;margin-top:8px">Puedes recorrerla con el cursor y usar 🔎 Mano, 💡 Sugerir, Prob y el resumen. Para anotarla o seguir jugando, guárdala o haz una variante.</div>
    <div class="btnrow grow" style="margin-top:10px">
      <button class="btn gold" id="cGuardar">Guardar en mi biblioteca</button>
    </div>
    <div class="btnrow grow" style="margin-top:6px">
      <button class="btn blue" id="cVariante">🔀 Probar desde aquí</button>
      <button class="btn ghost" onclick="clearPanel()">Ver la partida</button>
    </div></div>`);
  $("#cGuardar").onclick=guardarCompartida;
  $("#cVariante").onclick=()=>probarDesdeAqui(analisis.n);
}

/* Copia la partida compartida a la biblioteca conservando id, autor y
   anotaciones. Si ese id ya esta, pregunta antes de pisar nada. */
function guardarCompartida(){
  const p=JSON.parse(JSON.stringify(analisis.partida));
  const lista=leerBiblioteca();
  const i=lista.findIndex(x=>x.id===p.id);
  const meter=(id)=>{
    p.id=id;
    const e={id:id,titulo:p.titulo||"(sin título)",fecha:p.fecha||ahoraISO(),
             etiquetas:p.etiquetas||[],modo:p.modo,jugadas:p.jugadas.length,partida:p};
    const k=lista.findIndex(x=>x.id===id);
    if(k>=0)lista[k]=e; else lista.push(e);
    guardarBiblioteca(lista);
    analisis.soloLectura=false;       // ya es tuya: puedes anotarla
    partidaAbierta={id:id,titulo:p.titulo||"",etiquetas:p.etiquetas||[],notas:p.notas||""};
    analisisPintar(); clearPanel();
    toast("Guardada en tu biblioteca");
  };
  if(i<0){meter(p.id||nuevoId());return;}
  dpanel(`<div class="ovcard">
    <div class="center" style="margin-bottom:6px"><b>Ya tienes esa partida</b></div>
    <div class="muted" style="font-size:.74rem">"${(lista[i].titulo||"").replace(/</g,"&lt;")}" ya está en tu biblioteca con el mismo identificador.</div>
    <div class="btnrow grow" style="margin-top:10px">
      <button class="btn red" id="gRempl">Reemplazar</button>
      <button class="btn gold" id="gDupl">Duplicar</button>
    </div>
    <div class="btnrow grow" style="margin-top:6px"><button class="btn ghost" onclick="clearPanel()">Cancelar</button></div>
  </div>`);
  $("#gRempl").onclick=()=>meter(p.id);
  $("#gDupl").onclick=()=>{p.titulo=(p.titulo||"")+" (copia)";meter(nuevoId());};
}

// arranque: entra directo a la mesa, vacía hasta que se reparta (Al Azar / Reparto)
buildPicker();buildOwnerGrid();
simIdle();show('simGame');
// si la app se abre con #p=..., manda la partida compartida
try{ if(location.hash.indexOf("p=")>=0) abrirDesdeEnlace(); }catch(e){}

// registro del service worker (para funcionar sin conexión / instalable)
if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    try{ navigator.serviceWorker.register(new URL("sw.js",location.href)); }catch(e){}
  });
}
