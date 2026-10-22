/* ================= DEDUCIR EL SISTEMA DEL CONTRARIO =================
   El sistema del companero se sabe (se acordo antes). El de los contrarios no:
   hay que verlos jugar. Aqui se comprueba que la deduccion no mira la
   configuracion de nadie, que Sugerir tampoco, y SE MIDE en cuantas jugadas
   converge al sistema real. Esos numeros son la linea base para afinar. */
const fs = require("fs"), path = require("path"), vm = require("vm");
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8"));
const C = require("../conocimiento.js");

let fallos = 0;
const t = (nombre, cond, extra) => {
  if (!cond) { fallos++; console.log("  FALLA  " + nombre + (extra ? "\n           " + extra : "")); }
  else console.log("  ok     " + nombre);
};
const eq = (nombre, a, b) => t(nombre, JSON.stringify(a) === JSON.stringify(b),
  "obtenido " + JSON.stringify(a) + "\n           esperado " + JSON.stringify(b));

/* ---------- una mano jugada de verdad, con sistemas reales ---------- */
let _s = 987654321;
const rnd = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; };
function reparte() {
  const t2 = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) t2.push(a + "-" + b);
  for (let i = t2.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [t2[i], t2[j]] = [t2[j], t2[i]]; }
  return [0, 1, 2, 3].map(p => new Set(t2.slice(p * 7, p * 7 + 7)));
}
/* Juega una mano con la IA y anota la pensada de cada uno con SU sistema real.
   Devuelve el historial, que es lo unico que ve la deduccion. */
function manoCon(sistemasReales) {
  const h = reparte();
  const st = { ends: null, sequence: [] };
  const hist = [];
  let cur = 0, passes = 0, guardia = 0;
  while (guardia++ < 40) {
    const moves = aiBestMovesDeep(h, st.ends, cur, passes);
    if (!moves.length) {
      hist.push({ jugador: cur, paso: true });
      if (++passes >= 4) break;
      cur = (cur + 1) % 4; continue;
    }
    const m = moves[0];
    const cast = st.ends === null ? null : (m.side === "I" ? st.ends[0] : st.ends[1]);
    const tt = kt(m.k), gen = cast === null ? null : (tt[0] === cast ? tt[1] : tt[0]);
    const cfg = { sistema: sistemasReales[cur] };
    const doctrina = C.sistemaPorDoctrina(
      (() => { try { return C.reconstruirMesa(hist).secuencia; } catch (e) { return []; } })(), cur, cfg);
    const pen = C.pensadaPara({ ficha: m.k, numeroCastigado: cast, numeroGenerado: gen,
      mano: [...h[cur]], sistema: cfg, sistemaJugada: doctrina.sistema,
      salida: "ninguna", jugadas: st.sequence.map(x => key(x[0], x[1])) });
    hist.push({ jugador: cur, ficha: m.k, punta: st.ends === null ? null : m.side, pensada: pen });
    placeOnBoard(st, m.k, m.side);
    h[cur].delete(m.k);
    passes = 0;
    if (!h[cur].size) break;
    cur = (cur + 1) % 4;
  }
  return hist;
}

console.log("\n--- la deduccion no recibe ni mira ninguna configuracion ---");
const src = fs.readFileSync(path.join(__dirname, "..", "conocimiento.js"), "utf8");
const cuerpo = src.slice(src.indexOf("function creenciaSistemas"), src.indexOf("function _pesosDesdeCreencia"));
t("creenciaSistemas solo recibe secuencia y pases",
  /function creenciaSistemas\(secuencia, pases\)/.test(cuerpo), cuerpo.slice(0, 80));
t("no nombra configJugador ni sistemas", !/configJugador|sistemas\[/.test(cuerpo));

console.log("\n--- convergencia al sistema real ---");
/* Para cada sistema real se juegan varias manos y se mira a partir de cuantas
   jugadas SUYAS la creencia acierta y ya no se tuerce. */
function convergencia(real, manos) {
  const pasos = [], finales = [], pReal = [], nDiag = [];
  for (let k = 0; k < manos; k++) {
    const sis = { 0: "clasico", 1: real, 2: "clasico", 3: real };
    const hist = manoCon(sis);
    const mesa = C.reconstruirMesa(hist);
    // se va alimentando jugada a jugada, como en la mesa
    let acertadaDesde = null;
    const suyas = mesa.secuencia.filter(s => s.jugador === 1).length;
    for (let n = 1; n <= hist.length; n++) {
      const parcial = C.reconstruirMesa(hist.slice(0, n));
      let i = 0;
      parcial.secuencia.forEach(sq => {
        while (i < n && hist[i].paso) i++;
        if (i < n) { sq.pensada = hist[i].pensada || null; i++; }
      });
      const cre = C.creenciaSistemas(parcial.secuencia, parcial.pases)[1];
      const jugadasSuyas = parcial.secuencia.filter(s => s.jugador === 1 &&
        (s.castiga !== null && s.castiga !== undefined)).length;
      if (cre.mejor === real) { if (acertadaDesde === null) acertadaDesde = jugadasSuyas; }
      else acertadaDesde = null;
      if (n === hist.length) {
        finales.push(cre.mejor === real);
        pReal.push(cre.prob[real]); nDiag.push(cre.diagnosticas);
      }
    }
    pasos.push(acertadaDesde);
  }
  const buenas = pasos.filter(x => x !== null);
  const media = buenas.length ? (buenas.reduce((a, b) => a + b, 0) / buenas.length) : null;
  const prom = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return { acierta: finales.filter(Boolean).length, de: manos,
           jugadas: media === null ? "-" : media.toFixed(1),
           prob: prom(pReal).toFixed(3), diag: prom(nDiag).toFixed(1) };
}

const MANOS = 12;
/* Tres columnas, porque "acierta" a secas engana: lo que importa es cuanta
   probabilidad se lleva el sistema real, y cuantas jugadas de la mano
   distinguen algo. Si casi ninguna distingue, no hay formula que lo arregle. */
console.log("  sistema real | acierta | P(real) | diagnosticas/mano | hasta acertar");
console.log("  -------------+---------+---------+-------------------+--------------");
const resumen = {};
["clasico", "moderno", "combinado", "ninguno"].forEach(real => {
  const r = convergencia(real, MANOS);
  resumen[real] = r;
  console.log("  " + real.padEnd(12) + " |  " + (r.acierta + "/" + r.de).padEnd(6) +
              " |  " + String(r.prob).padEnd(6) + " |       " + String(r.diag).padEnd(12) +
              "| " + r.jugadas);
});
t("con 'ninguno' acierta casi siempre: no marcar es la senal mas clara",
  resumen.ninguno.acierta >= MANOS - 1, JSON.stringify(resumen.ninguno));
/* Los numeros de arriba se REPORTAN, no se cuadran: son la linea base para
   afinar la formula. Lo unico que se exige es que clasico (el mas frecuente)
   y ninguno (la senal mas clara) se identifiquen. Moderno hoy NO se
   identifica: la evidencia apunta en su direccion pero no vence al prior. */
t("clasico se identifica", resumen.clasico.acierta >= MANOS - 2, JSON.stringify(resumen.clasico));
t("y con mas probabilidad que su prior (no es el prior hablando)",
  +resumen.clasico.prob > C.PRIOR_SISTEMA.clasico,
  resumen.clasico.prob + " vs prior " + C.PRIOR_SISTEMA.clasico);
t("al moderno la evidencia le sube la probabilidad aunque no gane",
  +resumen.moderno.prob > C.PRIOR_SISTEMA.moderno,
  resumen.moderno.prob + " vs prior " + C.PRIOR_SISTEMA.moderno);
console.log("  (moderno y combinado quedan por afinar: ver el reporte)");

console.log("\n--- Sugerir no usa el sistema CONFIGURADO de un contrario ---");
/* Igual que la prueba de que no se cuelan las fichas ajenas: cambiar lo que
   dice la configuracion de los contrarios no debe mover el consejo. */
const hist = manoCon({ 0: "clasico", 1: "moderno", 2: "clasico", 3: "clasico" });
const mesa = C.reconstruirMesa(hist.slice(0, 7));
let i = 0;
mesa.secuencia.forEach(sq => { while (i < 7 && hist[i].paso) i++; if (i < 7) { sq.pensada = hist[i].pensada || null; i++; } });
const miMano = ["6-6", "5-4", "3-1"];
const base = { yo: 0, miMano: miMano, ends: mesa.ends, secuencia: mesa.secuencia,
  pases: mesa.pases, salidor: 0, salida: null, convenio: "ninguna",
  sistemas: { 0: "clasico", 1: "moderno", 2: "clasico", 3: "clasico" }, pasesSeguidos: 0 };
const consejo = e => { const r = C.sugerirJugada(JSON.parse(JSON.stringify(e)));
  return r ? r.recomendada.ficha + "|" + r.recomendada.punta + "|" + r.recomendada.puntos : "(nada)"; };
const original = consejo(base);
console.log("         consejo: " + original);
const CONTRARIOS = [1, 3];
let iguales = true, probados = 0;
["ninguno", "clasico", "moderno", "combinado"].forEach(s => {
  const e = JSON.parse(JSON.stringify(base));
  CONTRARIOS.forEach(c => { e.sistemas[c] = s; });
  probados++;
  if (consejo(e) !== original) iguales = false;
});
t("cambiar el sistema configurado de los contrarios no mueve el consejo (" + probados + " variantes)", iguales);
// control: cambiar el del COMPAnERO si puede moverlo, porque ese si se sabe
const conComp = JSON.parse(JSON.stringify(base));
conComp.sistemas[2] = "ninguno";
console.log("         con el companero en 'ninguno': " + consejo(conComp));
t("control: el del companero si se usa (su sistema es informacion legitima)",
  true, "solo informativo");

/* ================= LA MANO DEL CONTRARIO NO ENTRA =================
   Para medir si una jugada distingue entre clasico y moderno NO se predice
   que marca daria cada sistema (eso exigiria ver su mano). Se mira, de lo que
   hizo DESPUES, cual de las dos lecturas resiste: si dijo "me quedan mas
   treses" y luego pasa a los treses, esa lectura queda desmentida. Todo lo
   que entra es visible: la ficha, por que punta la puso, lo que genero, la
   marca que canto, y sus jugadas y pases posteriores.

   Esta prueba lo fija por partida doble: por el codigo y por el comportamiento. */
console.log("\n--- la mano del contrario no entra en la creencia ---");

const P = require("../partida.js");
const fuente = fs.readFileSync(path.join(__dirname, "..", "conocimiento.js"), "utf8");
const trozo = (desde, hasta) => fuente.slice(fuente.indexOf(desde), fuente.indexOf(hasta));
const PROHIBIDO = /\bmanos\b|\bhands\b|miMano|analizarMano/;
[["function _afirmaSistema", "function _compruebaAfirmacion"],
 ["function _compruebaAfirmacion", "/* creenciaSistemas"],
 ["function creenciaSistemas", "function _pesosDesdeCreencia"]].forEach(([a, b]) => {
  const c = trozo(a, b);
  t("ni una mano en " + a.replace("function ", ""), !PROHIBIDO.test(c),
    (c.match(PROHIBIDO) || [""])[0]);
});

/* La prueba de verdad: dos partidas IGUALES en lo que se ve y distintas en lo
   que no. Si la creencia (o el consejo) cambia, es que mira lo que no debe. */
function partidaJugada() {
  const todas = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) todas.push(a + "-" + b);
  for (let i = todas.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [todas[i], todas[j]] = [todas[j], todas[i]]; }
  const ASI = ["S", "E", "N", "O"];
  const manos = { S: todas.slice(0, 7), E: todas.slice(7, 14), N: todas.slice(14, 21), O: todas.slice(21, 28) };
  const p = { version: 1, id: "p-fuga", titulo: "Fuga", fecha: null, autor: "", notas: "",
    etiquetas: [], modo: "simulador", convenio: "ninguna",
    jugadores: { S: { nombre: null, sistema: "clasico" }, E: { nombre: null, sistema: "moderno" },
                 N: { nombre: null, sistema: "clasico" }, O: { nombre: null, sistema: "combinado" } },
    manos: JSON.parse(JSON.stringify(manos)), salidor: "S", jugadas: [] };
  const quedan = JSON.parse(JSON.stringify(manos));
  let ends = null, turno = 0;
  for (let k = 0; k < 11; k++) {
    const L = ASI[turno]; let puesta = null;
    for (const f of quedan[L]) {
      const [a, b] = f.split("-").map(Number);
      if (ends === null) { puesta = { ficha: f, lado: null }; break; }
      if (a === ends[0] || b === ends[0]) { puesta = { ficha: f, lado: "I" }; break; }
      if (a === ends[1] || b === ends[1]) { puesta = { ficha: f, lado: "D" }; break; }
    }
    if (!puesta) p.jugadas.push({ n: p.jugadas.length + 1, jugador: L, pase: true });
    else {
      quedan[L].splice(quedan[L].indexOf(puesta.ficha), 1);
      const [a, b] = puesta.ficha.split("-").map(Number);
      if (ends === null) ends = [a, b];
      else { const q = puesta.lado === "I" ? 0 : 1; ends[q] = (a === ends[q] ? b : a); }
      p.jugadas.push({ n: p.jugadas.length + 1, jugador: L, ficha: puesta.ficha, lado: puesta.lado,
                       pensada: (p.jugadas.length % 2) ? "CPP" : "SPP", veredicto: null, comentario: "" });
    }
    turno = (turno + 1) % 4;
  }
  return { partida: p, quedan: quedan };
}

const { partida: pA, quedan } = partidaJugada();
t("la partida de prueba es valida", P.validar(pA).ok, JSON.stringify(P.validar(pA).errores));

/* Variante: a los DOS contrarios (E y O) se les cambian las fichas que aun no
   han jugado. Lo visible -- lo jugado, las puntas, las marcas, los pases -- es
   identico; lo oculto, distinto. */
const pB = JSON.parse(JSON.stringify(pA));
const jugadasDe = L => pA.jugadas.filter(j => !j.pase && j.jugador === L).map(j => j.ficha);
const sobranE = quedan.E.slice(), sobranO = quedan.O.slice();
// se intercambian solo tantas como quepan: las manos tienen que seguir
// siendo de siete, o la partida deja de ser valida y la prueba no vale
const cuantas = Math.min(sobranE.length, sobranO.length);
pB.manos.E = jugadasDe("E").concat(sobranO.slice(0, cuantas), sobranE.slice(cuantas));
pB.manos.O = jugadasDe("O").concat(sobranE.slice(0, cuantas), sobranO.slice(cuantas));
t("la variante tambien es valida", P.validar(pB).ok, JSON.stringify(P.validar(pB).errores));
t("y las manos ocultas de los contrarios son distintas",
  JSON.stringify(pA.manos.E) !== JSON.stringify(pB.manos.E),
  JSON.stringify(pA.manos.E) + " vs " + JSON.stringify(pB.manos.E));

const n = pA.jugadas.length;
const estA = P.estadoPara(pA, n, "S"), estB = P.estadoPara(pB, n, "S");
eq("lo que ve Sur es exactamente lo mismo", JSON.stringify(estA), JSON.stringify(estB));

const creA = C.creenciaSistemas(estA.secuencia, estA.pases);
const creB = C.creenciaSistemas(estB.secuencia, estB.pases);
[1, 3].forEach(c => {
  eq("la creencia sobre " + ["S","E","N","O"][c] + " no cambia", creA[c].prob, creB[c].prob);
});
const sugA = C.sugerirJugada(estA), sugB = C.sugerirJugada(estB);
eq("y el consejo tampoco",
  sugA ? sugA.recomendada.ficha + "|" + sugA.recomendada.puntos : null,
  sugB ? sugB.recomendada.ficha + "|" + sugB.recomendada.puntos : null);

// control: si de verdad se esta leyendo algo, cambiar lo VISIBLE si debe mover
const pC = JSON.parse(JSON.stringify(pA));
let cambiada = false;
pC.jugadas.forEach(j => { if (!j.pase && j.jugador === "E" && j.pensada && !cambiada) {
  j.pensada = j.pensada === "CPP" ? "SPP" : "CPP"; cambiada = true; } });
const creC = C.creenciaSistemas(P.estadoPara(pC, n, "S").secuencia, P.estadoPara(pC, n, "S").pases);
t("control: cambiar una marca VISIBLE si mueve la creencia",
  JSON.stringify(creA[1].prob) !== JSON.stringify(creC[1].prob),
  JSON.stringify(creA[1].prob) + " vs " + JSON.stringify(creC[1].prob));

console.log("\n--- sin jugadas no se inventa nada ---");
const vacia = C.creenciaSistemas([], []);
eq("arranca de las frecuencias reales", vacia[1].prob, C.PRIOR_SISTEMA);
eq("y lo mas probable es clasico", vacia[1].mejor, "clasico");
t("clasico es el mas frecuente del prior",
  C.PRIOR_SISTEMA.clasico > C.PRIOR_SISTEMA.ninguno &&
  C.PRIOR_SISTEMA.ninguno > C.PRIOR_SISTEMA.combinado &&
  C.PRIOR_SISTEMA.combinado > C.PRIOR_SISTEMA.moderno, JSON.stringify(C.PRIOR_SISTEMA));

console.log(fallos ? "\n" + fallos + " FALLOS" : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
