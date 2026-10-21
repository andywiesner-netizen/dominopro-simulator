const { pensadaPara, analizarMano } = require("../conocimiento.js");

let fallos = 0;
const t = (nombre, obtenido, esperado) => {
  const ok = obtenido === esperado;
  if (!ok) fallos++;
  console.log((ok ? "  ok  " : "  FALLA") + "  " + nombre.padEnd(56) +
    " esperado " + String(esperado).padEnd(5) + " obtenido " + obtenido);
};

// ---- moderno: informa el numero GENERADO (ejemplos del taller) ----
// Contexto: el contrario salio 3-3; yo juego 3-4 castigando el 3 y generando el 4.
const mod = (mano) => pensadaPara({
  ficha: "3-4", lado: "D", numeroCastigado: 3, numeroGenerado: 4,
  mano: mano, sistema: "moderno", jugadas: ["3-3"],
});
console.log("\n--- mixta, sistema moderno (informa el generado) ---");
t("3-4 4-2, sin mas cuatros", mod(["3-4", "4-2"]), "CPP");
t("3-4 3-5 4-4 1-4 (3 cuatros con el doble)", mod(["3-4", "3-5", "4-4", "1-4"]), "SPP");
t("3-4 3-5 1-4 4-6 0-4 (4 cuatros)", mod(["3-4", "3-5", "1-4", "4-6", "0-4"]), "SPP");
t("3-4 4-1 4-0 (3 cuatros sin el doble)", mod(["3-4", "4-1", "4-0"]), "CPP");

// ---- clasico: informa el numero CASTIGADO ----
console.log("\n--- mixta, sistema clasico (informa el castigado) ---");
t("Ej.9  C juega 3-0, unico tres", pensadaPara({
  ficha: "3-0", numeroCastigado: 3, numeroGenerado: 0,
  mano: ["3-0", "5-1", "6-2"], sistema: "clasico", jugadas: ["3-3"] }), "SPP");
t("Ej.20 A juega 5-4, tres quintos contando la jugada", pensadaPara({
  ficha: "5-4", numeroCastigado: 5, numeroGenerado: 4,
  mano: ["5-4", "5-3", "5-0", "1-1", "2-1"], sistema: "clasico", jugadas: ["5-5", "5-2", "2-4", "4-1"] }), "CPP");

// ---- dobles en partida: igual en los dos sistemas ----
console.log("\n--- doble en partida ---");
["clasico", "moderno"].forEach(sis => {
  t("4-4 con 4-1 en mano (" + sis + ")", pensadaPara({
    ficha: "4-4", numeroCastigado: 4, numeroGenerado: 4,
    mano: ["4-4", "4-1", "6-2"], sistema: sis, jugadas: ["3-4"] }), "CPP");
  t("4-4 como unico cuatro (" + sis + ")", pensadaPara({
    ficha: "4-4", numeroCastigado: 4, numeroGenerado: 4,
    mano: ["4-4", "6-2", "5-1"], sistema: sis, jugadas: ["3-4"] }), "SPP");
});

// ---- salidas: las decide asesorSalida ----
console.log("\n--- salida (mesa vacia) ---");
t("Ej.1 A sale 1-1 (cuatro unos con el doble)", pensadaPara({
  ficha: "1-1", numeroCastigado: null, numeroGenerado: null, salida: "fuerza",
  mano: ["1-1", "1-2", "1-3", "1-4", "0-5", "0-6", "2-4"], sistema: "clasico", jugadas: [] }), "SPP");
t("Ej.4 A sale 3-3 (doble en segunda)", pensadaPara({
  ficha: "3-3", numeroCastigado: null, numeroGenerado: null, salida: "fuerza",
  mano: ["3-3", "3-4", "4-1", "0-4", "0-5", "1-6", "2-2"], sistema: "moderno", jugadas: [] }), "CPP");

// ---- sistema ninguno y bordes ----
console.log("\n--- sistema 'ninguno' y bordes ---");
t("sistema ninguno -> null", pensadaPara({
  ficha: "5-4", numeroCastigado: 5, numeroGenerado: 4,
  mano: ["5-4", "5-3"], sistema: "ninguno", jugadas: [] }), null);
t("sistema 'ninguno' explicito -> null", pensadaPara({ ficha: "5-4", numeroCastigado: 5, numeroGenerado: 4,
  mano: ["5-4"], sistema: "ninguno" }), null);
// el valor por defecto paso a ser 'combinado', asi que no declararlo SI marca
t("sin declarar sistema, el defecto es combinado y marca", pensadaPara({
  ficha: "5-4", numeroCastigado: 5, numeroGenerado: 4, mano: ["5-4"] }) !== null, true);
t("ficha invalida -> null", pensadaPara({ ficha: "9-9", numeroCastigado: 1, numeroGenerado: 2, mano: [], sistema: "clasico" }), null);

// pureza: no muta la mano
const m = ["5-4", "5-3"], antes = m.slice();
pensadaPara({ ficha: "5-4", numeroCastigado: 5, numeroGenerado: 4, mano: m, sistema: "clasico", jugadas: [] });
t("no muta la mano recibida", JSON.stringify(m), JSON.stringify(antes));

/* ===== convencion de salida: fuerza (la de siempre) o calidad =====
   Por calidad la pensada de salida no habla del palo sino de la MANO: Buena o
   Poderosa informan juego (SPP); el resto, CPP. Poderosa manda sobre Mala. */
console.log("\n--- salida por CALIDAD (informa la mano, no el palo) ---");
const salCal = mano => pensadaPara({
  ficha: mano[0], numeroCastigado: null, numeroGenerado: null,
  mano: mano, sistema: { sistema: "clasico", salida: "calidad" }, jugadas: [],
});
const etiq = mano => analizarMano(mano).etiquetas.join("+") || "(sin etiqueta)";

const MANOS_SALIDA = [
  ["Buena",         ["6-5", "4-3", "2-1", "5-3", "6-2", "4-1", "0-3"], "SPP"],
  ["Poderosa+Mala", ["4-4", "4-3", "4-1", "4-6", "3-3", "6-1", "1-3"], "SPP"],
  ["Regular",       ["5-5", "5-3", "6-2", "4-1", "2-4", "6-1", "3-4"], "CPP"],
  ["Mala",          ["5-5", "3-3", "5-3", "6-2", "6-0", "2-0", "5-0"], "CPP"],
];
MANOS_SALIDA.forEach(([nombre, mano, esp]) => {
  console.log("         " + nombre.padEnd(14) + " etiquetas: " + etiq(mano));
  t("salida por calidad, mano " + nombre, salCal(mano), esp);
});

console.log("\n--- la convencion de salida no toca el resto de la mano ---");
t("mixta en partida: sigue mandando el sistema", pensadaPara({
  ficha: "3-4", numeroCastigado: 3, numeroGenerado: 4,
  mano: ["3-4", "4-2"], sistema: { sistema: "moderno", salida: "calidad" }, jugadas: ["3-3"] }), "CPP");
const MANO_SALIDA_FUERZA = ["5-5", "5-4", "5-1", "5-2", "2-6", "0-1", "2-3"];
const { asesorSalida } = require("../conocimiento.js");
t("salida por fuerza es, literalmente, lo que dice el asesor de salida", pensadaPara({
    ficha: "5-5", numeroCastigado: null, numeroGenerado: null, mano: MANO_SALIDA_FUERZA,
    sistema: { sistema: "clasico", salida: "fuerza" }, jugadas: [] }),
  asesorSalida(MANO_SALIDA_FUERZA).pensada);

/* ===== combinado: la misma ficha, dos pensadas =====
   Se jugo 3-3; juego 3-4 castigando el 3 y generando el 4, con 3-0 y 4-4 4-1
   en la mano. Clasico mira el castigado: me queda otro tres -> CPP. Moderno
   mira el generado: tres cuatros con el doble es fuerza -> SPP. */
console.log("\n--- combinado: el sistema vigente cambia la pensada ---");
const MANO_COMB = ["3-4", "3-0", "4-4", "4-1"];
const comb = (sis, cfg) => pensadaPara({
  ficha: "3-4", numeroCastigado: 3, numeroGenerado: 4, mano: MANO_COMB,
  sistema: cfg || { sistema: "combinado" }, sistemaJugada: sis, jugadas: ["3-3"] });
t("combinado jugando en clasico", comb("clasico"), "CPP");
t("combinado jugando en moderno", comb("moderno"), "SPP");
t("la misma ficha da pensadas DISTINTAS segun el sistema",
  comb("clasico") !== comb("moderno"), true);

console.log("\n--- sin sistema registrado manda el inicial de la config ---");
t("cae en su inicial clasico", comb(null, { sistema: "combinado", combinado: { inicial: "clasico" } }), "CPP");
t("cae en su inicial moderno", comb(null, { sistema: "combinado", combinado: { inicial: "moderno" } }), "SPP");
t("sin inicial declarado, el por defecto es moderno", comb(null, { sistema: "combinado" }), "SPP");
t("ninguno sigue sin dejar marca", comb("clasico", { sistema: "ninguno", salida: "calidad" }), null);

/* ===== la salida es un eje aparte del sistema =====
   Se marca segun la convencion elegida, sin importar con que sistema se juegue
   el resto de la mano (ni si se juega con alguno). */
console.log("\n--- salida independiente del sistema ---");
const MANO_SAL = ["5-5", "5-4", "5-1", "5-2", "2-6", "0-1", "2-3"];   // doble en quinta
const salida = (sistema, salida) => pensadaPara({
  ficha: "5-5", numeroCastigado: null, numeroGenerado: null,
  mano: MANO_SAL, sistema: { sistema: sistema, salida: salida }, jugadas: [] });

t("sin sistema + salida por fuerza: SI marca", salida("ninguno", "fuerza") !== null, true);
t("sin sistema + salida por calidad: SI marca", salida("ninguno", "calidad") !== null, true);
console.log("         (esta mano da " + salida("ninguno", "fuerza") + " por fuerza y " +
            salida("ninguno", "calidad") + " por calidad)");
t("con sistema + salida ninguna: NO marca", salida("clasico", "ninguna"), null);
t("combinado + salida ninguna: NO marca", salida("combinado", "ninguna"), null);
t("sin sistema + salida ninguna: NO marca", salida("ninguno", "ninguna"), null);
t("la salida no cambia por el sistema (clasico vs moderno)",
  salida("clasico", "fuerza") === salida("moderno", "fuerza"), true);
t("ni entre sin sistema y con sistema",
  salida("ninguno", "fuerza") === salida("clasico", "fuerza"), true);

// una mano Buena, para que las dos convenciones se separen de verdad
const MANO_BUENA = ["6-5", "4-3", "2-1", "5-3", "6-2", "4-1", "0-3"];
const salB = (sistema, salida) => pensadaPara({
  ficha: "6-5", numeroCastigado: null, numeroGenerado: null,
  mano: MANO_BUENA, sistema: { sistema: sistema, salida: salida }, jugadas: [] });
t("sin sistema, mano Buena por calidad -> SPP", salB("ninguno", "calidad"), "SPP");
t("y por fuerza da otra cosa", salB("ninguno", "fuerza") !== salB("ninguno", "calidad"), true);

console.log("\n--- pero el resto de la mano sigue siendo cosa del sistema ---");
const enPartida = (sistema, salida) => pensadaPara({
  ficha: "3-4", numeroCastigado: 3, numeroGenerado: 4,
  mano: ["3-4", "4-2"], sistema: { sistema: sistema, salida: salida }, jugadas: ["3-3"] });
t("sin sistema no marca en partida, aunque marque la salida", enPartida("ninguno", "calidad"), null);
t("con sistema marca en partida, aunque no marque la salida", enPartida("moderno", "ninguna"), "CPP");

/* El convenio de salida ya no es del jugador sino de la mesa, y su valor por
   defecto es "fuerza": el que dice si hay fuerza o no en la piedra. */
t("por defecto la salida se marca por fuerza", pensadaPara({
  ficha: "5-5", numeroCastigado: null, numeroGenerado: null, mano: MANO_SAL,
  sistema: { sistema: "clasico" }, jugadas: [] }), salida("clasico", "fuerza"));
t("y con 'ninguna' explicito no se marca", pensadaPara({
  ficha: "5-5", numeroCastigado: null, numeroGenerado: null, mano: MANO_SAL,
  sistema: "clasico", salida: "ninguna", jugadas: [] }), null);
// una partida vieja traia el convenio dentro del jugador: se sigue leyendo
t("se hereda el convenio que viniera en el jugador", pensadaPara({
  ficha: "5-5", numeroCastigado: null, numeroGenerado: null, mano: MANO_SAL,
  sistema: { sistema: "clasico", salida: "ninguna" }, jugadas: [] }), null);
t("y el de la mesa manda sobre el del jugador", pensadaPara({
  ficha: "5-5", numeroCastigado: null, numeroGenerado: null, mano: MANO_SAL,
  sistema: { sistema: "clasico", salida: "ninguna" }, salida: "fuerza", jugadas: [] }),
  salida("clasico", "fuerza"));
t("pero el resto de la mano sigue marcandose igual", pensadaPara({
  ficha: "3-4", numeroCastigado: 3, numeroGenerado: 4,
  mano: ["3-4", "4-2"], sistema: "moderno", jugadas: ["3-3"] }), "CPP");

console.log(fallos ? "\n" + fallos + " FALLOS" : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
