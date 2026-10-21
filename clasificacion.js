"use strict";
/* ================= CLASIFICACION DE PARTIDAS Y EJERCICIOS =================
   Modulo PURO: sin DOM, sin estado propio. Es la UNICA fuente de los cuatro
   ejes. La interfaz, los filtros y las hojas impresas leen de aqui, de modo
   que anadir un tema sea tocar una linea de este fichero y nada mas.

   Ejes:
     momento     uno   en que parte de la mano ocurre
     temas       varios  que principios entrena
     sistema     uno   con que sistema de informacion se juega
     dificultad  uno   que hace falta para resolverlo
   Y aparte de los ejes: de donde sale (taller o partida propia) y, si es
   propia, de que partida y jugada. */

const MOMENTOS = [
  { id: "salida",    nombre: "Salida",          ayuda: "la mesa esta clasVacia" },
  { id: "primera",   nombre: "Primera vuelta",  ayuda: "las primeras cuatro jugadas" },
  { id: "medio",     nombre: "Medio juego",     ayuda: "la mano ya esta abierta" },
  { id: "cierre",    nombre: "Cierre",          ayuda: "quedan pocas fichas" },
];

/* Los temas salen de los principios del taller. Anadir uno es anadir una
   linea aqui: nada mas los escribe a mano. */
/* Los ids llevan el prefijo tema- a proposito: sin el, "tranca" chocaria con
   el tipo de final de ronda y el guardia de que nadie los escriba a mano se
   volveria inutil. */
const TEMAS = [
  { id: "tema-repetir-companero",  nombre: "Repetir al compañero" },
  { id: "tema-castigar-contrario", nombre: "Castigar al contrario" },
  { id: "tema-indicar",            nombre: "Indicar lo que se tiene" },
  { id: "tema-encima-debajo",      nombre: "Por encima / por debajo" },
  { id: "tema-facilidades",        nombre: "Facilidades al compañero" },
  { id: "tema-dificultades",       nombre: "Dificultades al contrario" },
  { id: "tema-tiempo",             nombre: "Tiempo de la jugada" },
  { id: "tema-irse-falla",         nombre: "Irse de la falla" },
  { id: "tema-llave",              nombre: "La llave" },
  { id: "tema-dejar-correr",       nombre: "Dejar correr" },
  { id: "tema-pegar-falla",        nombre: "Pegar con la falla" },
  { id: "tema-matar-doble",        nombre: "Matar el doble" },
  { id: "tema-proteccion",         nombre: "Protección" },
  { id: "tema-cuadres",            nombre: "Cuadres" },
  { id: "tema-tranca",            nombre: "La tranca" },
  { id: "tema-con-companero",      nombre: "Jugar con el compañero" },
  { id: "tema-cerrada",            nombre: "Jugar cerrada" },
  { id: "tema-lectura-pensada",    nombre: "Lectura de la pensada" },
  { id: "tema-tantera",            nombre: "Tantera" },
];

const SISTEMAS_CLAS = [
  { id: "ninguno",   nombre: "Ninguno" },
  { id: "clasico",   nombre: "Clásico" },
  { id: "moderno",   nombre: "Moderno" },
  { id: "combinado", nombre: "Combinado" },
];

const DIFICULTADES = [
  { id: "basico",    nombre: "Básico",   ayuda: "un solo principio decide" },
  { id: "medio",     nombre: "Medio",     ayuda: "hay que leer información" },
  { id: "avanzado",  nombre: "Avanzado",  ayuda: "dos principios compiten" },
];

const ORIGENES = [
  { id: "taller",  nombre: "Del taller" },
  { id: "propia",  nombre: "De una partida propia" },
];

const EJES = { momento: MOMENTOS, tema: TEMAS, sistema: SISTEMAS_CLAS,
               dificultad: DIFICULTADES, origen: ORIGENES };

/* ---------- consultas ---------- */
const idsDe = lista => lista.map(x => x.id);
function nombreDe(eje, id) {
  const l = EJES[eje] || [];
  const x = l.find(y => y.id === id);
  return x ? x.nombre : null;
}
const esValido = (eje, id) => !!nombreDe(eje, id);
function nombresTemas(ids) {
  return (ids || []).map(id => nombreDe("tema", id)).filter(Boolean);
}

/* ---------- la clasificacion de una jugada, ejercicio o partida ----------
   Siempre la misma forma, venga de donde venga. Un valor que no este en las
   listas se descarta: asi nadie cuela un tema escrito a mano. */
function normalizarClas(c) {
  const o = c || {};
  const temas = (Array.isArray(o.temas) ? o.temas : [])
    .filter(t => esValido("tema", t))
    .filter((t, i, a) => a.indexOf(t) === i);
  return {
    momento:    esValido("momento", o.momento) ? o.momento : null,
    temas:      temas,
    sistema:    esValido("sistema", o.sistema) ? o.sistema : null,
    dificultad: esValido("dificultad", o.dificultad) ? o.dificultad : null,
    origen:     esValido("origen", o.origen) ? o.origen : null,
  };
}
// true si no dice nada: asi no se guardan clasificaciones vacias
function clasVacia(c) {
  const n = normalizarClas(c);
  return !n.momento && !n.temas.length && !n.sistema && !n.dificultad && !n.origen;
}
/* Devuelve la clasificacion lista para guardar, o null si no dice nada.
   Guardar {momento:null, temas:[]} seria ensuciar el formato. */
function paraGuardar(c) {
  if (clasVacia(c)) return null;
  const n = normalizarClas(c);
  const r = {};
  if (n.momento) r.momento = n.momento;
  if (n.temas.length) r.temas = n.temas;
  if (n.sistema) r.sistema = n.sistema;
  if (n.dificultad) r.dificultad = n.dificultad;
  if (n.origen) r.origen = n.origen;
  return r;
}
function erroresClas(c) {
  const o = c || {}, err = [];
  if (o.momento && !esValido("momento", o.momento)) err.push("momento desconocido: " + o.momento);
  (Array.isArray(o.temas) ? o.temas : []).forEach(t => {
    if (!esValido("tema", t)) err.push("tema desconocido: " + t);
  });
  if (o.sistema && !esValido("sistema", o.sistema)) err.push("sistema desconocido: " + o.sistema);
  if (o.dificultad && !esValido("dificultad", o.dificultad)) err.push("dificultad desconocida: " + o.dificultad);
  if (o.origen && !esValido("origen", o.origen)) err.push("origen desconocido: " + o.origen);
  return err;
}

/* ---------- lo que se puede deducir ----------
   Se sugiere, no se impone: quien anota puede cambiarlo. */
function momentoSugerido(nJugada, fichasEnMano) {
  if (!nJugada || nJugada <= 1) return "salida";
  if (nJugada <= 4) return "primera";
  if (fichasEnMano !== undefined && fichasEnMano !== null && fichasEnMano <= 3) return "cierre";
  return nJugada >= 17 ? "cierre" : "medio";
}

/* ---------- filtros ----------
   filtros = {momento, temas:[], sistema, dificultad, origen, texto}
   Un eje vacio no filtra. Los temas son conjuncion: pide TODOS los marcados,
   que es lo util para armar una hoja de un tema concreto. */
function pasa(item, filtros) {
  const f = filtros || {};
  const c = normalizarClas((item && item.clasificacion) || item);
  if (f.momento && c.momento !== f.momento) return false;
  if (f.sistema && c.sistema !== f.sistema) return false;
  if (f.dificultad && c.dificultad !== f.dificultad) return false;
  if (f.origen && c.origen !== f.origen) return false;
  if (Array.isArray(f.temas) && f.temas.length &&
      !f.temas.every(t => c.temas.indexOf(t) >= 0)) return false;
  if (f.texto) {
    const t = String(f.texto).toLowerCase();
    const donde = [(item && item.titulo) || "", (item && item.enunciado) || "",
                   (item && item.explicacion) || ""].join(" ").toLowerCase();
    if (donde.indexOf(t) < 0) return false;
  }
  return true;
}
function filtrar(lista, filtros) {
  return (lista || []).filter(x => pasa(x, filtros));
}
// cuantos quedarian por cada valor de un eje, con el resto de filtros puestos
function cuenta(lista, filtros, eje) {
  const r = {};
  (EJES[eje] || []).forEach(v => {
    const f = Object.assign({}, filtros);
    if (eje === "tema") f.temas = ((filtros || {}).temas || []).concat([v.id]);
    else f[eje] = v.id;
    r[v.id] = filtrar(lista, f).length;
  });
  return r;
}
const hayFiltro = f => !!(f && (f.momento || f.sistema || f.dificultad || f.origen ||
                                (f.temas && f.temas.length) || f.texto));

/* ---------- texto, para el formato de partida ----------
   "medio | clasico | medio juego" seria ilegible; se escriben los ids, que son
   estables, y la interfaz pone los nombres. */
function clasATexto(c) {
  const n = paraGuardar(c);
  if (!n) return "";
  const p = [];
  if (n.momento) p.push("momento " + n.momento);
  if (n.temas && n.temas.length) p.push("temas " + n.temas.join(","));
  if (n.sistema) p.push("sistema " + n.sistema);
  if (n.dificultad) p.push("dificultad " + n.dificultad);
  if (n.origen) p.push("origen " + n.origen);
  return p.join(" · ");
}
function clasDesdeTexto(txt) {
  const c = {};
  String(txt || "").split(/\s*[·|]\s*/).forEach(tr => {
    const q = tr.trim().split(/\s+/);
    if (q.length < 2) return;
    const clave = q[0].toLowerCase(), val = q.slice(1).join(" ");
    if (clave === "temas") c.temas = val.split(",").map(x => x.trim()).filter(Boolean);
    else if (["momento", "sistema", "dificultad", "origen"].indexOf(clave) >= 0) c[clave] = val.toLowerCase();
  });
  return paraGuardar(c);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MOMENTOS, TEMAS, SISTEMAS_CLAS, DIFICULTADES, ORIGENES, EJES,
                     idsDe, nombreDe, esValido, nombresTemas,
                     normalizarClas, clasVacia, paraGuardar, erroresClas, momentoSugerido,
                     pasa, filtrar, cuenta, hayFiltro, clasATexto, clasDesdeTexto };
}
