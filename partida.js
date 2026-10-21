"use strict";
/* ================= PARTIDA: objeto, texto e intercambio =================
   Modulo PURO: sin DOM, sin estado global propio. Convierte entre el estado
   vivo del simulador / asistente y un objeto `partida` serializable, y entre
   ese objeto y un texto legible para pegar en WhatsApp, correo o un chat.

   Asientos: S=Sur(0) E=Este(1) N=Norte(2) O=Oeste(3), en orden de juego.
   Depende de conocimiento.js solo para reconstruir y validar la mesa. */

var _con = (typeof reconstruirMesa === "undefined" && typeof require !== "undefined")
  ? require("./conocimiento.js") : null;
var _reconstruir = _con ? _con.reconstruirMesa : reconstruirMesa;
var _ficha = _con ? _con.ficha : ficha;
var _config = _con ? _con.configJugador : configJugador;
var _convenio = _con ? _con.convenioSalida : convenioSalida;

const ASIENTOS = ["S", "E", "N", "O"];
const SEAT = { S: 0, E: 1, N: 2, O: 3 };
const VEREDICTOS = { correcta: "✓", dudosa: "?", error: "✗" };
const POR_SIMBOLO = { "✓": "correcta", "?": "dudosa", "✗": "error" };
const VERSION = 1;
const SISTEMAS_OK = ["ninguno", "clasico", "moderno", "combinado"];
const SALIDAS_OK = ["ninguna", "fuerza", "calidad"];
const SUFIJO = { clasico: "/C", moderno: "/M" };

/* La clasificacion se escribe y se lee tal cual: los ejes los define
   clasificacion.js y aqui no se juzgan, solo viajan. */
function _clasTexto(c) {
  const p = [];
  if (c.momento) p.push("momento " + c.momento);
  if (c.temas && c.temas.length) p.push("temas " + c.temas.join(","));
  if (c.sistema) p.push("sistema " + c.sistema);
  if (c.dificultad) p.push("dificultad " + c.dificultad);
  if (c.origen) p.push("origen " + c.origen);
  return p.join(" \u00b7 ");
}
function _clasDesde(txt) {
  const c = {};
  String(txt || "").split(/\s*[\u00b7|]\s*/).forEach(tr => {
    const q = tr.trim().split(/\s+/);
    if (q.length < 2) return;
    const k = q[0].toLowerCase(), v = q.slice(1).join(" ");
    if (k === "temas") c.temas = v.split(",").map(x => x.trim()).filter(Boolean);
    else if (["momento", "sistema", "dificultad", "origen"].indexOf(k) >= 0) c[k] = v.toLowerCase();
  });
  // en el mismo orden en que se escriben, para que la ida y vuelta sea exacta
  // aunque el texto venga con las partes cambiadas de sitio
  const orden = {};
  ["momento", "temas", "sistema", "dificultad", "origen"].forEach(k => {
    if (c[k] !== undefined) orden[k] = c[k];
  });
  return Object.keys(orden).length ? orden : null;
}
var _CONV_DEF = _con ? _con.CONVENIO_DEFECTO : CONVENIO_DEFECTO;

/* El convenio de salida es de la MESA, no de cada jugador: la salida es una.
   Las partidas guardadas antes de esto lo llevaban por jugador; de esas se
   hereda el del salidor, y se dice, para no perderlas ni cambiarlas en
   silencio. Devuelve {convenio, heredado, de}. */
function convenioDe(partida) {
  const p = partida || {};
  if (SALIDAS_OK.includes(p.convenio))
    return { convenio: p.convenio, heredado: false, de: null };
  const L = ASIENTOS.includes(p.salidor) ? p.salidor : "S";
  const suya = ((p.jugadores || {})[L] || {}).salida;
  if (SALIDAS_OK.includes(suya))
    return { convenio: suya, heredado: true, de: L };
  // alguno lo llevaba, aunque no el salidor: tambien cuenta como heredado
  const otro = ASIENTOS.filter(a => SALIDAS_OK.includes(((p.jugadores || {})[a] || {}).salida))[0];
  if (otro) return { convenio: p.jugadores[otro].salida, heredado: true, de: otro };
  return { convenio: _CONV_DEF, heredado: false, de: null };
}
const POR_SUFIJO = { C: "clasico", M: "moderno" };

/* La configuracion de un jugador se guarda ESCUETA: solo lo que no es el valor
   por defecto. Asi una partida que no usa nada de esto queda igual que antes,
   y las partidas y enlaces guardados sin estos campos siguen abriendo: lo que
   falte lo pone configJugador(). */
function jugadorMinimo(nombre, cfg) {
  const c = _config(cfg);
  const j = { nombre: nombre || null, sistema: c.sistema };
  if (c.sistema === "combinado" || c.inicial !== "moderno") j.combinado = { inicial: c.inicial };
  // ya no se escribe la salida por jugador; si venia de una partida vieja se
  // respeta tal cual, que es de donde se hereda el convenio al abrirla
  if (SALIDAS_OK.includes(c.salida)) j.salida = c.salida;
  return j;
}

const letra = i => ASIENTOS[i];
const asiento = L => SEAT[String(L).toUpperCase()];
const norm = f => { const t = _ficha(f); return t ? t[0] + "-" + t[1] : null; };

/* ---------- de estado vivo a partida ---------- */

/* desdeEstado(estado, opciones)
   estado = GS del simulador (tiene .hands) o LS del asistente (tiene .hand).
   opciones = { salidor, sistemas, nombres, titulo, autor, notas, etiquetas,
                id, fecha, modo, resultado, marcador } — lo que no vive en el
   estado. Las manos REPARTIDAS se reconstruyen sumando lo que cada uno jugo
   a lo que le queda, para no depender de una foto inicial. */
function desdeEstado(estado, opciones) {
  const o = opciones || {};
  const hist = (estado && estado.hist) || [];
  const modo = o.modo || (estado && estado.hands ? "simulador" : "vivo");
  const jugadasDe = p => hist.filter(h => !h.paso && h.jugador === p).map(h => norm(h.ficha));

  const manos = {};
  ASIENTOS.forEach((L, p) => {
    let quedan = null;
    if (estado && estado.hands && estado.hands[p]) quedan = [...estado.hands[p]];
    else if (p === 0 && estado && estado.hand) quedan = [...estado.hand];
    manos[L] = quedan === null ? null : quedan.map(norm).concat(jugadasDe(p));
  });

  const jugadores = {};
  ASIENTOS.forEach((L, p) => {
    jugadores[L] = jugadorMinimo((o.nombres && o.nombres[p]) || null, (o.sistemas || {})[p]);
  });

  let n = 0;
  const jugadas = hist.map(h => {
    n++;
    if (h.paso) return { n: n, jugador: letra(h.jugador), pase: true };
    const j = {
      n: n, jugador: letra(h.jugador), ficha: norm(h.ficha),
      lado: h.punta === "I" || h.punta === "D" ? h.punta : null,
      pensada: h.pensada || null,
      veredicto: h.veredicto || null,
      comentario: h.comentario || "",
    };
    // la clasificacion viaja como el veredicto y el comentario; partida.js no
    // la interpreta, solo la lleva: quien manda sobre los ejes es clasificacion.js
    if (h.clasificacion) j.clasificacion = h.clasificacion;
    /* Solo un combinado registra con que sistema jugo, y solo si dejo pensada:
       la marca y el sistema viajan juntos o no viajan (el texto escribe el
       sufijo detras de la pensada, asi que sin pensada no habria donde ponerlo). */
    const cfg = _config((o.sistemas || {})[h.jugador]);
    if (cfg.sistema === "combinado" && j.pensada &&
        (h.sistema === "clasico" || h.sistema === "moderno")) j.sistema = h.sistema;
    return j;
  });

  const p = {
    version: VERSION,
    id: o.id || null,
    titulo: o.titulo || "",
    fecha: o.fecha || null,
    autor: o.autor || "",
    notas: o.notas || "",
    etiquetas: (o.etiquetas || []).slice(),
    modo: modo,
    jugadores: jugadores,
    manos: manos,
    salidor: o.salidor !== undefined && o.salidor !== null ? letra(o.salidor)
           : (jugadas.length ? jugadas[0].jugador : "S"),
    jugadas: jugadas,
  };
  // escueto: solo si no es el de por defecto, para que una partida que no lo
  // usa quede igual que antes y las viejas vuelvan sin campos nuevos
  if (SALIDAS_OK.includes(o.convenio) && o.convenio !== _CONV_DEF) p.convenio = o.convenio;
  if (o.clasificacion) p.clasificacion = o.clasificacion;
  if (o.resultado) p.resultado = o.resultado;
  if (o.marcador) p.marcador = o.marcador;
  return p;
}

/* ---------- navegar la partida ---------- */

/* posicionEn(partida, n) -> el estado de la mesa tras las n primeras jugadas.
   n = 0 es el reparto, n = jugadas.length la posicion final. Puro. */
function posicionEn(partida, n) {
  const total = (partida.jugadas || []).length;
  const corte = Math.max(0, Math.min(n === undefined ? total : n, total));
  const hechas = partida.jugadas.slice(0, corte);

  const jug = hechas.map(j => j.pase
    ? { jugador: asiento(j.jugador), paso: true }
    : { jugador: asiento(j.jugador), ficha: j.ficha, punta: j.lado || undefined });
  const mesa = _reconstruir(jug);

  // la marca viaja con la jugada; reconstruirMesa no la inventa
  let i = 0;
  mesa.secuencia.forEach(sq => {
    while (i < hechas.length && hechas[i].pase) i++;
    if (i < hechas.length) {
      sq.pensada = hechas[i].pensada || null;
      sq.sistema = hechas[i].sistema || null;
      sq.clasificacion = hechas[i].clasificacion || null;
      sq.veredicto = hechas[i].veredicto || null;
      i++;
    }
  });

  // manos restantes (null las que no se conocen)
  const manos = {};
  ASIENTOS.forEach((L, p) => {
    if (partida.manos[L] === null || partida.manos[L] === undefined) { manos[L] = null; return; }
    const quedan = partida.manos[L].map(norm);
    hechas.filter(j => !j.pase && asiento(j.jugador) === p).forEach(j => {
      const k = quedan.indexOf(norm(j.ficha));
      if (k >= 0) quedan.splice(k, 1);
    });
    manos[L] = quedan;
  });

  // la config completa de cada asiento: {sistema, inicial, salida}
  const sistemas = {};
  ASIENTOS.forEach((L, p) => { sistemas[p] = _config((partida.jugadores || {})[L]); });
  const conv = convenioDe(partida);

  const hist = hechas.map(j => j.pase
    ? { jugador: asiento(j.jugador), paso: true, pensada: null, veredicto: j.veredicto || null, comentario: j.comentario || null }
    : { jugador: asiento(j.jugador), ficha: norm(j.ficha), punta: j.lado || null,
        pensada: j.pensada || null, sistema: j.sistema || null,
        clasificacion: j.clasificacion || null,
        veredicto: j.veredicto || null, comentario: j.comentario || null });

  const ultimo = hechas.length ? asiento(hechas[hechas.length - 1].jugador) : null;
  const current = ultimo === null ? asiento(partida.salidor) : (ultimo + 1) % 4;
  let passes = 0;
  for (let k = hechas.length - 1; k >= 0 && hechas[k].pase; k--) passes++;

  return {
    n: corte, total: total, modo: partida.modo,
    manos: manos, hist: hist, ends: mesa.ends,
    secuencia: mesa.secuencia, pases: mesa.pases,
    current: current, passes: passes, salidor: asiento(partida.salidor),
    sistemas: sistemas, convenio: conv.convenio, convenioHeredado: conv.heredado,
    convenioDe: conv.de, over: false,
    siguiente: corte < total ? partida.jugadas[corte] : null,
  };
}

/* estadoPara(partida, n, jugador) -> la entrada de sugerirJugada para ese
   jugador en esa posicion, SOLO con lo que el sabe: su mano, la mesa, la
   secuencia con sus marcas, los pases, quien salio y con que, y los sistemas.
   Nunca incluye manos ajenas. Devuelve null si su mano no se conoce. */
function estadoPara(partida, n, jugador) {
  const p = typeof jugador === "number" ? jugador : asiento(jugador);
  if (p === undefined || p === null) return null;
  const pos = posicionEn(partida, n);
  const miMano = pos.manos[letra(p)];
  if (miMano === null || miMano === undefined) return null;

  const primera = (partida.jugadas || []).find(j => !j.pase) || null;
  return {
    yo: p,
    miMano: miMano.slice(),
    ends: pos.ends,
    secuencia: pos.secuencia,
    pases: pos.pases,
    salidor: asiento(partida.salidor),
    salida: primera ? { ficha: norm(primera.ficha), jugador: asiento(primera.jugador),
                        pensada: primera.pensada || null } : null,
    sistemas: pos.sistemas,
    convenio: pos.convenio,
    pasesSeguidos: pos.passes,
  };
}

/* truncar(partida, n, extra) -> copia con las n primeras jugadas y la marca
   variante_de, para "probar desde aqui" sin tocar el original. */
function truncar(partida, n, extra) {
  const c = JSON.parse(JSON.stringify(partida));
  const total = c.jugadas.length;
  const corte = Math.max(0, Math.min(n === undefined ? total : n, total));
  c.jugadas = c.jugadas.slice(0, corte).map((j, i) => { j.n = i + 1; return j; });
  c.variante_de = { id: partida.id || null, n: corte };
  c.titulo = (partida.titulo || "(sin titulo)") + " — variante desde la jugada " + corte;
  delete c.resultado; delete c.marcador;
  return Object.assign(c, extra || {});
}

/* ---------- de partida a estado cargable ---------- */

/* Estado completo (ultima jugada). Lanza si la secuencia no es legal. */
function aEstado(partida) {
  const v = validar(partida);
  if (!v.ok) { const e = new Error(v.errores[0].texto); e.errores = v.errores; throw e; }
  return posicionEn(partida, (partida.jugadas || []).length);
}

/* ---------- validacion ---------- */

function validar(partida) {
  const errores = [];
  const err = (texto, linea) => errores.push({ texto: texto, linea: linea === undefined ? null : linea });

  if (!partida || typeof partida !== "object") { err("no es una partida"); return { ok: false, errores: errores }; }
  if (partida.version !== VERSION) err("version desconocida: " + partida.version);
  if (!partida.manos) err("faltan las manos");
  if (!Array.isArray(partida.jugadas)) { err("faltan las jugadas"); return { ok: false, errores: errores }; }
  if (!ASIENTOS.includes(partida.salidor)) err("salidor invalido: " + partida.salidor);
  if (partida.convenio !== undefined && partida.convenio !== null && !SALIDAS_OK.includes(partida.convenio))
    err("convenio de salida desconocido: " + partida.convenio, partida._lineaConvenio);

  // configuracion de cada jugador: un valor que no entendemos es un error,
  // no un silencioso "ninguno"
  ASIENTOS.forEach(L => {
    const j = (partida.jugadores || {})[L];
    if (!j) return;
    if (j.sistema !== undefined && j.sistema !== null && !SISTEMAS_OK.includes(j.sistema))
      err("sistema desconocido de " + L + ": " + j.sistema, partida._lineaSistemas);
    if (j.salida !== undefined && j.salida !== null && !SALIDAS_OK.includes(j.salida))
      err("convencion de salida desconocida de " + L + ": " + j.salida, partida._lineaSalida);
    const ini = j.combinado && j.combinado.inicial;
    if (ini !== undefined && ini !== null && ini !== "clasico" && ini !== "moderno")
      err("sistema inicial desconocido de " + L + ": " + ini, partida._lineaSistemas);
  });

  // manos: 7 por mano y 28 distintas cuando estan las cuatro
  const completas = ASIENTOS.every(L => Array.isArray((partida.manos || {})[L]));
  if (completas) {
    const todas = [];
    ASIENTOS.forEach(L => {
      const m = partida.manos[L].map(norm);
      if (m.some(x => x === null)) err("ficha invalida en la mano de " + L, partida._lineaManos);
      if (m.length !== 7) err("la mano de " + L + " tiene " + m.length + " fichas, deberian ser 7", partida._lineaManos);
      todas.push.apply(todas, m);
    });
    const vistas = new Set();
    todas.forEach(f => {
      if (f === null) return;
      if (vistas.has(f)) err("ficha repetida en el reparto: " + f, partida._lineaManos);
      vistas.add(f);
    });
    if (todas.length === 28 && vistas.size !== 28) { /* ya reportado arriba */ }
    else if (todas.length !== 28) err("el reparto tiene " + todas.length + " fichas, deberian ser 28", partida._lineaManos);
  }

  // la primera jugada (o pase) tiene que ser del salidor
  if (partida.jugadas.length && partida.jugadas[0].jugador !== partida.salidor)
    err("la partida no empieza por el salidor (" + partida.salidor + ")", partida.jugadas[0]._linea);

  // cada jugada, de quien dice tenerla
  if (completas) {
    const pendientes = {};
    ASIENTOS.forEach(L => { pendientes[L] = (partida.manos[L] || []).map(norm); });
    partida.jugadas.forEach(j => {
      if (j.pase) return;
      const f = norm(j.ficha);
      if (f === null) { err("ficha invalida: " + j.ficha, j._linea); return; }
      const lista = pendientes[j.jugador] || [];
      const k = lista.indexOf(f);
      if (k < 0) err(j.jugador + " juega " + f + ", que no esta en su mano", j._linea);
      else lista.splice(k, 1);
    });
  }

  // la secuencia tiene que ser legal sobre la mesa
  try {
    const jug = partida.jugadas.map(j => j.pase
      ? { jugador: asiento(j.jugador), paso: true }
      : { jugador: asiento(j.jugador), ficha: j.ficha, punta: j.lado || undefined });
    _reconstruir(jug);
  } catch (e) {
    const m = /jugada (\d+)/.exec(e.message);
    const idx = m ? +m[1] : null;
    const j = idx !== null ? partida.jugadas[idx] : null;
    err("jugada ilegal: " + e.message.replace(/^jugada \d+: /, ""), j ? j._linea : null);
  }

  return { ok: errores.length === 0, errores: errores };
}

/* ---------- texto legible ---------- */

function aTexto(partida) {
  const L = [];
  // sin titulo no se escribe la linea: asi la ida y vuelta es exacta
  if (partida.titulo) L.push("# Partida: " + partida.titulo);

  const meta = [];
  if (partida.fecha) meta.push("Fecha: " + partida.fecha);
  if (partida.autor) meta.push("Autor: " + partida.autor);
  meta.push("Modo: " + (partida.modo || "simulador"));
  if (partida.id) meta.push("Id: " + partida.id);
  L.push(meta.join(" · "));

  if (partida.etiquetas && partida.etiquetas.length) L.push("Etiquetas: " + partida.etiquetas.join(", "));
  if (partida.clasificacion) L.push("Clasificacion: " + _clasTexto(partida.clasificacion));

  const nombres = ASIENTOS.filter(a => (partida.jugadores[a] || {}).nombre);
  if (nombres.length) L.push("Jugadores: " + ASIENTOS.map(a =>
    a + " " + ((partida.jugadores[a] || {}).nombre || "-")).join(" · "));

  /* "Sistemas: S combinado desde moderno · E clasico · ..."
     El "desde" solo aparece si hace falta, para no ensuciar las partidas que
     no usan el combinado. */
  L.push("Sistemas: " + ASIENTOS.map(a => {
    const c = _config(partida.jugadores[a]);
    return a + " " + c.sistema +
      ((c.sistema === "combinado" || c.inicial !== "moderno") ? " desde " + c.inicial : "");
  }).join(" · "));

  // Un convenio para toda la mesa, y solo si no es el de por defecto.
  if (SALIDAS_OK.includes(partida.convenio) && partida.convenio !== _CONV_DEF)
    L.push("Convenio: " + partida.convenio);
  // la linea vieja (una por jugador) se reescribe tal cual si la partida la trae
  if (ASIENTOS.some(a => SALIDAS_OK.includes((partida.jugadores[a] || {}).salida)))
    L.push("Salida: " + ASIENTOS.map(a =>
      a + " " + ((partida.jugadores[a] || {}).salida || "-")).join(" · "));

  L.push("Manos: " + ASIENTOS.map(a => {
    const m = partida.manos[a];
    return a + " " + (m === null || m === undefined ? "?" : m.join(" "));
  }).join(" · "));

  L.push("Sale: " + partida.salidor);

  partida.jugadas.forEach(j => {
    if (j.pase) { L.push(j.n + ". " + j.jugador + " pasa"); return; }
    let s = j.n + ". " + j.jugador + " " + j.ficha;
    if (j.lado) s += " " + j.lado;
    if (j.pensada) s += " " + j.pensada + (SUFIJO[j.sistema] || "");
    if (j.veredicto) s += " " + VEREDICTOS[j.veredicto];
    if (j.comentario) s += ' "' + j.comentario.replace(/"/g, "'") + '"';
    L.push(s);
    // la clasificacion de una jugada va en su propia linea, con + delante:
    // meterla en la misma la dejaria ilegible
    if (j.clasificacion) L.push("   + " + _clasTexto(j.clasificacion));
  });

  if (partida.variante_de) L.push("Variante de: " + (partida.variante_de.id || "?") + " en la jugada " + partida.variante_de.n);
  if (partida.resultado) {
    const r = partida.resultado;
    L.push("Resultado: " + (r.tranca ? "tranca, " : "") +
      (r.ganador ? "gana " + (r.ganador === "SN" ? "S-N" : "E-O") + " por " + r.puntos : "empate"));
  }
  if (partida.marcador) L.push("Marcador: SN " + partida.marcador.SN + " · EO " + partida.marcador.EO);
  if (partida.notas) L.push("Notas: " + partida.notas);
  return L.join("\n");
}

/* Parser tolerante: espacios, mayusculas/minusculas, lineas vacias, campos
   ausentes y separadores · o |. Los errores llevan numero de linea. */
function desdeTexto(texto) {
  const errores = [];
  const bruto = String(texto || "").split(/\r?\n/);
  const p = {
    version: VERSION, id: null, titulo: "", fecha: null, autor: "", notas: "",
    etiquetas: [], modo: "simulador",
    jugadores: { S: { nombre: null, sistema: "ninguno" }, E: { nombre: null, sistema: "ninguno" },
                 N: { nombre: null, sistema: "ninguno" }, O: { nombre: null, sistema: "ninguno" } },
    manos: { S: null, E: null, N: null, O: null },
    salidor: "S", jugadas: [],
  };
  const trozos = s => s.split(/\s*[·|]\s*/).filter(x => x.trim());

  bruto.forEach((cruda, idx) => {
    const nLinea = idx + 1;
    const linea = cruda.trim();
    if (!linea) return;

    let m;
    if ((m = /^#\s*partida\s*:?\s*(.*)$/i.exec(linea))) { p.titulo = m[1].trim(); return; }
    if (/^clasificacion\s*:/i.test(linea)) {
      const c = _clasDesde(linea.replace(/^clasificacion\s*:/i, ""));
      if (c) p.clasificacion = c;
      return;
    }
    // "   + momento medio ..." clasifica la ultima jugada leida
    if (/^\+\s*/.test(linea)) {
      const c = _clasDesde(linea.replace(/^\+\s*/, ""));
      const ult = p.jugadas[p.jugadas.length - 1];
      if (c && ult) ult.clasificacion = c;
      else if (c) p.clasificacion = c;
      return;
    }
    if (/^etiquetas\s*:/i.test(linea)) {
      p.etiquetas = linea.replace(/^etiquetas\s*:/i, "").split(/[,;]/).map(x => x.trim()).filter(Boolean); return;
    }
    if (/^sistemas\s*:/i.test(linea)) {
      p._lineaSistemas = nLinea;
      trozos(linea.replace(/^sistemas\s*:/i, "")).forEach(t => {
        const q = t.trim().split(/\s+/);
        const a = String(q[0] || "").toUpperCase();
        if (!p.jugadores[a]) return;
        const sis = (q[1] || "ninguno").toLowerCase();
        if (!SISTEMAS_OK.includes(sis))
          errores.push({ texto: 'no entiendo el sistema "' + q[1] + '" de ' + a, linea: nLinea });
        p.jugadores[a].sistema = sis;
        const k = q.findIndex(x => /^desde$/i.test(x));
        if (k > 0 && q[k + 1]) {
          const ini = q[k + 1].toLowerCase();
          if (ini !== "clasico" && ini !== "moderno")
            errores.push({ texto: 'no entiendo el sistema inicial "' + q[k + 1] + '" de ' + a, linea: nLinea });
          p.jugadores[a].combinado = { inicial: ini };
        }
      }); return;
    }
    if (/^convenio\s*:/i.test(linea)) {
      p._lineaConvenio = nLinea;
      const v = linea.replace(/^convenio\s*:/i, "").trim().toLowerCase();
      if (!SALIDAS_OK.includes(v))
        errores.push({ texto: 'no entiendo el convenio de salida "' + v + '"', linea: nLinea });
      p.convenio = v;
      return;
    }
    if (/^salida\s*:/i.test(linea)) {
      p._lineaSalida = nLinea;
      trozos(linea.replace(/^salida\s*:/i, "")).forEach(t => {
        const q = t.trim().split(/\s+/);
        const a = String(q[0] || "").toUpperCase();
        if (!p.jugadores[a] || !q[1] || q[1] === "-") return;
        const sal = q[1].toLowerCase();
        if (!SALIDAS_OK.includes(sal))
          errores.push({ texto: 'no entiendo la convencion de salida "' + q[1] + '" de ' + a, linea: nLinea });
        p.jugadores[a].salida = sal;
      }); return;
    }
    if (/^jugadores\s*:/i.test(linea)) {
      trozos(linea.replace(/^jugadores\s*:/i, "")).forEach(t => {
        const q = t.trim().split(/\s+/);
        const a = String(q[0] || "").toUpperCase();
        const nom = q.slice(1).join(" ").trim();
        if (p.jugadores[a]) p.jugadores[a].nombre = (nom && nom !== "-") ? nom : null;
      }); return;
    }
    if (/^manos\s*:/i.test(linea)) {
      p._lineaManos = nLinea;
      trozos(linea.replace(/^manos\s*:/i, "")).forEach(t => {
        const q = t.trim().split(/\s+/);
        const a = String(q[0] || "").toUpperCase();
        if (!p.jugadores[a]) return;
        const resto = q.slice(1);
        p.manos[a] = (resto.length === 1 && resto[0] === "?") ? null : resto.map(x => norm(x) || x);
      }); return;
    }
    if ((m = /^sale\s*:?\s*([SENO])\b/i.exec(linea))) { p.salidor = m[1].toUpperCase(); return; }
    if (/^notas\s*:/i.test(linea)) { p.notas = linea.replace(/^notas\s*:/i, "").trim(); return; }
    if ((m = /^marcador\s*:/i.exec(linea))) {
      const sn = /sn\s+(-?\d+)/i.exec(linea), eo = /eo\s+(-?\d+)/i.exec(linea);
      if (sn && eo) p.marcador = { SN: +sn[1], EO: +eo[1] };
      return;
    }
    if ((m = /^variante\s+de\s*:\s*(\S+)\s+en\s+la\s+jugada\s+(\d+)/i.exec(linea))) {
      p.variante_de = { id: m[1] === "?" ? null : m[1], n: +m[2] }; return;
    }
    if (/^resultado\s*:/i.test(linea)) {
      const r = { ganador: null, puntos: 0, tranca: /tranca/i.test(linea) };
      const g = /gana\s+([SENO])\s*-\s*([SENO])/i.exec(linea);
      if (g) r.ganador = (g[1] + g[2]).toUpperCase() === "SN" ? "SN" : "EO";
      const pt = /por\s+(-?\d+)/i.exec(linea);
      if (pt) r.puntos = +pt[1];
      p.resultado = r;
      return;
    }
    // cabecera con fecha / autor / modo / id
    if (/(^|·|\|)\s*(fecha|autor|modo|id)\s*:/i.test(linea)) {
      trozos(linea).forEach(t => {
        const q = /^\s*(fecha|autor|modo|id)\s*:\s*(.*)$/i.exec(t);
        if (!q) return;
        const clave = q[1].toLowerCase(), val = q[2].trim();
        if (clave === "fecha") p.fecha = val || null;
        else if (clave === "autor") p.autor = val;
        else if (clave === "modo") p.modo = val.toLowerCase();
        else p.id = val || null;
      });
      return;
    }
    // jugada: "12. E 5-3 D CPP ? "texto""
    if ((m = /^(\d+)\s*[.)]?\s+([SENO])\s+(.*)$/i.exec(linea))) {
      const n = +m[1], jugador = m[2].toUpperCase();
      let resto = m[3].trim();
      if (/^(pasa|paso|pase|se\s+pasa)\b/i.test(resto)) {
        p.jugadas.push({ n: n, jugador: jugador, pase: true, _linea: nLinea });
        return;
      }
      let comentario = "";
      resto = resto.replace(/"([^"]*)"|“([^”]*)”/, (todo, a, b) => { comentario = (a !== undefined ? a : b); return " "; });
      const tok = resto.split(/\s+/).filter(Boolean);
      const f = norm(tok.shift());
      if (f === null) { errores.push({ texto: "no entiendo la ficha de la jugada " + n, linea: nLinea }); return; }
      const j = { n: n, jugador: jugador, ficha: f, lado: null, pensada: null, veredicto: null,
                  comentario: comentario, _linea: nLinea };
      tok.forEach(x => {
        const u = x.toUpperCase();
        if (u === "I" || u === "D") j.lado = u;
        else if (/^(CPP|SPP)(\/[CM])?$/.test(u)) {
          j.pensada = u.slice(0, 3);
          if (u.length > 3) j.sistema = POR_SUFIJO[u[4]];
        }
        else if (POR_SIMBOLO[x]) j.veredicto = POR_SIMBOLO[x];
        else if (/^(correcta|dudosa|error)$/i.test(x)) j.veredicto = x.toLowerCase();
        else errores.push({ texto: 'no entiendo "' + x + '" en la jugada ' + n, linea: nLinea });
      });
      p.jugadas.push(j);
      return;
    }
    errores.push({ texto: "no entiendo esta linea", linea: nLinea });
  });

  // renumera por si el texto venia con numeros saltados
  p.jugadas.forEach((j, i) => { j.n = i + 1; });
  /* La config queda escueta igual que al escribirla: si el texto repite un
     valor por defecto no lo dejamos puesto, para que la ida y vuelta sea
     exacta y una partida sin estos campos vuelva sin ellos. */
  ASIENTOS.forEach(L => { p.jugadores[L] = jugadorMinimo(p.jugadores[L].nombre, p.jugadores[L]); });
  if (errores.length) p._errores = errores;
  return p;
}

/* Deja la partida en forma canonica: toda ficha como "a-b" con a<=b. El texto
   se escribe siempre asi, de modo que la ida y vuelta es exacta para partidas
   ya canonicas; normalizar() sirve para las que vengan a mano. */
function normalizar(partida) {
  const c = JSON.parse(JSON.stringify(partida));
  ASIENTOS.forEach(L => { if (Array.isArray(c.manos[L])) c.manos[L] = c.manos[L].map(f => norm(f) || f); });
  (c.jugadas || []).forEach(j => { if (!j.pase) j.ficha = norm(j.ficha) || j.ficha; });
  return c;
}

// quita los campos auxiliares del parser, para comparar ida y vuelta
function limpiar(partida) {
  const c = JSON.parse(JSON.stringify(partida));
  delete c._errores; delete c._lineaManos; delete c._lineaSistemas;
  delete c._lineaSalida; delete c._lineaConvenio;
  (c.jugadas || []).forEach(j => { delete j._linea; });
  return c;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { desdeEstado, aEstado, posicionEn, estadoPara, truncar,
                     validar, aTexto, desdeTexto, limpiar, normalizar, convenioDe,
                     ASIENTOS, SEAT, VERSION };
}
