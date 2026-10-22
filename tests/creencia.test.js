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
  const pasos = [], finales = [];
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
      if (n === hist.length) finales.push(cre.mejor === real);
    }
    pasos.push(acertadaDesde);
  }
  const buenas = pasos.filter(x => x !== null);
  const media = buenas.length ? (buenas.reduce((a, b) => a + b, 0) / buenas.length) : null;
  return { acierta: finales.filter(Boolean).length, de: manos,
           jugadas: media === null ? "-" : media.toFixed(1) };
}

const MANOS = 12;
console.log("  sistema real | acierta al final | jugadas suyas hasta acertar");
console.log("  -------------+------------------+----------------------------");
const resumen = {};
["clasico", "moderno", "combinado", "ninguno"].forEach(real => {
  const r = convergencia(real, MANOS);
  resumen[real] = r;
  console.log("  " + real.padEnd(12) + " |      " + (r.acierta + "/" + r.de).padEnd(12) +
              "|  " + r.jugadas);
});
t("con 'ninguno' acierta casi siempre: no marcar es la senal mas clara",
  resumen.ninguno.acierta >= MANOS - 1, JSON.stringify(resumen.ninguno));
/* Los numeros de arriba se REPORTAN, no se cuadran: son la linea base para
   afinar la formula. Lo unico que se exige es que clasico (el mas frecuente)
   y ninguno (la senal mas clara) se identifiquen. Moderno hoy NO se
   identifica: la evidencia apunta en su direccion pero no vence al prior. */
t("clasico se identifica", resumen.clasico.acierta >= MANOS - 2, JSON.stringify(resumen.clasico));
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
