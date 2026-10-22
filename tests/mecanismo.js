/* ================= CUANTO DECIDEN DE VERDAD LAS LECTURAS =================
   No es una prueba de regresion: mide y reporta.

   La matriz de sistemas da diferencias minimas. Antes de concluir nada del
   domino hay que saber si el cuello de botella es NUESTRO: si las lecturas de
   pensada casi nunca cambian la jugada elegida, la matriz no mide sistemas,
   mide que nuestras lecturas no deciden.

   1) cuantas veces cambia la ficha o la punta al apagar las lecturas
   2) cuando cambia, cual de las dos jugadas acaba ganando la mano
   3) si el efecto crece al subir el peso de las lecturas

   Uso: node tests/mecanismo.js [manos] [semilla]
*/
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8"));
const C = require("../conocimiento.js");
const T = require("../torneo.js");

const MANOS = +(process.argv[2] || 300);
const SEMILLA = +(process.argv[3] || 20261022);
const CONVENIO = "fuerza";
const SISTEMAS = ["clasico", "moderno", "combinado"];

/* Todo lo que en sugerirJugada depende de una marca cantada. Apagarlos es
   jugar exactamente igual pero sin leer a nadie. */
const PESOS_LECTURA = ["lecturaCompanero", "lecturaCompaneroNo", "lecturaCastigarFuerte",
  "lecturaNoDarFuerte", "lecturaCubrirContrario", "repetirSalidaFuerte",
  "repetirSalidaCalidad", "iniciativaPropia", "dificultarBuenJuego"];
/* Leer al companero y leer al contrario son dos cosas distintas: su sistema se
   sabe, el de ellos se deduce. Medirlas juntas esconde cual aporta. */
const DEL_COMPANERO = ["lecturaCompanero", "lecturaCompaneroNo",
  "repetirSalidaFuerte", "repetirSalidaCalidad", "iniciativaPropia"];
const DEL_CONTRARIO = ["lecturaCastigarFuerte", "lecturaNoDarFuerte",
  "lecturaCubrirContrario", "dificultarBuenJuego"];
const P = C.PESOS_SUGERENCIA;
const ORIGINAL = {}; PESOS_LECTURA.forEach(k => ORIGINAL[k] = P[k]);
const ponPesos = factor => PESOS_LECTURA.forEach(k => { P[k] = ORIGINAL[k] * factor; });
// deja encendido solo un subconjunto
const soloEstos = lista => PESOS_LECTURA.forEach(k => { P[k] = lista.indexOf(k) >= 0 ? ORIGINAL[k] : 0; });

function repartidor(semilla) {
  return function (i) {
    let x = (semilla + i * 2654435761) >>> 0;
    const rnd = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    const t = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) t.push(a + "-" + b);
    for (let k = t.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [t[k], t[j]] = [t[j], t[k]]; }
    return [0, 1, 2, 3].map(p => t.slice(p * 7, p * 7 + 7));
  };
}
const repartir = repartidor(SEMILLA);
const clonar = m => ({ h: m.h.map(s => new Set(s)), st: { ends: m.st.ends ? m.st.ends.slice() : null,
  sequence: m.st.sequence.map(t => t.slice()) }, hist: m.hist.map(x => Object.assign({}, x)),
  cur: m.cur, passes: m.passes, turns: m.turns, salidor: m.salidor });

console.log("AVISO: " + T.AVISO_MATRIZ + "\n");
console.log("Mecanismo · " + MANOS + " manos por sistema · semilla " + SEMILLA + "\n");

/* ---------- 1 y 2: divergencias y quien gana ---------- */
console.log("1) ¿Cuántas veces la lectura cambia la jugada? Y cuando cambia, ¿acierta?\n");
const t0 = Date.now();
function medir(encender, etiqueta) {
const resumen = {};
SISTEMAS.forEach(sis => {
  const sistemas = { 0: sis, 1: sis, 2: sis, 3: sis };
  let decisiones = 0, cambios = 0, ganaCon = 0, ganaSin = 0, igual = 0;

  for (let i = 0; i < MANOS; i++) {
    const salidor = i % 4;
    const m = { h: repartir(i).map(x => new Set(x)), st: { ends: null, sequence: [] },
                hist: [], cur: salidor, passes: 0, turns: 0, salidor: salidor };
    let guardia = 0;
    while (guardia++ < 60) {
      const legales = legalMoves([...m.h[m.cur]], m.st.ends);
      if (!legales.length) {
        m.hist.push({ jugador: m.cur, paso: true });
        m.passes++; m.turns++;
        if (m.passes >= 4) break;
        m.cur = (m.cur + 1) % 4; continue;
      }
      const est = T.estadoDelAsiento(m.hist, m.h, m.cur, m.salidor, sistemas, CONVENIO, m.passes);
      encender(); const conL = est ? T.jugadaSugerida(est) : null;
      ponPesos(0); const sinL = est ? T.jugadaSugerida(est) : null;
      encender();
      if (conL && sinL) {
        decisiones++;
        const distinta = conL.ficha !== sinL.ficha || conL.punta !== sinL.punta;
        if (distinta) {
          cambios++;
          /* Se bifurca: la misma posicion, solo cambia ESTA jugada. El resto
             de la mano lo juegan los cuatro igual en las dos ramas, asi que
             la diferencia es solo de esta decision. */
          const equipo = teamOf(m.cur);
          const rama = (jug) => {
            const c = clonar(m);
            c.hist.push({ jugador: c.cur, ficha: jug.ficha,
                          punta: c.st.ends === null ? null : jug.punta, pensada: jug.pensada });
            placeOnBoard(c.st, jug.ficha, c.st.ends === null ? "inicio" : jug.punta);
            c.h[c.cur].delete(jug.ficha);
            c.passes = 0; c.turns++;
            if (!c.h[c.cur].size) return roundScore(c.h, teamOf(c.cur), "domino", c.turns, c.salidor, c.cur);
            c.cur = (c.cur + 1) % 4;
            return T.continuarMano(c, sistemas, CONVENIO);
          };
          const rCon = rama(conL), rSin = rama(sinL);
          const gC = rCon.winTeam === equipo, gS = rSin.winTeam === equipo;
          if (gC && !gS) ganaCon++; else if (gS && !gC) ganaSin++; else igual++;
        }
      }
      const elegida = conL && legales.some(x => x.k === conL.ficha && (m.st.ends === null || x.side === conL.punta))
        ? { k: conL.ficha, side: m.st.ends === null ? "inicio" : conL.punta }
        : { k: legales[0].k, side: legales[0].side };
      m.hist.push({ jugador: m.cur, ficha: elegida.k,
                    punta: m.st.ends === null ? null : elegida.side,
                    pensada: conL ? conL.pensada : null });
      placeOnBoard(m.st, elegida.k, elegida.side);
      m.h[m.cur].delete(elegida.k);
      m.passes = 0; m.turns++;
      if (!m.h[m.cur].size) break;
      m.cur = (m.cur + 1) % 4;
    }
  }
  const pct = decisiones ? (100 * cambios / decisiones) : 0;
  resumen[sis] = { decisiones, cambios, pct, ganaCon, ganaSin, igual };
  console.log("  " + sis.padEnd(10) + " | " + String(decisiones).padStart(10) + " | " +
    String(cambios).padStart(7) + " | " + (pct.toFixed(1) + "%").padStart(5) + " | " +
    String(ganaCon).padStart(16) + " | " + String(ganaSin).padStart(8) + " | " + String(igual).padStart(6));
});
let tC = 0, tS = 0;
SISTEMAS.forEach(s => { tC += resumen[s].ganaCon; tS += resumen[s].ganaSin; });
const tot = tC + tS;
if (tot) {
  const pc = 100 * tC / tot, err = 100 * Math.sqrt(0.25 / tot);
  console.log("  " + etiqueta + ": cuando cambia y decide la mano, la version CON lectura gana el " +
    pc.toFixed(1) + "% (" + tC + " de " + tot + "), error \u00b1" + err.toFixed(1) +
    " \u2192 " + ((pc - 50) / err).toFixed(1) + " sigmas respecto al 50%");
}
return resumen;
}

const cab = (titulo) => {
  console.log("\n  " + titulo);
  console.log("  sistema    | decisiones | cambia  |   %   | gana con lectura | gana sin | empata");
  console.log("  -----------+------------+---------+-------+------------------+----------+-------");
};
cab("TODAS las lecturas");
medir(() => ponPesos(1), "todas");
cab("Solo lo que se lee del COMPANERO (su sistema se sabe)");
medir(() => soloEstos(DEL_COMPANERO), "companero");
cab("Solo lo que se lee de los CONTRARIOS (su sistema se deduce)");
medir(() => soloEstos(DEL_CONTRARIO), "contrarios");
ponPesos(1);
console.log("\n  " + ((Date.now() - t0) / 1000).toFixed(1) + " s");

/* ---------- 3: sensibilidad al peso ---------- */
const MANOS_M = +(process.argv[4] || 2000);
console.log("\n3) Sensibilidad al peso de las lecturas · " + MANOS_M + " manos por celda");
console.log("   Si el efecto crece con el peso, el techo lo pusimos nosotros.\n");
console.log("  factor | clasico vs ninguno | moderno vs ninguno | combinado vs ninguno");
console.log("  -------+--------------------+--------------------+---------------------");
[1, 2, 4].forEach(f => {
  ponPesos(f);
  const fila = ["clasico", "moderno", "combinado"].map(s => {
    const ab = T.cruce(MANOS_M, s, "ninguno", repartir, CONVENIO);
    const ba = T.cruce(MANOS_M, "ninguno", s, repartir, CONVENIO);
    const v = ((ab.pctA + (100 - ba.pctA)) / 2) - 50;
    const p = (ab.difPuntos - ba.difPuntos) / 2;
    const e = Math.sqrt(ab.errPuntos * ab.errPuntos + ba.errPuntos * ba.errPuntos) / 2;
    return (v > 0 ? "+" : "") + v.toFixed(2) + "% / " + (p > 0 ? "+" : "") + p.toFixed(2) + "±" + e.toFixed(2);
  });
  console.log("  x" + String(f).padEnd(5) + " | " + fila.map(x => x.padStart(18)).join(" | "));
});
ponPesos(1);
console.log("\n  Cada celda: ventaja en % de victorias / ventaja en puntos por mano.");
console.log("  " + T.AVISO_MATRIZ);
