"use strict";
/* ================= NUBE: acceso a "lo compartido" =================
   Adaptador con interfaz FIJA. Hoy la partida viaja dentro del enlace, sin
   servidor. Manana vivira en el backend de dominopro (FastAPI, con usuarios)
   y solo cambiara la implementacion de estos mismos metodos; la app no se
   entera.

   Regla de producto: LEER nunca pide registro. ESCRIBIR si, cuando exista el
   servidor (publicar y comentar).

   Codificacion del enlace:
     JSON v1 (partida.js) -> texto JSON -> deflate-raw si el entorno puede
     -> base64url, con prefijo de version para poder cambiar el esquema sin
     romper enlaces viejos:
       "1z" = version 1, comprimido
       "1p" = version 1, plano
   Va en el FRAGMENTO (#p=...): el fragmento no se manda al servidor, asi que
   ni Netlify ni ningun proxy ve la partida, y funciona en un sitio estatico. */

var _nubeNode = (typeof window === "undefined" && typeof require !== "undefined");
var _zlib = _nubeNode ? require("zlib") : null;
var _part = _nubeNode ? require("./partida.js") : null;
var _validar = _part ? _part.validar : (typeof validar !== "undefined" ? validar : null);

const LIMITE_URL = 8000;          // caracteres de URL que damos por seguros
const PREFIJO_COMPRIMIDO = "1z";
const PREFIJO_PLANO = "1p";

/* ---------- base64url ---------- */
function aBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = (typeof btoa !== "undefined") ? btoa(bin) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deBase64Url(txt) {
  const b64 = String(txt).replace(/-/g, "+").replace(/_/g, "/");
  const relleno = b64 + "===".slice((b64.length + 3) % 4);
  if (typeof atob !== "undefined") {
    const bin = atob(relleno);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(relleno, "base64"));
}

/* ---------- comprimir / descomprimir ---------- */
function _bytesDeTexto(txt) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(txt);
  return new Uint8Array(Buffer.from(txt, "utf8"));
}
function _textoDeBytes(bytes) {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
  return Buffer.from(bytes).toString("utf8");
}
async function _deflate(bytes) {
  if (_zlib) return new Uint8Array(_zlib.deflateRawSync(Buffer.from(bytes)));
  if (typeof CompressionStream === "undefined") return null;
  const cs = new CompressionStream("deflate-raw");
  // el writer tiene sus propias promesas: sin catch, un fallo escapa como
  // rechazo no capturado aunque el Response si este dentro del try
  const w = cs.writable.getWriter();
  w.write(bytes).catch(() => {}); w.close().catch(() => {});
  const buf = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(buf);
}
async function _inflate(bytes) {
  if (_zlib) return new Uint8Array(_zlib.inflateRawSync(Buffer.from(bytes)));
  if (typeof DecompressionStream === "undefined") throw new Error("este navegador no puede descomprimir el enlace");
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter();
  w.write(bytes).catch(() => {}); w.close().catch(() => {});
  const buf = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(buf);
}

/* ---------- carga util del enlace ---------- */
async function codificar(partida) {
  const json = JSON.stringify(partida);
  const crudo = _bytesDeTexto(json);
  let comprimido = null;
  try { comprimido = await _deflate(crudo); } catch (e) { comprimido = null; }
  if (comprimido && comprimido.length < crudo.length) return PREFIJO_COMPRIMIDO + aBase64Url(comprimido);
  return PREFIJO_PLANO + aBase64Url(crudo);
}
async function decodificar(carga) {
  const txt = String(carga || "").trim();
  if (txt.length < 3) throw new Error("el enlace está vacío o incompleto");
  const version = txt.slice(0, 2);
  const cuerpo = txt.slice(2);
  if (version !== PREFIJO_COMPRIMIDO && version !== PREFIJO_PLANO)
    throw new Error('no reconozco la versión del enlace ("' + version + '"): puede ser de una versión más nueva');
  if (!/^[A-Za-z0-9\-_]*$/.test(cuerpo)) throw new Error("el enlace tiene caracteres que no esperaba: puede haberse cortado al copiarlo");
  let bytes;
  try { bytes = deBase64Url(cuerpo); } catch (e) { throw new Error("el enlace está dañado (no pude descodificarlo)"); }
  let json;
  try {
    json = _textoDeBytes(version === PREFIJO_COMPRIMIDO ? await _inflate(bytes) : bytes);
  } catch (e) {
    // el mensaje interno del descompresor no le dice nada a nadie
    throw new Error("el enlace está dañado o incompleto: parece cortado");
  }
  let p;
  try { p = JSON.parse(json); } catch (e) { throw new Error("el contenido del enlace no es una partida legible"); }
  return p;
}

/* ---------- interfaz del adaptador ---------- */

function capacidades() {
  return { publicar: true, comentar: false, backend: "enlace" };
}

function _base() {
  try {
    if (typeof window !== "undefined" && window.location)
      return window.location.origin + window.location.pathname;
  } catch (e) {}
  return "";
}

/* publicar(partida, opciones) -> {ok, backend, url, carga, tamano, limite, ...}
   opciones.sinComentarios quita los comentarios de jugada, que es lo que mas
   ocupa. No lanza por tamano: devuelve ok:false y el motivo, para que la UI
   decida. El futuro backend devolvera {ok, backend:'dominopro', id, url}. */
async function publicar(partida, opciones) {
  const o = opciones || {};
  const p = JSON.parse(JSON.stringify(partida));
  if (o.sinComentarios) (p.jugadas || []).forEach(j => { j.comentario = ""; });
  // el id NO cambia al publicar: es lo que evitara duplicados en el servidor
  p.publicado = { backend: "enlace", id: p.id || null, fecha: o.fecha || null };

  const carga = await codificar(p);
  const url = _base() + "#p=" + carga;
  const res = { backend: "enlace", carga: carga, url: url,
                tamano: url.length, limite: LIMITE_URL, partida: p };
  if (url.length > LIMITE_URL) {
    res.ok = false;
    res.motivo = "demasiado largo";
    return res;
  }
  res.ok = true;
  return res;
}

/* abrir(ref) -> partida. ref = URL completa, "#p=..." o la carga suelta.
   Leer nunca pide registro. */
async function abrir(ref) {
  let carga = String(ref || "").trim();
  const i = carga.indexOf("#");
  if (i >= 0) carga = carga.slice(i + 1);
  const m = /(?:^|&)p=([^&]*)/.exec(carga);
  if (m) carga = m[1];
  if (!carga) throw new Error("el enlace no lleva ninguna partida");
  const p = await decodificar(decodeURIComponent(carga));
  if (_validar) {
    const v = _validar(p);
    if (!v.ok) { const e = new Error(v.errores[0].texto); e.errores = v.errores; throw e; }
  }
  return p;
}

// Comentar exige servidor: sin el, no hay donde guardarlo ni quien lo firme.
async function comentarios(ref) { return { ok: false, motivo: "requiere servidor" }; }
async function comentar(ref, texto) { return { ok: false, motivo: "requiere servidor" }; }

/* ---------- lo que vendra: backend dominopro ----------
   Misma interfaz, otra implementacion. Queda escrito para que migrar sea
   sustituir el objeto, no tocar la app:

     capacidades() -> {publicar:true, comentar:true, backend:'dominopro'}
     publicar(partida)   POST  /api/partidas   {partida}      -> {ok, backend:'dominopro', id, url}
                         (usa partida.id como clave: reenviar la misma partida
                          ACTUALIZA, no duplica; escribir exige sesion)
     abrir(ref)          GET   /api/partidas/{id}             -> partida
                         (lectura publica: nunca pide registro)
     comentarios(ref)    GET   /api/partidas/{id}/comentarios -> [{id, autor, fecha, texto, jugada?}]
     comentar(ref,texto) POST  /api/partidas/{id}/comentarios -> {ok, id}   (exige sesion)

   migrar(partidas): sube al servidor las partidas que hoy viven en
   localStorage, respetando el id de cada una para no duplicar, y devuelve
   {subidas, yaEstaban, fallidas}. Sin cuerpo mientras no exista el servidor. */
async function migrar(partidas) {
  return { ok: false, motivo: "requiere servidor", subidas: 0, yaEstaban: 0, fallidas: 0 };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { capacidades, publicar, abrir, comentarios, comentar, migrar,
                     codificar, decodificar, aBase64Url, deBase64Url, LIMITE_URL };
}
