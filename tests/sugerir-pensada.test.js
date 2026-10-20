/* ================= LA PENSADA FORMA PARTE DEL CONSEJO =================
   La ficha y la pensada son una sola decision. Aqui se comprueba que lo que
   sugiere Sugerir coincide exactamente con lo que calcularia pensadaPara para
   esa misma jugada, en los cuatro sistemas, y que con 'ninguno' no hay nada. */
const C = require("../conocimiento.js");

let fallos = 0;
const t = (nombre, cond, extra) => {
  if (!cond) { fallos++; console.log("  FALLA  " + nombre + (extra ? "\n           " + extra : "")); }
  else console.log("  ok     " + nombre);
};
const eq = (nombre, a, b) => t(nombre, JSON.stringify(a) === JSON.stringify(b),
  "obtenido " + JSON.stringify(a) + "\n           esperado " + JSON.stringify(b));

/* Mesa: N salio 3-3, O puso 3-6. Puntas [6,3]. Juego yo (Sur). */
const SECUENCIA = [
  { jugador: 2, ficha: "3-3", castiga: null, genera: [3], ends: [3, 3], pensada: null },
  { jugador: 3, ficha: "3-6", castiga: 3, genera: [6], punta: "I", ends: [6, 3], pensada: null },
];
const MI_MANO = ["6-5", "6-0", "5-2", "3-1", "2-2"];

function estadoCon(sisSur, extra) {
  const sis = { 0: sisSur, 1: "ninguno", 2: "clasico", 3: "ninguno" };
  return Object.assign({
    yo: 0, miMano: MI_MANO.slice(), ends: [6, 3], secuencia: JSON.parse(JSON.stringify(SECUENCIA)),
    pases: [], salidor: 2, salida: { ficha: "3-3", jugador: 2, pensada: null },
    sistemas: sis, pasesSeguidos: 0,
  }, extra || {});
}

console.log("\n--- la ficha recomendada NO cambia por esto ---");
const fichas = ["ninguno", "clasico", "moderno", { sistema: "combinado" }].map(x => {
  const r = C.sugerirJugada(estadoCon(x));
  return r.recomendada.ficha + "|" + r.recomendada.punta;
});
console.log("         " + fichas.join("   "));
t("misma ficha y punta con los cuatro sistemas", new Set(fichas).size === 1, fichas.join(" / "));

console.log("\n--- sistema 'ninguno': no hay pensada ---");
const sinSis = C.sugerirJugada(estadoCon("ninguno"));
eq("pensada = null", sinSis.pensada, null);

console.log("\n--- coincide con pensadaPara en los cuatro sistemas ---");
[["clasico", "clasico"], ["moderno", "moderno"],
 [{ sistema: "combinado", combinado: { inicial: "moderno" } }, "combinado"]].forEach(([sis, nombre]) => {
  const r = C.sugerirJugada(estadoCon(sis));
  const m = r.recomendada;
  const esperada = C.pensadaPara({
    ficha: m.ficha, numeroCastigado: m.castiga, numeroGenerado: m.genera,
    mano: MI_MANO, sistema: sis, sistemaJugada: r.pensada.sistema,
    jugadas: SECUENCIA.map(x => x.ficha),
  });
  eq(nombre + ": la marca coincide con pensadaPara", r.pensada.marca, esperada);
  t(nombre + ": trae un porque legible", !!r.pensada.texto && r.pensada.texto.length > 5, r.pensada.texto);
  console.log("         " + nombre.padEnd(10) + " -> " + m.ficha + " " + m.punta + " " +
              r.pensada.marca + (r.pensada.sistema ? " en " + r.pensada.sistema : "") + ": " + r.pensada.texto);
});

console.log("\n--- combinado: dice en que sistema jugarla y por que ---");
const comb = C.sugerirJugada(estadoCon({ sistema: "combinado", combinado: { inicial: "moderno" } }));
t("marca que es combinado", comb.pensada.combinado === true);
t("elige un sistema concreto", ["clasico", "moderno"].indexOf(comb.pensada.sistema) >= 0, comb.pensada.sistema);
t("y explica por que ese", !!comb.pensada.motivoSistema, comb.pensada.motivoSistema);
console.log("         " + comb.pensada.sistema + " porque " + comb.pensada.motivoSistema);

// con la mano muy avanzada la doctrina debe inclinarse al clasico
const tardio = estadoCon({ sistema: "combinado" });
for (let i = 0; i < 6; i++)
  tardio.secuencia.push({ jugador: 0, ficha: "0-0", castiga: 6, genera: [6], punta: "I", ends: [6, 3], pensada: null });
const rTardio = C.sugerirJugada(tardio);
console.log("         con la mano avanzada -> " + rTardio.pensada.sistema + " (" + rTardio.pensada.motivoSistema + ")");
t("al final de la mano se inclina al clasico", rTardio.pensada.sistema === "clasico", rTardio.pensada.sistema);

console.log("\n--- aviso cuando el companero no lee ---");
// companero (Norte) en 'clasico' -> si lee; en 'ninguno' -> no
t("sin aviso si el companero lleva sistema", C.sugerirJugada(estadoCon("clasico")).pensada.aviso === null);
const mudo = estadoCon("clasico");
mudo.sistemas[2] = "ninguno";
t("con aviso si no lo lleva", /no se la va a leer/.test(C.sugerirJugada(mudo).pensada.aviso || ""),
  String(C.sugerirJugada(mudo).pensada.aviso));

console.log("\n--- tambien en la salida, y segun su convencion ---");
const salida = sal => {
  const e = estadoCon({ sistema: "clasico", salida: sal });
  e.ends = null; e.secuencia = []; e.salida = null;
  return C.sugerirJugada(e);
};
eq("salida 'ninguna': sin pensada", salida("ninguna").pensada, null);
["fuerza", "calidad"].forEach(sal => {
  const r = salida(sal);
  const esperada = C.pensadaPara({
    ficha: r.recomendada.ficha, numeroCastigado: null, numeroGenerado: null,
    mano: MI_MANO, sistema: { sistema: "clasico", salida: sal }, jugadas: [],
  });
  eq("salida por " + sal + ": coincide con pensadaPara", r.pensada.marca, esperada);
  console.log("         salida por " + sal.padEnd(8) + " -> " + r.recomendada.ficha + " " +
              r.pensada.marca + ": " + r.pensada.texto);
});

console.log(fallos ? "\n" + fallos + " FALLOS" : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
