"use strict";
/* ================= TORNEO: JUGADORES MOVIDOS POR SUGERIR =================
   Modulo PURO: sin DOM, sin estado propio.

   Por que existe: aiBestMovesDeep ve las cuatro manos, asi que la informacion
   le sobra y con ella no se puede medir si informar sirve de algo. Este
   jugador mueve con sugerirJugada, que solo usa informacion legitima: su
   mano, la mesa, lo jugado, los pases y las marcas que los demas cantaron.

   AVISO QUE ACOMPANA A TODO RESULTADO: esto mide NUESTRA implementacion de
   cada sistema, no el sistema. Si Sugerir lee mejor el clasico que el
   moderno, el clasico ganara por culpa del codigo y no por doctrina. */

var _tNode = (typeof window === "undefined" && typeof require !== "undefined");
var _K = _tNode ? require("./conocimiento.js") : null;
var _sugerir = _K ? _K.sugerirJugada : sugerirJugada;
var _reconstruirT = _K ? _K.reconstruirMesa : reconstruirMesa;

const AVISO_MATRIZ =
  "Esto mide NUESTRA implementacion de cada sistema, no el sistema. Si Sugerir " +
  "lee mejor uno que otro, ese ganara por culpa del codigo y no por doctrina.";

const SISTEMAS_TORNEO = ["ninguno", "clasico", "moderno", "combinado"];

/* ---------- lo que ve un asiento cuando le toca ----------
   Se construye a mano y a proposito: solo entra su mano y lo visible. */
function estadoDelAsiento(hist, manos, yo, salidor, sistemas, convenio, pasesSeguidos) {
  let mesa;
  try { mesa = _reconstruirT(hist); } catch (e) { return null; }
  let i = 0;
  mesa.secuencia.forEach(sq => {
    while (i < hist.length && hist[i].paso) i++;
    if (i < hist.length) { sq.pensada = hist[i].pensada || null; i++; }
  });
  const primera = hist.find(h => !h.paso) || null;
  return {
    yo: yo, miMano: [...manos[yo]], ends: mesa.ends,
    secuencia: mesa.secuencia, pases: mesa.pases, salidor: salidor,
    salida: primera ? { ficha: primera.ficha, jugador: primera.jugador,
                        pensada: primera.pensada || null } : null,
    sistemas: sistemas, convenio: convenio, pasesSeguidos: pasesSeguidos,
  };
}

/* jugadaSugerida(estado) -> {ficha, punta, pensada, sistema} o null.
   La ficha, la punta Y la pensada salen del mismo consejo: en esta escuela
   son una sola decision. */
function jugadaSugerida(estado) {
  const s = _sugerir(estado);
  if (!s || !s.recomendada) return null;
  return { ficha: s.recomendada.ficha, punta: s.recomendada.punta,
           pensada: s.pensada ? s.pensada.marca : null,
           sistema: s.pensada ? s.pensada.sistema : null };
}

/* ---------- una mano completa, los cuatro movidos por Sugerir ----------
   manos = array de 4 arrays de fichas. Devuelve lo que devuelve roundScore,
   mas el historial, por si se quiere mirar la mano. */
function manoSugerida(manos, salidor, sistemas, convenio, api) {
  return continuarMano({
    h: manos.map(m => new Set(m)), st: { ends: null, sequence: [] },
    hist: [], cur: salidor, passes: 0, turns: 0, salidor: salidor,
  }, sistemas, convenio, api);
}

/* Sigue una mano desde donde este. Se usa para jugar una entera y tambien
   para bifurcar: dos continuaciones desde la MISMA posicion, cambiando solo
   una jugada, es la unica forma de saber si esa jugada valia algo. */
function continuarMano(m0, sistemas, convenio, api) {
  const A = api || {};
  const _legal = A.legalMoves || legalMoves;
  const _place = A.placeOnBoard || placeOnBoard;
  const _score = A.roundScore || roundScore;
  const _team = A.teamOf || teamOf;

  const h = m0.h, st = m0.st, hist = m0.hist, salidor = m0.salidor;
  let cur = m0.cur, passes = m0.passes || 0, turns = m0.turns || 0, guardia = 0;

  while (guardia++ < 60) {
    const legales = _legal([...h[cur]], st.ends);
    if (!legales.length) {
      hist.push({ jugador: cur, paso: true });
      passes++; turns++;
      if (passes >= 4) return Object.assign(_score(h, null, "tranca", turns, salidor, null), { hist: hist });
      cur = (cur + 1) % 4; continue;
    }
    const est = estadoDelAsiento(hist, h, cur, salidor, sistemas, convenio, passes);
    const jug = est ? jugadaSugerida(est) : null;
    // si el consejo falla por lo que sea, se juega la primera legal: la mano
    // no se queda a medias y el fallo se cuenta aparte
    const elegida = jug && legales.some(m => m.k === jug.ficha &&
                      (st.ends === null || m.side === jug.punta))
      ? { k: jug.ficha, side: st.ends === null ? "inicio" : jug.punta }
      : { k: legales[0].k, side: legales[0].side };
    if (!jug) hist.sinConsejo = (hist.sinConsejo || 0) + 1;

    hist.push({ jugador: cur, ficha: elegida.k,
                punta: st.ends === null ? null : elegida.side,
                pensada: jug ? jug.pensada : null });
    _place(st, elegida.k, elegida.side);
    h[cur].delete(elegida.k);
    passes = 0; turns++;
    if (!h[cur].size)
      return Object.assign(_score(h, _team(cur), "domino", turns, salidor, cur), { hist: hist });
    cur = (cur + 1) % 4;
  }
  return Object.assign(_score(h, null, "tranca", turns, salidor, null), { hist: hist, cortada: true });
}

/* ---------- un cruce: sistema de la pareja 0-2 contra el de la 1-3 ----------
   El salidor rota entre las cuatro posiciones para que ninguna pareja salga
   mas veces que la otra: si no, el sesgo del salidor se cuela en el marcador. */
function cruce(nManos, sisA, sisB, repartir, convenio, api) {
  const sistemas = { 0: sisA, 1: sisB, 2: sisA, 3: sisB };
  const r = { sisA: sisA, sisB: sisB, manos: 0,
              ganaA: 0, ganaB: 0, empates: 0, puntosA: 0, puntosB: 0,
              saleYGana: 0, saleYPierde: 0, dominos: 0, trancas: 0, sinConsejo: 0 };
  let sum = 0, sum2 = 0;   // diferencia de puntos por mano, para el error
  for (let i = 0; i < nManos; i++) {
    const salidor = i % 4;
    const res = manoSugerida(repartir(i), salidor, sistemas, convenio, api);
    r.manos++;
    if (res.type === "domino") r.dominos++; else r.trancas++;
    if (res.hist && res.hist.sinConsejo) r.sinConsejo += res.hist.sinConsejo;
    const d = (res.winTeam === null || res.winTeam === undefined) ? 0
            : (res.winTeam === 0 ? res.points : -res.points);
    sum += d; sum2 += d * d;
    if (res.winTeam === null || res.winTeam === undefined) { r.empates++; continue; }
    const equipoSalidor = salidor % 2;
    if (res.winTeam === equipoSalidor) r.saleYGana++; else r.saleYPierde++;
    if (res.winTeam === 0) { r.ganaA++; r.puntosA += res.points; }
    else { r.ganaB++; r.puntosB += res.points; }
  }
  const decididas = r.ganaA + r.ganaB;
  r.pctA = decididas ? +(100 * r.ganaA / decididas).toFixed(1) : null;
  r.pctSale = decididas ? +(100 * r.saleYGana / decididas).toFixed(1) : null;
  r.difPuntos = +(sum / r.manos).toFixed(2);
  // error tipico de esa media: sin esto no se sabe si una diferencia existe
  const varianza = Math.max(0, sum2 / r.manos - Math.pow(sum / r.manos, 2));
  r.errPuntos = +Math.sqrt(varianza / r.manos).toFixed(3);
  return r;
}

/* ---------- la matriz entera: los dieciseis cruces ---------- */
function matriz(nManos, repartir, convenio, api, alAvanzar) {
  const celdas = {};
  SISTEMAS_TORNEO.forEach(a => {
    celdas[a] = {};
    SISTEMAS_TORNEO.forEach(b => {
      celdas[a][b] = cruce(nManos, a, b, repartir, convenio, api);
      if (alAvanzar) alAvanzar(a, b, celdas[a][b]);
    });
  });
  return { celdas: celdas, manosPorCelda: nManos, sistemas: SISTEMAS_TORNEO,
           convenio: convenio, aviso: AVISO_MATRIZ };
}

/* ---------- leer la matriz sin el sesgo del reparto ----------
   La celda (A,B) y su espejo (B,A) juegan los MISMOS repartos con los papeles
   cambiados, asi que lo que tengan de sesgo de asiento o de reparto esta en
   las dos con el mismo signo. Promediando la celda con el reverso de su
   espejo, ese sesgo se cancela y queda solo la ventaja de A sobre B.
   Se nota en la diagonal: sin esto no da 50 % exacto, y deberia. */
function simetrizar(m) {
  const S = m.sistemas, v = {}, pts = {}, err = {};
  S.forEach(a => {
    v[a] = {}; pts[a] = {};
    S.forEach(b => {
      const ab = m.celdas[a][b], ba = m.celdas[b][a];
      v[a][b] = (ab.pctA === null || ba.pctA === null) ? null
              : +(((ab.pctA + (100 - ba.pctA)) / 2) - 50).toFixed(2);
      pts[a][b] = +(((ab.difPuntos - ba.difPuntos) / 2)).toFixed(3);
      // el error de la media simetrizada: media de dos medias independientes
      err[a] = err[a] || {};
      err[a][b] = +(Math.sqrt(Math.pow(ab.errPuntos, 2) + Math.pow(ba.errPuntos, 2)) / 2).toFixed(3);
    });
  });
  return { victorias: v, puntos: pts, errPuntos: err };
}

/* ---------- control de cordura ----------
   Con los dos bandos en el mismo sistema el reparto manda y el resultado debe
   quedar cerca del 50%. El taller cifra en ~60% la ventaja de quien sale, asi
   que eso SI debe verse. Si no sale asi, el fallo es del arnes. */
function cordura(nManos, repartir, convenio, api) {
  const filas = SISTEMAS_TORNEO.map(s => {
    const c = cruce(nManos, s, s, repartir, convenio, api);
    return { sistema: s, manos: c.manos, pctA: c.pctA, pctSale: c.pctSale,
             difPuntos: c.difPuntos, empates: c.empates, sinConsejo: c.sinConsejo };
  });
  const malSimetria = filas.filter(f => f.pctA !== null && Math.abs(f.pctA - 50) > 8);
  const malSalidor = filas.filter(f => f.pctSale !== null && (f.pctSale < 50 || f.pctSale > 72));
  return { filas: filas, ok: !malSimetria.length && !malSalidor.length,
           malSimetria: malSimetria, malSalidor: malSalidor, aviso: AVISO_MATRIZ };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { jugadaSugerida, estadoDelAsiento, manoSugerida, continuarMano, cruce, matriz, simetrizar,
                     cordura, SISTEMAS_TORNEO, AVISO_MATRIZ };
}
