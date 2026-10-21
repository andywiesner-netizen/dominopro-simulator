"use strict";
/* ================= EJERCICIOS =================
   Modulo PURO: sin DOM, sin estado propio.

   Un ejercicio es una PARTIDA RECORTADA hasta una jugada, mas quien la
   resuelve, la solucion y su clasificacion. Se mira la posicionEjercicio justo ANTES
   de esa jugada (ahi es donde hay que decidir) y la solucion es la jugada
   misma: ficha, punta y pensada, porque en esta escuela la jugada completa
   incluye como se juega.

   Nace de la ficha de anotacion de una jugada, que es donde ya estan el
   veredicto y el comentario: lo que se anota como interesante es justo lo que
   se convierte en ejercicio. */

var _ejNode = (typeof window === "undefined" && typeof require !== "undefined");
var _P = _ejNode ? require("./partida.js") : null;
var _C = _ejNode ? require("./clasificacion.js") : null;
var _posicionEn = _P ? _P.posicionEn : posicionEn;
var _truncar    = _P ? _P.truncar    : truncar;
/* En el navegador no hay require: se usan los globales tal como se llaman en
   partida.js y clasificacion.js. Por eso ahi los nombres no se repiten. */
var _valPartida = _P ? _P.validar    : validar;
var _aTextoPart = _P ? _P.aTexto     : aTexto;
var _clas       = _C ? _C            : null;
const _cl = {
  paraGuardar: o => (_clas ? _clas.paraGuardar(o)         : paraGuardar(o)),
  errores:     o => (_clas ? _clas.erroresClas(o)         : erroresClas(o)),
  momento:  (n, f) => (_clas ? _clas.momentoSugerido(n, f) : momentoSugerido(n, f)),
  aTexto:      o => (_clas ? _clas.clasATexto(o)          : clasATexto(o)),
};

const VERSION_EJ = 1;
const ASI_EJ = ["S", "E", "N", "O"];

/* desdeJugada(partida, n, opciones) -> ejercicio
   n es el numero de jugada (1 = la salida). La posicionEjercicio a resolver es la de
   ANTES; la jugada n es la solucion. Devuelve null si esa jugada es un pase:
   un pase no se pregunta. */
function desdeJugada(partida, n, opciones) {
  const o = opciones || {};
  const jug = (partida && partida.jugadas) || [];
  const j = jug[n - 1];
  if (!j || j.pase) return null;

  // la partida se recorta: un ejercicio no debe llevar lo que pasa despues,
  // que seria ensenar la respuesta de las siguientes
  const corte = _truncar(partida, n, { titulo: partida.titulo || "" });
  delete corte.variante_de;

  const pos = _posicionEn(partida, n - 1);
  const mano = (pos.manos[j.jugador] || []).slice();

  const clas = _cl.paraGuardar(Object.assign({
    momento: _cl.momento(n, mano.length),
    sistema: (pos.sistemas[ASI_EJ.indexOf(j.jugador)] || {}).sistema || null,
    origen: o.origen || "propia",
  }, o.clasificacion || {}));

  return {
    version: VERSION_EJ,
    id: o.id || null,
    titulo: o.titulo || "",
    fecha: o.fecha || null,
    n: n,
    jugador: j.jugador,
    partida: corte,
    solucion: { ficha: j.ficha, lado: j.lado || null, pensada: j.pensada || null,
                sistema: j.sistema || null },
    explicacion: o.explicacion || j.comentario || "",
    clasificacion: clas,
    de: { partida: partida.id || null, titulo: partida.titulo || "", jugada: n },
  };
}

/* La posicionEjercicio que ve quien resuelve: la mesa ANTES de la jugada pedida. */
function posicionEjercicio(ej) {
  return _posicionEn(ej.partida, ej.n - 1);
}
/* La mano de quien resuelve, o null si esa mano no se conoce. */
function manoDeEjercicio(ej) {
  const m = posicionEjercicio(ej).manos[ej.jugador];
  return m ? m.slice() : null;
}

const NOMBRE_ASIENTO = { S: "Sur", E: "Este", N: "Norte", O: "Oeste" };
/* El enunciadoEjercicio, en lenguaje de mesa. */
function enunciadoEjercicio(ej) {
  const pos = posicionEjercicio(ej);
  const puntas = pos.ends ? pos.ends[0] + " y " + pos.ends[1] : "la mesa esta vacia";
  const quien = NOMBRE_ASIENTO[ej.jugador] || ej.jugador;
  return pos.ends
    ? "Juega " + quien + ". Puntas: " + puntas + ". ¿Qué ficha y con qué pensada?"
    : "Sale " + quien + ". ¿Con qué ficha y con qué pensada?";
}
/* La solucion escrita de corrido. */
function solucionTextoEjercicio(ej) {
  const s = ej.solucion || {};
  if (!s.ficha) return "(sin solución)";
  const lado = s.lado === "I" ? " por la izquierda" : s.lado === "D" ? " por la derecha" : "";
  const pen = s.pensada ? ", " + s.pensada + (s.sistema ? " en " + s.sistema : "") : "";
  return s.ficha + lado + pen;
}

function validarEjercicio(ej) {
  const err = [];
  if (!ej || typeof ej !== "object") return { ok: false, errores: ["no es un ejercicio"] };
  if (ej.version !== VERSION_EJ) err.push("version desconocida: " + ej.version);
  if (!ej.n || ej.n < 1) err.push("numero de jugada invalido: " + ej.n);
  if (ASI_EJ.indexOf(ej.jugador) < 0) err.push("jugador invalido: " + ej.jugador);
  if (!ej.partida) err.push("falta la partida");
  else {
    const v = _valPartida(ej.partida);
    if (!v.ok) err.push("la partida del ejercicio no es valida: " + v.errores[0].texto);
    if ((ej.partida.jugadas || []).length !== ej.n)
      err.push("la partida deberia estar recortada en la jugada " + ej.n);
  }
  if (!ej.solucion || !ej.solucion.ficha) err.push("falta la ficha de la solucion");
  _cl.errores(ej.clasificacion).forEach(e => err.push(e));
  return { ok: err.length === 0, errores: err };
}

/* ---------- texto, para pegar y para el enlace ---------- */
function aTextoEjercicio(ej) {
  const L = [];
  L.push("# Ejercicio: " + (ej.titulo || "(sin titulo)"));
  const meta = [];
  if (ej.fecha) meta.push("Fecha: " + ej.fecha);
  if (ej.id) meta.push("Id: " + ej.id);
  meta.push("Jugada: " + ej.n);
  meta.push("Resuelve: " + ej.jugador);
  L.push(meta.join(" · "));
  const c = _cl.aTexto(ej.clasificacion);
  if (c) L.push("Clasificacion: " + c);
  if (ej.de && ej.de.partida) L.push("De la partida: " + ej.de.partida + " en la jugada " + ej.de.jugada);
  L.push("Solucion: " + solucionTextoEjercicio(ej));
  if (ej.explicacion) L.push("Explicacion: " + ej.explicacion);
  L.push("--- partida ---");
  L.push(_aTextoPart(ej.partida));
  return L.join("\n");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { VERSION_EJ, desdeJugada, posicionEjercicio, manoDeEjercicio, enunciadoEjercicio,
                     solucionTextoEjercicio, validarEjercicio, aTextoEjercicio, NOMBRE_ASIENTO };
}
