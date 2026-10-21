/* ================= CLASIFICACION, EJERCICIOS Y FILTROS =================
   Tres cosas: que las listas de clasificacion.js sean la UNICA fuente, que lo
   clasificado sobreviva el viaje por texto y por enlace, y que los filtros
   devuelvan lo que deben. */
const fs = require("fs"), path = require("path");
const C = require("../clasificacion.js");
const P = require("../partida.js");
const E = require("../ejercicios.js");
const N = require("../nube.js");

let fallos = 0;
const t = (nombre, cond, extra) => {
  if (!cond) { fallos++; console.log("  FALLA  " + nombre + (extra ? "\n           " + extra : "")); }
  else console.log("  ok     " + nombre);
};
const eq = (nombre, a, b) => t(nombre, JSON.stringify(a) === JSON.stringify(b),
  "obtenido " + JSON.stringify(a) + "\n           esperado " + JSON.stringify(b));

/* ========== 1. las listas son la unica fuente ========== */
console.log("\n--- los ejes viven solo en clasificacion.js ---");
const RAIZ = path.join(__dirname, "..");
const OTROS = ["ui.js", "ejercicios.js", "partida.js", "nube.js", "conocimiento.js", "index.html"];
const ids = C.TEMAS.map(x => x.id);
const colados = [];
OTROS.forEach(f => {
  const src = fs.readFileSync(path.join(RAIZ, f), "utf8");
    // un tema escrito a mano seria un literal entrecomillado; buscar el id
    // pelado cazaria palabras normales como "indicar" dentro de un comentario
    ids.forEach(id => {
      ['"' + id + '"', "'" + id + "'", "`" + id + "`"].forEach(lit => {
        if (src.indexOf(lit) >= 0) colados.push(f + " -> " + lit);
      });
    });
});
t("ningun tema escrito a mano fuera de clasificacion.js", colados.length === 0, colados.join("\n           "));
t("los 19 temas del taller estan", C.TEMAS.length === 19, String(C.TEMAS.length));
t("ningun id repetido", new Set(ids).size === ids.length);
t("cada tema tiene nombre", C.TEMAS.every(x => x.id && x.nombre));

console.log("\n--- un valor que no esta en la lista no entra ---");
eq("un tema inventado se descarta",
  C.paraGuardar({ temas: ["tema-llave", "inventado-a-mano"] }), { temas: ["tema-llave"] });
eq("un momento inventado se descarta", C.paraGuardar({ momento: "mitad" }), null);
eq("y se reporta como error",
  C.erroresClas({ momento: "mitad", temas: ["xxx"] }).length, 2);
eq("sin nada que decir, no se guarda nada", C.paraGuardar({ temas: [] }), null);
eq("los temas repetidos se funden", C.paraGuardar({ temas: ["tema-llave", "tema-llave"] }), { temas: ["tema-llave"] });

console.log("\n--- lo deducible se sugiere ---");
eq("la jugada 1 es la salida", C.momentoSugerido(1), "salida");
eq("la 3 es primera vuelta", C.momentoSugerido(3), "primera");
eq("la 9 es medio juego", C.momentoSugerido(9), "medio");
eq("con 3 fichas en mano, cierre", C.momentoSugerido(9, 3), "cierre");

/* ========== 2. el viaje por texto y por enlace ========== */
function partidaDePrueba() {
  const todas = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) todas.push(a + "-" + b);
  const ASI = ["S", "E", "N", "O"];
  const manos = { S: todas.slice(0, 7), E: todas.slice(7, 14), N: todas.slice(14, 21), O: todas.slice(21, 28) };
  const p = { version: 1, id: "p-clas", titulo: "Banco", fecha: null, autor: "", notas: "",
    etiquetas: [], modo: "simulador",
    jugadores: { S: { nombre: null, sistema: "clasico" }, E: { nombre: null, sistema: "clasico" },
                 N: { nombre: null, sistema: "clasico" }, O: { nombre: null, sistema: "clasico" } },
    manos: manos, salidor: "S", jugadas: [] };
  const quedan = JSON.parse(JSON.stringify(manos));
  let ends = null, turno = 0;
  for (let i = 0; i < 9; i++) {
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
      else { const k = puesta.lado === "I" ? 0 : 1; ends[k] = (a === ends[k] ? b : a); }
      p.jugadas.push({ n: p.jugadas.length + 1, jugador: L, ficha: puesta.ficha, lado: puesta.lado,
                       pensada: "CPP", veredicto: null, comentario: "" });
    }
    turno = (turno + 1) % 4;
  }
  return p;
}

console.log("\n--- una partida clasificada sobrevive el texto ---");
const base = partidaDePrueba();
base.clasificacion = C.paraGuardar({ origen: "propia", temas: ["tema-tantera", "tema-llave"], dificultad: "medio" });
base.jugadas[4].clasificacion = C.paraGuardar({ momento: "medio", temas: ["tema-dejar-correr"], sistema: "clasico" });
const txt = P.aTexto(base);
t("la partida lleva su linea", /^Clasificacion: /m.test(txt), txt.split("\n").slice(0, 5).join(" | "));
t("y la jugada la suya", /^\s+\+ momento medio/m.test(txt), txt);
eq("ida y vuelta exacta", P.limpiar(P.desdeTexto(txt)), P.limpiar(base));
eq("la clasificacion llega al historial", P.posicionEn(base, 9).hist[4].clasificacion,
  base.jugadas[4].clasificacion);

console.log("\n--- y el viaje por el enlace ---");
(async () => {
  const r = await N.publicar(base);
  t("el enlace se genera", r.ok, JSON.stringify(r.motivo));
  const vuelta = await N.abrir(r.url);
  eq("la clasificacion de la partida vuelve", vuelta.clasificacion, base.clasificacion);
  eq("la de la jugada tambien", vuelta.jugadas[4].clasificacion, base.jugadas[4].clasificacion);

  console.log("\n--- un ejercicio clasificado ---");
  const ej = E.desdeJugada(base, 5, { origen: "propia", id: "e1",
    clasificacion: { temas: ["tema-llave", "tema-cuadres"], dificultad: "avanzado" } });
  t("se crea", !!ej);
  t("es valido", E.validarEjercicio(ej).ok, JSON.stringify(E.validarEjercicio(ej).errores));
  eq("la partida queda recortada en esa jugada", ej.partida.jugadas.length, 5);
  t("no se ve lo que pasa despues", ej.partida.jugadas.length < base.jugadas.length);
  eq("la solucion es la jugada pedida", ej.solucion.ficha, base.jugadas[4].ficha);
  eq("el momento se deduce", ej.clasificacion.momento, "medio");
  eq("los temas pedidos se respetan", ej.clasificacion.temas, ["tema-llave", "tema-cuadres"]);
  eq("y el origen", ej.clasificacion.origen, "propia");
  t("un pase no se convierte", E.desdeJugada({ jugadas: [{ pase: true, jugador: "S" }] }, 1) === null);
  const et = E.aTextoEjercicio(ej);
  t("el texto del ejercicio lleva su clasificacion", /^Clasificacion: /m.test(et), et.split("\n").slice(0, 6).join(" | "));
  t("y la solucion", /^Solucion: /m.test(et), et);

  /* ========== 3. los filtros ========== */
  console.log("\n--- filtros sobre un banco de prueba ---");
  const banco = [
    { id: "a", clasificacion: { momento: "salida",  temas: ["tema-llave"],              dificultad: "basico",   origen: "taller" } },
    { id: "b", clasificacion: { momento: "medio",   temas: ["tema-llave", "tema-cuadres"],   dificultad: "avanzado", origen: "propia" } },
    { id: "c", clasificacion: { momento: "medio",   temas: ["tema-cuadres"],            dificultad: "medio",    origen: "propia" } },
    { id: "d", clasificacion: { momento: "cierre",  temas: ["tema-tranca", "tema-llave"],    dificultad: "avanzado", origen: "taller" } },
    { id: "e", clasificacion: null },
  ];
  const ids2 = f => C.filtrar(banco, f).map(x => x.id);
  eq("sin filtros, todos", ids2({}), ["a", "b", "c", "d", "e"]);
  eq("por momento", ids2({ momento: "medio" }), ["b", "c"]);
  eq("por dificultad", ids2({ dificultad: "avanzado" }), ["b", "d"]);
  eq("por origen", ids2({ origen: "taller" }), ["a", "d"]);
  eq("por un tema", ids2({ temas: ["tema-llave"] }), ["a", "b", "d"]);
  eq("los temas se piden TODOS", ids2({ temas: ["tema-llave", "tema-cuadres"] }), ["b"]);
  eq("combinados", ids2({ temas: ["tema-llave"], dificultad: "avanzado" }), ["b", "d"]);
  eq("combinacion imposible", ids2({ momento: "salida", dificultad: "avanzado" }), []);
  eq("lo no clasificado solo sale sin filtros", C.filtrar(banco, { origen: "propia" }).some(x => x.id === "e"), false);
  eq("la cuenta por eje", C.cuenta(banco, {}, "dificultad"), { basico: 1, medio: 1, avanzado: 2 });
  eq("la cuenta respeta el resto de filtros",
    C.cuenta(banco, { origen: "taller" }, "dificultad"), { basico: 1, medio: 0, avanzado: 1 });
  t("hayFiltro distingue vacio de puesto",
    C.hayFiltro({}) === false && C.hayFiltro({ temas: [] }) === false && C.hayFiltro({ momento: "medio" }) === true);

  console.log(fallos ? "\n" + fallos + " FALLOS" : "\nTodo correcto");
  process.exit(fallos ? 1 : 0);
})();
