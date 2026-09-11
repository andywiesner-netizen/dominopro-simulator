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
function goTable(){GS=null;simIdle();show('simGame');}
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
      forbidden:{1:new Set(),2:new Set(),3:new Set()},current:liveStarter,passes:0,history:[],over:false};
  show('liveGame');liveRender();
};
function liveRestart(){liveSel=new Set();liveStarter=null;LS=null;$("#selCount").textContent="0";
  $("#seatPick").querySelectorAll("button").forEach(x=>x.classList.remove("sel"));$("#startBtn").disabled=true;buildPicker();}
$("#undoBtn").onclick=()=>{if(!LS.history.length){toast("Nada que deshacer");return;}liveRestore(LS.history.pop());liveRender();};

function liveSnap(){return JSON.stringify({hand:[...LS.hand],ends:LS.ends,sequence:LS.sequence,unseen:[...LS.unseen],
  remaining:{...LS.remaining},forbidden:{1:[...LS.forbidden[1]],2:[...LS.forbidden[2]],3:[...LS.forbidden[3]]},current:LS.current,passes:LS.passes,over:LS.over});}
function livePush(){LS.history.push(liveSnap());if(LS.history.length>60)LS.history.shift();}
function liveRestore(s){const o=JSON.parse(s);LS.hand=new Set(o.hand);LS.ends=o.ends;LS.sequence=o.sequence;LS.unseen=new Set(o.unseen);
  LS.remaining=o.remaining;LS.forbidden={1:new Set(o.forbidden[1]),2:new Set(o.forbidden[2]),3:new Set(o.forbidden[3])};LS.current=o.current;LS.passes=o.passes;LS.over=o.over;}

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
function livePlay(k,side){livePush();placeOnBoard(LS,k,side);LS.unseen.delete(k);LS.hand.delete(k);LS.passes=0;toast(`Jugaste ${k}`);liveAfter();}
function liveUserPass(had){livePush();if(had&&!confirm("Sí tienes jugada legal. ¿Seguro que pasas?")){LS.history.pop();return;}LS.passes++;liveAfter();}
function liveOtherTurn(p){
  $("#analysisCard").classList.add("hidden");const ac=$("#actionCard");
  ac.innerHTML=`<h2>¿Qué hizo ${ROLE[p]}?</h2><div class="muted">Toca la ficha que jugó, o “Se pasó”.</div>`;
  const fits=[];[...LS.unseen].forEach(k=>{const t=kt(k);if(LS.ends===null)fits.push({k,sides:["inicio"]});
    else{const s=[];if(t.includes(LS.ends[0]))s.push("I");if(t.includes(LS.ends[1]))s.push("D");if(s.length)fits.push({k,sides:s});}});
  fits.sort((a,b)=>pip(kt(b.k))-pip(kt(a.k)));
  const grid=document.createElement("div");grid.className="hand";grid.style.marginTop="8px";
  fits.forEach(f=>{const t=kt(f.k);const d=document.createElement("div");d.className="pick";d.innerHTML=tileHTML(t[0],t[1]);d.onclick=()=>liveChooseOther(p,f.k,f.sides);grid.appendChild(d);});
  ac.appendChild(grid);const box=document.createElement("div");box.id="sideBox";ac.appendChild(box);
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
function liveOtherPlay(p,k,side){livePush();placeOnBoard(LS,k,side);LS.unseen.delete(k);LS.remaining[p]--;LS.passes=0;toast(`${ROLE[p]} jugó ${k}`);liveAfter();}
function liveOtherPass(p){livePush();if(LS.ends!==null){LS.forbidden[p].add(LS.ends[0]);LS.forbidden[p].add(LS.ends[1]);}LS.passes++;toast(`${ROLE[p]} se pasó`);liveAfter();}
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
$("#simBulkBtn").onclick=()=>{show('simBulk');};

/* ---- juego paso a paso (manual + IA) ---- */
function startSimGame(){
  const hands=[0,1,2,3].map(p=>new Set(Object.keys(owner).filter(k=>owner[k]===p)));
  GS={hands,ends:null,sequence:[],current:simStarter,passes:0,over:false,history:[],log:[]};
  GS.initial=simSnap();
  show('simGame');simRender();
}
function simSnap(){return JSON.stringify({hands:GS.hands.map(s=>[...s]),ends:GS.ends,sequence:GS.sequence,current:GS.current,passes:GS.passes,over:GS.over,log:GS.log.slice()});}
function simPush(){GS.history.push(simSnap());if(GS.history.length>400)GS.history.shift();}
function simRestore(s){const o=JSON.parse(s);GS.hands=o.hands.map(a=>new Set(a));GS.ends=o.ends;GS.sequence=o.sequence;GS.current=o.current;GS.passes=o.passes;GS.over=o.over;GS.log=o.log;GS.lastKey=null;}
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
      el.insertAdjacentHTML("beforeend",tileHTML(a,b,"sm"+(o.dbl?" vert":"")+jp));
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
      d.innerHTML=tileHTML(t[0],t[1],portrait?"md vert":"md")+((isCur&&k===ctx.best)?'<span class="star">⭐</span>':'');
      if(isCur){ if(ctx.playable[k]){ d.classList.add("playable"); d.dataset.k=k; d.dataset.sides=ctx.playable[k].join(","); d.onclick=()=>simChoose(k,ctx.playable[k]); } else if(ctx.hasPlayable) d.classList.add("dim"); }
    }
    wrap.appendChild(d);
  });
  if(pos===0){el.appendChild(wrap);el.appendChild(lab);}else{el.appendChild(lab);el.appendChild(wrap);}
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
function simDo(k,side){simPush();const p=GS.current;placeOnBoard(GS,k,side);GS.hands[p].delete(k);GS.lastKey=k;GS.passes=0;GS.log.push(`${ROLE[p]} juega ${k}`);simNext();}

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

function simPass(){simPush();GS.log.push(`${ROLE[GS.current]} se pasa`);GS.passes++;simNext();}
function simAIMove(silent){
  if(!GS||GS.over)return;const cur=GS.current;const moves=aiBestMovesDeep(GS.hands,GS.ends,cur,GS.passes);
  if(!silent)simPush();else GS.history.push(simSnap());
  if(moves.length){const m=moves[0];placeOnBoard(GS,m.k,m.side);GS.hands[cur].delete(m.k);GS.lastKey=m.k;GS.passes=0;GS.log.push(`${ROLE[cur]} juega ${m.k}`);}
  else{GS.passes++;GS.log.push(`${ROLE[cur]} se pasa`);}
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
function posFromGame(){return {hands:GS.hands.map(s=>[...s]),ends:GS.ends?GS.ends.slice():null,sequence:GS.sequence.slice(),current:GS.current,passes:GS.passes,starter:simStarter,dealMode:simDealMode};}
function posFromDeal(){return {hands:[0,1,2,3].map(p=>Object.keys(owner).filter(k=>owner[k]===p)),ends:null,sequence:[],current:simStarter,passes:0,starter:simStarter,dealMode:simDealMode};}
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
  GS={hands:pos.hands.map(a=>new Set(a)),ends:pos.ends?pos.ends.slice():null,sequence:pos.sequence.slice(),
      current:pos.current,passes:pos.passes||0,over:false,history:[],log:[]};
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

/* ---- simulación masiva ---- */
let bulkStartMode="d6";
$("#bulkN").oninput=e=>$("#bulkNlab").textContent=e.target.value;
$("#startD6").onclick=()=>{bulkStartMode="d6";$("#startD6").classList.add("sel","gold");$("#startD6").classList.remove("ghost");$("#startRnd").classList.add("ghost");$("#startRnd").classList.remove("sel","gold");};
$("#startRnd").onclick=()=>{bulkStartMode="rnd";$("#startRnd").classList.add("sel","gold");$("#startRnd").classList.remove("ghost");$("#startD6").classList.add("ghost");$("#startD6").classList.remove("sel","gold");};
$("#runBulk").onclick=()=>{
  const N=+$("#bulkN").value;$("#bulkOut").innerHTML=`<div class="muted center" style="margin-top:12px">Simulando ${N} rondas…</div>`;
  setTimeout(()=>runBulk(N),30);
};
function runBulk(N){
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

// arranque: entra directo a la mesa, vacía hasta que se reparta (Al Azar / Reparto)
buildPicker();buildOwnerGrid();
simIdle();show('simGame');

// registro del service worker (para funcionar sin conexión / instalable)
if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    try{ navigator.serviceWorker.register(new URL("sw.js",location.href)); }catch(e){}
  });
}
