const P = require("../partida.js");

let fallos = 0;
const t = (nombre, cond, extra) => {
  if (!cond) { fallos++; console.log("  FALLA  " + nombre + (extra ? "\n          " + extra : "")); }
  else console.log("  ok     " + nombre);
};
const eq = (nombre, a, b) => t(nombre, JSON.stringify(a) === JSON.stringify(b),
  "obtenido " + JSON.stringify(a) + "\n          esperado " + JSON.stringify(b));

/* ---------- una partida real de 10 jugadas ----------
   No la invento: reparto las 28 fichas con un barajado fijo, juego 10 turnos
   con un jugador simple (la primera legal; si no, pasa) y anoto pensadas,
   veredictos y comentarios encima. Asi la secuencia es legal por construccion
   y la prueba es reproducible. */
const ASI = ["S", "E", "N", "O"];

function repartir() {
  const todas = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) todas.push(a + "-" + b);
  const orden = [], quedan = todas.slice();
  let x = 7;
  while (quedan.length) { x = (x * 31 + 17) % quedan.length; orden.push(quedan.splice(x, 1)[0]); }
  return { S: orden.slice(0, 7), E: orden.slice(7, 14), N: orden.slice(14, 21), O: orden.slice(21, 28) };
}

function jugarDiez(manos) {
  const quedan = {}; ASI.forEach(L => { quedan[L] = manos[L].slice(); });
  const jugadas = []; let ends = null, turno = 0;
  while (jugadas.length < 10) {
    const L = ASI[turno];
    let puesta = null;
    for (const f of quedan[L]) {
      const [a, b] = f.split("-").map(Number);
      if (ends === null) { puesta = { ficha: f, lado: null }; break; }
      if (a === ends[0] || b === ends[0]) { puesta = { ficha: f, lado: "I" }; break; }
      if (a === ends[1] || b === ends[1]) { puesta = { ficha: f, lado: "D" }; break; }
    }
    if (!puesta) jugadas.push({ n: jugadas.length + 1, jugador: L, pase: true });
    else {
      quedan[L].splice(quedan[L].indexOf(puesta.ficha), 1);
      const [a, b] = puesta.ficha.split("-").map(Number);
      if (ends === null) ends = [a, b];
      else { const i = puesta.lado === "I" ? 0 : 1; ends[i] = (a === ends[i] ? b : a); }
      jugadas.push({ n: jugadas.length + 1, jugador: L, ficha: puesta.ficha, lado: puesta.lado,
                     pensada: null, veredicto: null, comentario: "" });
    }
    turno = (turno + 1) % 4;
  }
  return jugadas;
}

const MANOS = repartir();
const JUGADAS = jugarDiez(MANOS);
const anota = (i, pensada, veredicto, comentario) => {
  const j = JUGADAS[i]; if (!j || j.pase) return;
  if (pensada) j.pensada = pensada;
  if (veredicto) j.veredicto = veredicto;
  if (comentario) j.comentario = comentario;
};
anota(0, "SPP", "correcta", "doble en cuarta");
anota(1, "CPP", "dudosa", "castiga sin fuerza");
anota(2, "SPP", "correcta", null);
anota(4, "CPP", null, null);
anota(5, null, "error", null);
anota(7, "SPP", null, "abre quintos");
anota(8, "CPP", null, null);
anota(9, "CPP", "correcta", null);

const base = P.normalizar({
  version: 1, id: "p-demo-1", titulo: "Llave del 6",
  fecha: "2026-09-12T14:32:10.000Z", autor: "Andy", notas: "Ejemplo de prueba.",
  etiquetas: ["llave", "dejar correr"], modo: "simulador",
  jugadores: { S: { nombre: null, sistema: "clasico" }, E: { nombre: null, sistema: "moderno" },
               N: { nombre: null, sistema: "ninguno" }, O: { nombre: null, sistema: "ninguno" } },
  manos: JSON.parse(JSON.stringify(MANOS)),
  salidor: "S",
  jugadas: JSON.parse(JSON.stringify(JUGADAS)),
  resultado: { ganador: "SN", puntos: 34, tranca: false },
  marcador: { SN: 34, EO: 0 },
});

console.log("\n--- validacion de la partida base ---");
const v = P.validar(base);
t("la partida de 10 jugadas es valida", v.ok, JSON.stringify(v.errores));

console.log("\n--- ida y vuelta JSON -> texto -> JSON ---");
const texto = P.aTexto(base);
eq("el objeto sobrevive la ida y vuelta", P.limpiar(P.desdeTexto(texto)), P.limpiar(base));

console.log("\n--- parser tolerante (espacios, mayusculas, lineas vacias, | por ·) ---");
const raro = texto
  .replace("# Partida: ", "#partida:   ")
  .replace(/^Fecha:/m, "   FECHA:")
  .replace(/ · /g, "  |  ")
  .replace(/^Sistemas: /m, "sistemas:    ")
  .replace(/^Manos: /m, "MANOS:  ")
  .replace(/^Sale: S/m, "sale:  s")
  .replace(/^Notas:/m, "notas:")
  .replace(/^1\. S/m, "1)   s")
  .split("\n").join("\n\n");
const flojo = P.desdeTexto(raro);
t("sin errores de parseo", !flojo._errores, JSON.stringify(flojo._errores));
eq("el texto desordenado da el mismo objeto", P.limpiar(flojo), P.limpiar(base));

console.log("\n--- variantes: sin resultado, con pases, mano desconocida ---");
const vivo = P.desdeTexto([
  "# Partida: en vivo",
  "Modo: vivo",
  "Manos: S 6-6 6-1 5-5 · E ? · N ? · O ?",
  "Sale: S",
  "1. S 6-6",
  "2. E pasa",
  "3. N pasa",
].join("\n"));
t("sin errores", !vivo._errores, JSON.stringify(vivo._errores));
eq("modo vivo", vivo.modo, "vivo");
eq("manos ajenas a null", [vivo.manos.E, vivo.manos.N, vivo.manos.O], [null, null, null]);
eq("mi mano si se lee y se canoniza", vivo.manos.S, ["6-6", "1-6", "5-5"]);
eq("dos pases", vivo.jugadas.filter(j => j.pase).length, 2);
t("sin resultado no rompe", vivo.resultado === undefined);
t("valida aunque falten manos ajenas", P.validar(vivo).ok, JSON.stringify(P.validar(vivo).errores));

console.log("\n--- validacion rechaza lo ilegal, con numero de linea ---");
const ilegal = P.desdeTexto([
  "# Partida: ilegal",                                                    // 1
  "Manos: S 5-5 5-4 5-1 5-2 6-2 0-1 2-3 · E 5-3 3-6 6-6 6-1 6-4 0-6 1-4 · N 3-3 3-0 0-0 0-2 1-1 1-2 2-2 · O 3-4 4-4 4-2 0-4 6-5 5-0 1-3", // 2
  "Sale: S",                                                              // 3
  "1. S 5-5",                                                             // 4
  "2. E 1-4 D",                                                           // 5  el 1-4 no casa con el 5
].join("\n"));
const vi = P.validar(ilegal);
t("detecta la jugada ilegal", !vi.ok);
t("la senala en la linea 5", vi.errores.some(e => e.linea === 5), JSON.stringify(vi.errores));

const repe = P.desdeTexto([
  "# Partida: repetida",                                                  // 1
  "Manos: S 5-5 5-4 5-1 5-2 6-2 0-1 2-3 · E 5-5 3-6 6-6 6-1 6-4 0-6 1-4 · N 3-3 3-0 0-0 0-2 1-1 1-2 2-2 · O 3-4 4-4 4-2 0-4 6-5 5-0 1-3", // 2
  "Sale: S",
  "1. S 5-5",
].join("\n"));
const vr = P.validar(repe);
t("detecta la ficha repetida", !vr.ok && vr.errores.some(e => /repetida/.test(e.texto)), JSON.stringify(vr.errores));
t("la senala en la linea de Manos (2)", vr.errores.some(e => e.linea === 2), JSON.stringify(vr.errores));

console.log("\n--- linea que no se entiende ---");
const basura = P.desdeTexto(["# Partida: x", "Sale: S", "esto no es nada"].join("\n"));
t("avisa con numero de linea", basura._errores && basura._errores[0].linea === 3,
  JSON.stringify(basura._errores));

console.log("\n--- desdeEstado / aEstado ---");
const est = P.aEstado(base);
eq("10 entradas en el historial", est.hist.length, 10);
eq("conserva pensadas", est.hist.filter(h => h.pensada).length, JUGADAS.filter(j => j.pensada).length);
eq("conserva veredictos", est.hist.filter(h => h.veredicto).length, JUGADAS.filter(j => j.veredicto).length);
eq("conserva comentarios", est.hist.filter(h => h.comentario).length, JUGADAS.filter(j => j.comentario).length);
eq("sistemas por asiento", est.sistemas, { 0: "clasico", 1: "moderno", 2: "ninguno", 3: "ninguno" });
t("puntas coherentes", Array.isArray(est.ends) && est.ends.length === 2, JSON.stringify(est.ends));
const jugadasDeS = JUGADAS.filter(j => !j.pase && j.jugador === "S").length;
eq("a S le quedan las que no jugo", est.manos.S.length, 7 - jugadasDeS);

const GSfalso = {
  hands: [new Set(est.manos.S), new Set(est.manos.E), new Set(est.manos.N), new Set(est.manos.O)],
  hist: est.hist,
};
const ida = P.desdeEstado(GSfalso, {
  salidor: 0, sistemas: est.sistemas, modo: "simulador", id: "p-demo-1",
  titulo: "Llave del 6", fecha: "2026-09-12T14:32:10.000Z", autor: "Andy",
  notas: "Ejemplo de prueba.", etiquetas: ["llave", "dejar correr"],
  resultado: base.resultado, marcador: base.marcador,
});
const ordena = p => { const c = P.limpiar(p); ASI.forEach(a => { if (c.manos[a]) c.manos[a].sort(); }); return c; };
eq("desdeEstado reconstruye el reparto completo", ordena(ida), ordena(base));
t("y lo reconstruido vuelve a ser valido", P.validar(ida).ok, JSON.stringify(P.validar(ida).errores));

console.log("\n================ TEXTO DE EJEMPLO (partida corta) ================");
const corta = P.desdeTexto([
  "# Partida: Llave del 6",
  "Fecha: 2026-09-12T14:32:10.000Z · Autor: Andy · Modo: simulador · Id: p-demo-1",
  "Etiquetas: llave, dejar correr",
  "Sistemas: S clasico · E moderno · N ninguno · O ninguno",
  "Manos: S 5-5 5-4 5-1 5-2 6-2 0-1 2-3 · E 3-5 3-6 6-6 1-6 4-6 0-6 1-4 · N 3-3 0-3 0-0 0-2 1-1 1-2 2-2 · O 3-4 4-4 2-4 0-4 5-6 0-5 1-3",
  "Sale: S",
  "1. S 5-5 SPP ✓ \"doble en cuarta\"",
  "2. E 3-5 D CPP ? \"castiga sin fuerza\"",
  "3. N 3-3 D SPP ✓",
  "4. O pasa",
  "Resultado: gana S-N por 34",
  "Notas: Ejemplo de prueba.",
].join("\n"));
console.log(P.aTexto(corta));
console.log("\n(valida: " + P.validar(corta).ok + ")");

console.log(fallos ? "\n" + fallos + " FALLOS" : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
