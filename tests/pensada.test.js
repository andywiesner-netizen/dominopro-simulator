const { pensadaPara } = require("../conocimiento.js");

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
  ficha: "1-1", numeroCastigado: null, numeroGenerado: null,
  mano: ["1-1", "1-2", "1-3", "1-4", "0-5", "0-6", "2-4"], sistema: "clasico", jugadas: [] }), "SPP");
t("Ej.4 A sale 3-3 (doble en segunda)", pensadaPara({
  ficha: "3-3", numeroCastigado: null, numeroGenerado: null,
  mano: ["3-3", "3-4", "4-1", "0-4", "0-5", "1-6", "2-2"], sistema: "moderno", jugadas: [] }), "CPP");

// ---- sistema ninguno y bordes ----
console.log("\n--- sistema 'ninguno' y bordes ---");
t("sistema ninguno -> null", pensadaPara({
  ficha: "5-4", numeroCastigado: 5, numeroGenerado: 4,
  mano: ["5-4", "5-3"], sistema: "ninguno", jugadas: [] }), null);
t("sin sistema -> null", pensadaPara({ ficha: "5-4", numeroCastigado: 5, numeroGenerado: 4, mano: ["5-4"] }), null);
t("ficha invalida -> null", pensadaPara({ ficha: "9-9", numeroCastigado: 1, numeroGenerado: 2, mano: [], sistema: "clasico" }), null);

// pureza: no muta la mano
const m = ["5-4", "5-3"], antes = m.slice();
pensadaPara({ ficha: "5-4", numeroCastigado: 5, numeroGenerado: 4, mano: m, sistema: "clasico", jugadas: [] });
t("no muta la mano recibida", JSON.stringify(m), JSON.stringify(antes));

console.log(fallos ? "\n" + fallos + " FALLOS" : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
