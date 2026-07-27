"use strict";
/* ================= MOTOR (lógica pura, sin DOM) =================
   Se carga ANTES que ui.js como script clásico: sus funciones quedan
   en el scope global y ui.js las usa directamente. */

function allTiles(){const r=[];for(let a=0;a<=6;a++)for(let b=a;b<=6;b++)r.push([a,b]);return r;}
function key(a,b){return a<=b?a+"-"+b:b+"-"+a;}
function kt(k){return k.split("-").map(Number);}
function pip(t){return t[0]+t[1];}
function isDouble(t){return t[0]===t[1];}
function otherPip(t,e){return t[0]===e?t[1]:(t[1]===e?t[0]:null);}
function teamOf(p){return p%2;} // 0 y 2 -> equipo 0 (TÚ+CO); 1 y 3 -> equipo 1 (RD+RI)
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function legalMoves(handKeys,ends){
  const m=[];
  if(ends===null){handKeys.forEach(k=>{const t=kt(k);m.push({k,side:"inicio",newEnds:[t[0],t[1]]});});return m;}
  [[0,"I"],[1,"D"]].forEach(([i,lbl])=>{const e=ends[i];handKeys.forEach(k=>{const t=kt(k);if(t.includes(e)){const ne=ends.slice();ne[i]=otherPip(t,e);m.push({k,side:lbl,newEnds:ne});}});});
  return m;
}
function placeOnBoard(st,k,side){
  const t=kt(k);
  if(st.ends===null){st.ends=[t[0],t[1]];st.sequence=[t];}
  else{const idx=side==="I"?0:1;const e=st.ends[idx];st.ends[idx]=otherPip(t,e);if(side==="I")st.sequence.unshift(t);else st.sequence.push(t);}
}
// Reconstruye la línea orientada izquierda→derecha: cada ficha con su pip
// izquierdo (a) y derecho (b) de modo que las adyacentes casen extremo con extremo.
function orientedLine(seq){
  if(!seq.length)return [];
  if(seq.length===1){const t=seq[0];return [{a:t[0],b:t[1],dbl:t[0]===t[1]}];}
  const line=[];const t0=seq[0],t1=seq[1];
  let shared=(t0[0]===t1[0]||t0[0]===t1[1])?t0[0]:t0[1];
  let leftVal=(t0[0]===shared)?t0[1]:t0[0];
  line.push({a:leftVal,b:shared,dbl:t0[0]===t0[1]});
  let prev=shared;
  for(let i=1;i<seq.length;i++){
    const t=seq[i];
    let rightVal=(t[0]===t[1])?t[0]:((t[0]===prev)?t[1]:t[0]);
    line.push({a:prev,b:rightVal,dbl:t[0]===t[1]});
    prev=rightVal;
  }
  return line;
}

/* ---- IA con información completa ---- */
function aiScore(hands,ends,player,m){
  const t=kt(m.k);const[e0,e1]=m.newEnds;
  const opp=[(player+1)%4,(player+3)%4];const partner=(player+2)%4;const next=(player+1)%4;
  const canPlay=pl=>{const h=hands[pl];for(const k of h){const tt=kt(k);if(tt.includes(e0)||tt.includes(e1))return true;}return false;};
  let sc=0;
  if(opp.includes(next)&&!canPlay(next))sc+=3;               // hacer pasar al siguiente rival
  sc+=-1.0*opp.filter(o=>canPlay(o)).length;                 // menos rivales pueden jugar
  if(canPlay(partner))sc+=0.5;                               // el compañero mantiene juego
  sc+=0.12*pip(t);                                           // soltar peso
  if(isDouble(t))sc+=0.5+0.08*t[0];                          // soltar dobles (los altos primero)
  return sc;
}
function aiBestMoves(hands,ends,player){
  const moves=legalMoves([...hands[player]],ends);
  moves.forEach(m=>m.score=aiScore(hands,ends,player,m));
  moves.sort((a,b)=>b.score-a.score||Math.random()-0.5);
  return moves;
}

/* ---- IA con lookahead (minimax + poda alfa-beta) ---- */
function _evalHeuristic(hands, rootTeam){
  let my=0,opp=0;
  for(let p=0;p<4;p++){const s=pipsOf(hands[p]); if(teamOf(p)===rootTeam)my+=s; else opp+=s;}
  return (opp-my)*0.1;
}
function _minimax(hands, ends, cur, passes, depth, alpha, beta, rootTeam){
  for(let p=0;p<4;p++) if(hands[p].size===0){ const rs=roundScore(hands,teamOf(p),"domino",0,null,p); return rs.winTeam===rootTeam?rs.points:-rs.points; }
  if(passes>=4){ const rs=roundScore(hands,null,"tranca",0,null,null); return rs.winTeam===null?0:(rs.winTeam===rootTeam?rs.points:-rs.points); }
  if(depth<=0) return _evalHeuristic(hands, rootTeam);
  const moves=legalMoves([...hands[cur]], ends);
  const isMax=teamOf(cur)===rootTeam;
  if(!moves.length) return _minimax(hands, ends, (cur+1)%4, passes+1, depth-1, alpha, beta, rootTeam);
  moves.forEach(m=>m._h=aiScore(hands,ends,cur,m));
  moves.sort((a,b)=> isMax ? b._h-a._h : a._h-b._h);
  let best=isMax?-Infinity:Infinity;
  for(const m of moves){
    hands[cur].delete(m.k);
    const v=_minimax(hands, m.newEnds.slice(), (cur+1)%4, 0, depth-1, alpha, beta, rootTeam);
    hands[cur].add(m.k);
    if(isMax){ if(v>best)best=v; if(best>alpha)alpha=best; }
    else { if(v<best)best=v; if(best<beta)beta=best; }
    if(beta<=alpha) break;
  }
  return best;
}
function aiBestMovesDeep(hands, ends, player, passes, depth){
  const rootTeam=teamOf(player);
  const total=hands.reduce((n,h)=>n+h.size,0);
  const D = depth || (total<=12 ? 99 : 8);
  const moves=legalMoves([...hands[player]], ends);
  if(!moves.length) return [];
  const H=hands.map(h=>new Set(h));
  moves.forEach(m=>{
    H[player].delete(m.k);
    m.score=_minimax(H, m.newEnds.slice(), (player+1)%4, 0, D-1, -Infinity, Infinity, rootTeam);
    H[player].add(m.k);
  });
  moves.sort((a,b)=> b.score-a.score || (aiScore(hands,ends,player,b)-aiScore(hands,ends,player,a)));
  return moves;
}

/* ---- simulación pura para estadísticas ---- */
function simulateRound(handsArr,starter){
  const hands=handsArr.map(s=>new Set(s));
  const st={ends:null,sequence:[]};let cur=starter,passes=0,turns=0;
  while(true){
    const moves=aiBestMoves(hands,st.ends,cur);
    if(moves.length){const m=moves[0];placeOnBoard(st,m.k,m.side);hands[cur].delete(m.k);passes=0;turns++;
      if(hands[cur].size===0){return roundScore(hands,teamOf(cur),"domino",turns,starter,cur);}
    }else{passes++;turns++;if(passes>=4){return roundScore(hands,null,"tranca",turns,starter,null);}}
    cur=(cur+1)%4;
  }
}
function pipsOf(set){let s=0;for(const k of set)s+=pip(kt(k));return s;}
function roundScore(hands,winTeam,type,turns,starter,winner){
  if(type==="domino"){
    const loseTeam=1-winTeam;let pts=0;for(let p=0;p<4;p++)if(teamOf(p)===loseTeam)pts+=pipsOf(hands[p]);
    return {winTeam,type,points:pts,turns,starter,winner};
  }else{
    const tp=[0,0];for(let p=0;p<4;p++)tp[teamOf(p)]+=pipsOf(hands[p]);
    if(tp[0]===tp[1])return {winTeam:null,type,points:0,turns,starter,winner:null,tie:true};
    const wt=tp[0]<tp[1]?0:1;return {winTeam:wt,type,points:Math.max(tp[0],tp[1]),turns,starter,winner:null,tpips:tp};
  }
}

/* ---- Probabilidad de ganar (Monte Carlo desde la posición actual) ---- */
function softmaxPick(moves,T){
  let mx=-Infinity;for(const m of moves)if(m.score>mx)mx=m.score;
  let sum=0;const w=moves.map(m=>{const e=Math.exp((m.score-mx)/T);sum+=e;return e;});
  let r=Math.random()*sum;for(let i=0;i<moves.length;i++){r-=w[i];if(r<=0)return moves[i];}return moves[moves.length-1];
}
function playoutRandom(pos,T){
  const hands=pos.hands.map(a=>new Set(a));
  const st={ends:pos.ends?pos.ends.slice():null,sequence:[]};
  let cur=pos.current,passes=pos.passes||0,guard=0;
  while(guard++<200){
    const moves=legalMoves([...hands[cur]],st.ends);
    if(moves.length){
      moves.forEach(m=>m.score=aiScore(hands,st.ends,cur,m));
      const m=softmaxPick(moves,T);
      placeOnBoard(st,m.k,m.side);hands[cur].delete(m.k);passes=0;
      if(hands[cur].size===0)return roundScore(hands,teamOf(cur),"domino",0,pos.starter,cur);
    }else{passes++;if(passes>=4)return roundScore(hands,null,"tranca",0,pos.starter,null);}
    cur=(cur+1)%4;
  }
  return roundScore(hands,null,"tranca",0,pos.starter,null);
}
function winProbMC(pos,N,T){
  let a=0,b=0,tie=0,pa=0,pb=0,dom=0;
  for(let i=0;i<N;i++){
    const r=playoutRandom(pos,T);
    if(r.type==="domino")dom++;
    if(r.winTeam===0){a++;pa+=r.points;}else if(r.winTeam===1){b++;pb+=r.points;}else tie++;
  }
  return {N,pA:a/N,pB:b/N,pTie:tie/N,avgA:a?pa/a:0,avgB:b?pb/b:0,pDom:dom/N};
}

/* ---- Estimación Monte Carlo del asistente en vivo ----
   Usa el estado global LS y L_OTHERS (definidos en ui.js). Solo se invoca
   en tiempo de ejecución, cuando ui.js ya se cargó. */
function liveEstimate(trials=2500){
  const unseen=[...LS.unseen];const counts={};L_OTHERS.forEach(p=>counts[p]=LS.remaining[p]);
  const totalCap=L_OTHERS.reduce((s,p)=>s+counts[p],0);
  if(!unseen.length||totalCap===0)return null;
  const tiles=unseen.map(kt);
  const allowed=tiles.map(t=>L_OTHERS.filter(p=>!LS.forbidden[p].has(t[0])&&!LS.forbidden[p].has(t[1])));
  const order=tiles.map((_,i)=>i).sort((x,y)=>allowed[x].length-allowed[y].length);
  const tileProb=tiles.map(()=>({1:0,2:0,3:0}));const numProb={1:{},2:{},3:{}};L_OTHERS.forEach(p=>{for(let v=0;v<=6;v++)numProb[p][v]=0;});
  let success=0,att=0,maxAtt=trials*50;
  while(success<trials&&att<maxAtt){
    att++;const cap={1:counts[1],2:counts[2],3:counts[3]};const assign=new Array(tiles.length).fill(-1);let ok=true;
    for(const idx of order){const ch=allowed[idx].filter(p=>cap[p]>0);if(!ch.length){ok=false;break;}
      let tot=0;for(const p of ch)tot+=cap[p];let r=Math.random()*tot,pick=ch[0];for(const p of ch){r-=cap[p];if(r<=0){pick=p;break;}}assign[idx]=pick;cap[pick]--;}
    if(!ok)continue;success++;
    const pres={1:new Set(),2:new Set(),3:new Set()};
    for(let i=0;i<tiles.length;i++){const p=assign[i];tileProb[i][p]++;pres[p].add(tiles[i][0]);pres[p].add(tiles[i][1]);}
    for(const p of L_OTHERS)for(const v of pres[p])numProb[p][v]++;
  }
  if(!success)return null;
  for(let i=0;i<tiles.length;i++)for(const p of L_OTHERS)tileProb[i][p]/=success;
  for(const p of L_OTHERS)for(let v=0;v<=6;v++)numProb[p][v]/=success;
  const byKey={};unseen.forEach((k,i)=>byKey[k]=tileProb[i]);
  return {numProb,tileProbByKey:byKey,success};
}
