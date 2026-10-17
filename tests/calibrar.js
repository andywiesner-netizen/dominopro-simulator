/* ================= BANCO DE CALIBRACION (5d) =================
   OJO: esto NO es una prueba de regresion. No dice "bien" ni "mal": mide y
   reporta. Por eso se llama calibrar.js y no calibrar.test.js, para que no
   entre en la tanda de tests/*.test.js.

   Que mide
   --------
   Los tres pesos de la convencion de salida por CALIDAD
   (repetirSalidaCalidad, iniciativaPropia, dificultarBuenJuego) no se activan
   en ninguno de los nueve ejercicios del taller, porque alli nadie usa esa
   convencion. Asi que no hay con que juzgarlos. Este banco los somete a la
   unica referencia automatica disponible: cuanto coincide la sugerencia con lo
   que juega aiBestMovesDeep, que ve las cuatro manos.

   Lo que esa referencia NO es
   ---------------------------
   aiBestMovesDeep no sabe de principios del taller: busca ganar la ronda con
   informacion completa. Coincidir mas con ella significa "juega mas como un
   motor que lo ve todo", no "es mas correcto didacticamente". Los numeros de
   aqui sirven para detectar un peso absurdo (uno que empeore mucho, o uno que
   no toque nada), no para fijar la doctrina.

   Como funciona
   -------------
   1. Reparte manos con un azar propio y semilla fija, para que dos corridas
      den lo mismo.
   2. Juega cada mano SIEMPRE con aiBestMovesDeep. El sugeridor solo mira: asi
      la partida es identica se pongan los pesos que se pongan, y lo unico que
      cambia entre corridas es su opinion.
   3. Guarda cada decision del asiento observado (estado + lo que jugo la IA).
   4. Con ese banco ya fijo, barre cada peso y reporta la coincidencia.

   Uso:  node tests/calibrar.js [manos] [semilla]
*/
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");

// engine.js es un script de navegador sin exports y no se toca: se evalua tal
// cual y sus funciones quedan en el scope global de este proceso.
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8"));

const C = require("../conocimiento.js");
const P = C.PESOS_SUGERENCIA;

const MANOS = +(process.argv[2] || 60);
const SEMILLA = +(process.argv[3] || 20261017);
const OBSERVADO = 0;                      // el asiento cuyas decisiones medimos

/* Azar propio con semilla: engine.shuffle usa Math.random y no queremos que
   dos corridas repartan distinto. */
let _s = SEMILLA >>> 0;
function rnd() { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; }
function repartir() {
  const t = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) t.push(a + "-" + b);
  for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  return [0, 1, 2, 3].map(p => new Set(t.slice(p * 7, p * 7 + 7)));
}

/* Los cuatro marcan su salida por calidad: es la unica forma de que los pesos
   que queremos medir lleguen a dispararse. Sistemas mezclados para que la
   lectura de la mano tambien tenga material. */
const CONFIG = {
  0: { sistema: "clasico", salida: "calidad" },
  1: { sistema: "moderno", salida: "calidad" },
  2: { sistema: "clasico", salida: "calidad" },
  3: { sistema: "moderno", salida: "calidad" },
};

/* Monta la entrada de sugerirJugada con lo que ese asiento sabe, igual que
   hace la mesa: la marca y el sistema viajan con la jugada. */
function estadoDe(hist, manos, yo, ends, passes, salidor) {
  let mesa;
  try { mesa = C.reconstruirMesa(hist); } catch (e) { return null; }
  let i = 0;
  mesa.secuencia.forEach(sq => {
    while (i < hist.length && hist[i].paso) i++;
    if (i < hist.length) { sq.pensada = hist[i].pensada || null; sq.sistema = hist[i].sistema || null; i++; }
  });
  const primera = hist.find(h => !h.paso) || null;
  return {
    // ends se copia: placeOnBoard lo muta en el sitio y si no, cada decision
    // guardada acabaria apuntando a las puntas del final de la mano
    yo: yo, miMano: [...manos[yo]], ends: ends ? ends.slice() : null,
    secuencia: mesa.secuencia, pases: mesa.pases, salidor: salidor,
    salida: primera ? { ficha: primera.ficha, jugador: primera.jugador, pensada: primera.pensada || null } : null,
    sistemas: CONFIG, pasesSeguidos: passes,
  };
}

/* Juega una mano entera con la IA y devuelve las decisiones del observado. */
function recoger(manos, salidor) {
  const h = manos.map(s => new Set(s));
  const st = { ends: null, sequence: [] };
  const hist = [];
  let cur = salidor, passes = 0, guardia = 0;
  const decisiones = [];

  while (guardia++ < 60) {
    const moves = aiBestMovesDeep(h, st.ends, cur, passes);
    if (!moves.length) {
      hist.push({ jugador: cur, paso: true, pensada: null, sistema: null });
      if (++passes >= 4) break;
      cur = (cur + 1) % 4; continue;
    }
    if (cur === OBSERVADO && st.ends !== null) {          // la salida la decide el asesor, no los pesos
      const est = estadoDe(hist, h, cur, st.ends, passes, salidor);
      if (est) decisiones.push({ estado: est, ia: { ficha: moves[0].k, punta: moves[0].side } });
    }
    const m = moves[0];
    const cast = st.ends === null ? null : (m.side === "I" ? st.ends[0] : st.ends[1]);
    const t = kt(m.k), gen = cast === null ? null : (t[0] === cast ? t[1] : t[0]);
    const pen = C.pensadaPara({
      ficha: m.k, numeroCastigado: cast, numeroGenerado: gen, mano: [...h[cur]],
      sistema: CONFIG[cur], jugadas: st.sequence.map(x => key(x[0], x[1])),
    });
    hist.push({ jugador: cur, ficha: m.k, punta: st.ends === null ? null : m.side, pensada: pen, sistema: null });
    placeOnBoard(st, m.k, m.side);
    h[cur].delete(m.k);
    passes = 0;
    if (!h[cur].size) break;
    cur = (cur + 1) % 4;
  }
  return decisiones;
}

/* ---------- banco ---------- */
console.log("Banco de calibracion · " + MANOS + " manos · semilla " + SEMILLA);
console.log("Referencia: aiBestMovesDeep (ve las cuatro manos). NO es la verdad del taller.\n");

const t0 = Date.now();
const banco = [];
for (let i = 0; i < MANOS; i++) {
  const manos = repartir();
  banco.push.apply(banco, recoger(manos, i % 4));      // el salidor va rotando
}
console.log("Decisiones recogidas: " + banco.length + "  (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)\n");

/* coincidencia = el sugeridor recomienda la misma ficha y punta que la IA */
function medir() {
  let ok = 0, n = 0;
  const elegidas = [];
  banco.forEach(d => {
    const s = C.sugerirJugada(d.estado);
    if (!s || !s.recomendada) { elegidas.push(null); return; }
    n++;
    const igual = s.recomendada.ficha === d.ia.ficha && s.recomendada.punta === d.ia.punta;
    if (igual) ok++;
    elegidas.push(s.recomendada.ficha + "|" + s.recomendada.punta);
  });
  return { pct: n ? (100 * ok / n) : 0, ok: ok, n: n, elegidas: elegidas };
}

function distintas(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/* Cuantas decisiones cumplen siquiera la condicion de cada criterio. Sin esto
   no se distingue "el peso no decide nada" de "el peso no llega a aplicarse",
   que son dos problemas muy distintos. */
function contextoDe(est) {
  const comp = (est.yo + 2) % 4, contr = [(est.yo + 1) % 4, (est.yo + 3) % 4];
  const sal = est.salida;
  if (!sal || !sal.pensada) return "la salida no lleva marca";
  const cfg = C.configJugador((est.sistemas || {})[sal.jugador]);
  if (cfg.salida !== "calidad") return "salida marcada, pero no por calidad";
  const juego = sal.pensada === "SPP" ? "buen juego" : "juego malo";
  if (sal.jugador === comp) return "salio el compañero declarando " + juego;
  if (contr.includes(sal.jugador)) return "salio un contrario declarando " + juego;
  return "salio el propio observado";
}
const contextos = {};
banco.forEach(d => { const c = contextoDe(d.estado); contextos[c] = (contextos[c] || 0) + 1; });
console.log("Contexto de la salida en las " + banco.length + " decisiones:");
Object.keys(contextos).sort((a, b) => contextos[b] - contextos[a]).forEach(c =>
  console.log("  " + String(contextos[c]).padStart(5) + "  " +
              (100 * contextos[c] / banco.length).toFixed(1).padStart(5) + " %  " + c));
console.log("");

const NUEVOS = ["repetirSalidaCalidad", "iniciativaPropia", "dificultarBuenJuego"];
const actual = {}; NUEVOS.forEach(k => actual[k] = P[k]);

const base = medir();
console.log("Con los pesos actuales (" + NUEVOS.map(k => k + "=" + actual[k]).join(", ") + "):");
console.log("  coincide con la IA en " + base.ok + "/" + base.n + " = " + base.pct.toFixed(1) + " %\n");

// los tres a cero: ¿cuanto pesan en conjunto?
NUEVOS.forEach(k => P[k] = 0);
const cero = medir();
NUEVOS.forEach(k => P[k] = actual[k]);
console.log("Con los tres a cero:");
console.log("  " + cero.pct.toFixed(1) + " %   ·   cambian " + distintas(base.elegidas, cero.elegidas) +
            " decisiones de " + base.n + "\n");

/* El 999 no es un valor candidato: es una sonda. Si ni con un peso absurdo
   cambia una sola decision, ese criterio no llega a ser aplicable en este
   banco, que es muy distinto de "es aplicable pero nunca decide". */
const VALORES = [0, 2, 3, 5, 8, 10, 15, 20, 30, 999];
NUEVOS.forEach(k => {
  console.log("--- " + k + " (hoy " + actual[k] + ") ---");
  console.log("  valor | coincide |  cambia respecto a 0");
  let refCero = null;
  VALORES.forEach(v => {
    P[k] = v;
    const r = medir();
    if (v === 0) refCero = r.elegidas;
    const dif = refCero ? distintas(refCero, r.elegidas) : 0;
    console.log("  " + String(v).padStart(5) + " | " + (r.pct.toFixed(1) + " %").padStart(8) +
                " | " + String(dif).padStart(5) + (v === actual[k] ? "   <- actual" : ""));
  });
  P[k] = actual[k];
  console.log("");
});

console.log("Lectura: si la columna de la derecha es 0 en toda la fila, ese peso no");
console.log("toca ninguna decision de este banco y el numero que lleve da igual.");
