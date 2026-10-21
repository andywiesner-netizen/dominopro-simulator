const P = require("../partida.js");
const C = require("../conocimiento.js");

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
// pos.sistemas ya no es la cadena suelta: lleva la config entera del jugador
// `salida` ya no es del jugador: queda en null salvo en partidas viejas
eq("sistemas por asiento", est.sistemas, {
  0: { sistema: "clasico", inicial: "moderno", salida: null },
  1: { sistema: "moderno", inicial: "moderno", salida: null },
  2: { sistema: "ninguno", inicial: "moderno", salida: null },
  3: { sistema: "ninguno", inicial: "moderno", salida: null } });
eq("y el convenio es de la mesa", est.convenio, "fuerza");
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

console.log("\n--- posicionEn en varias n ---");
const p0 = P.posicionEn(base, 0);
eq("n=0 es el reparto: mesa vacia", p0.ends, null);
eq("n=0: nadie ha jugado", p0.hist.length, 0);
eq("n=0: las cuatro manos con 7", ASI.map(L => p0.manos[L].length), [7, 7, 7, 7]);
eq("n=0: le toca al salidor", p0.current, 0);

const mitad = Math.floor(JUGADAS.length / 2);
const pm = P.posicionEn(base, mitad);
eq("n=mitad: " + mitad + " jugadas", pm.hist.length, mitad);
const jugadasHasta = JUGADAS.slice(0, mitad).filter(j => !j.pase).length;
eq("n=mitad: fichas en la mesa", pm.secuencia.length, jugadasHasta);
eq("n=mitad: quedan 28 - jugadas", ASI.reduce((a, L) => a + pm.manos[L].length, 0), 28 - jugadasHasta);
t("n=mitad: hay puntas", Array.isArray(pm.ends) && pm.ends.length === 2, JSON.stringify(pm.ends));

const pf = P.posicionEn(base, JUGADAS.length);
eq("n=final coincide con aEstado", P.limpiar(pf), P.limpiar(P.aEstado(base)));
eq("n mayor que el total se recorta", P.posicionEn(base, 99).n, JUGADAS.length);
eq("n negativa se recorta a 0", P.posicionEn(base, -3).n, 0);

console.log("\n--- estadoPara solo da informacion legitima ---");
const ePara = P.estadoPara(base, mitad, "S");
t("devuelve algo para S", !!ePara);
eq("yo = 0", ePara.yo, 0);
eq("su mano es la suya en esa posicion", ePara.miMano, pm.manos.S);
eq("solo las claves previstas", Object.keys(ePara).sort(),
  ["convenio", "ends", "miMano", "pases", "pasesSeguidos", "salida", "salidor", "secuencia", "sistemas", "yo"]);
const serializado = JSON.stringify(ePara);
const enMesa = base.jugadas.filter(j => !j.pase).slice(0, mitad).map(j => j.ficha);
const ajenasOcultas = ["E", "N", "O"].reduce((a, L) => a.concat(pm.manos[L]), [])
  .filter(f => enMesa.indexOf(f) < 0 && pm.manos.S.indexOf(f) < 0);
t("no se cuela ninguna ficha ajena (" + ajenasOcultas.length + " comprobadas)",
  ajenasOcultas.every(f => serializado.indexOf('"' + f + '"') < 0),
  "se colaron: " + ajenasOcultas.filter(f => serializado.indexOf('"' + f + '"') >= 0).join(" "));
t("la secuencia lleva las pensadas", ePara.secuencia.some(x => x.pensada),
  JSON.stringify(ePara.secuencia.map(x => x.pensada)));
eq("la salida con su marca", ePara.salida.ficha, base.jugadas[0].ficha);

const vivoP = P.desdeTexto([
  "# Partida: en vivo", "Modo: vivo",
  "Manos: S 6-6 6-1 5-5 " + "·" + " E ? " + "·" + " N ? " + "·" + " O ?",
  "Sale: S", "1. S 6-6",
].join("\n"));
t("en modo vivo, S si tiene estado", !!P.estadoPara(vivoP, 1, "S"));
eq("y E devuelve null (mano desconocida)", P.estadoPara(vivoP, 1, "E"), null);
eq("N tambien null", P.estadoPara(vivoP, 1, "N"), null);

console.log("\n--- probar desde aqui (truncar) ---");
const variante = P.truncar(base, mitad, { id: "p-variante-1" });
eq("se queda con las n primeras", variante.jugadas.length, mitad);
eq("renumeradas desde 1", variante.jugadas.map(j => j.n), Array.from({ length: mitad }, (_, i) => i + 1));
eq("apunta al original", variante.variante_de, { id: "p-demo-1", n: mitad });
t("el titulo lo dice", /variante desde la jugada /.test(variante.titulo), variante.titulo);
t("no arrastra el resultado", variante.resultado === undefined && variante.marcador === undefined);
t("sigue siendo valida", P.validar(variante).ok, JSON.stringify(P.validar(variante).errores));
t("el original no se toca", base.jugadas.length === JUGADAS.length && base.variante_de === undefined);
eq("variante_de sobrevive texto->objeto",
  P.limpiar(P.desdeTexto(P.aTexto(variante))).variante_de, variante.variante_de);

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



/* ================= configuracion por jugador (sistemas y salida) ================= */
console.log("\n--- configuracion nueva: ida y vuelta ---");

// se construye por el camino real: desdeEstado con la config de cada asiento
const CFG = {
  0: { sistema: "combinado", combinado: { inicial: "clasico" }, salida: "calidad" },
  1: { sistema: "moderno" },
  2: { sistema: "ninguno", salida: "calidad" },
  3: { sistema: "clasico" },
};
const estadoCfg = {
  hands: [new Set(["0-1"]), new Set(["2-2"]), new Set(["3-3"]), new Set(["4-4"])],
  hist: [
    { jugador: 0, ficha: "5-5", punta: null, pensada: "SPP", sistema: "clasico", veredicto: "correcta", comentario: "sale fuerte" },
    { jugador: 1, ficha: "5-3", punta: "D", pensada: "CPP", sistema: "moderno", veredicto: null, comentario: "" },
    { jugador: 2, paso: true },
    { jugador: 3, ficha: "5-1", punta: "I", pensada: "SPP", sistema: null, veredicto: null, comentario: "" },
  ],
};
const conCfg = P.desdeEstado(estadoCfg, { salidor: 0, sistemas: CFG, id: "p-cfg", titulo: "Con sistemas", modo: "simulador" });

eq("la config se guarda escueta (S lo lleva todo)", conCfg.jugadores.S,
  { nombre: null, sistema: "combinado", combinado: { inicial: "clasico" }, salida: "calidad" });
eq("un jugador por defecto no engorda", conCfg.jugadores.E, { nombre: null, sistema: "moderno" });
eq("salida calidad se guarda aunque el sistema sea ninguno", conCfg.jugadores.N,
  { nombre: null, sistema: "ninguno", salida: "calidad" });
eq("solo el combinado registra sistema en su jugada", conCfg.jugadas[0].sistema, "clasico");
t("el que no es combinado no lo registra", conCfg.jugadas[1].sistema === undefined,
  JSON.stringify(conCfg.jugadas[1]));

const textoCfg = P.aTexto(conCfg);
console.log(textoCfg);
t("la linea de Sistemas lleva el 'desde'", /Sistemas:.*S combinado desde clasico/.test(textoCfg), textoCfg);
t("hay linea de Salida", /^Salida: S calidad/m.test(textoCfg), textoCfg);
t("la jugada del combinado lleva el sufijo /C", /^1\. S 5-5 SPP\/C/m.test(textoCfg), textoCfg);
t("la del no combinado no lo lleva", /^2\. E 3-5 D CPP$/m.test(textoCfg), textoCfg);
eq("ida y vuelta exacta con la config nueva", P.limpiar(P.desdeTexto(textoCfg)), P.limpiar(conCfg));

// el sufijo /M tambien
const conM = JSON.parse(JSON.stringify(conCfg));
conM.jugadas[0].sistema = "moderno";
t("sufijo /M", /^1\. S 5-5 SPP\/M/m.test(P.aTexto(conM)), P.aTexto(conM));
eq("ida y vuelta con /M", P.limpiar(P.desdeTexto(P.aTexto(conM))), P.limpiar(conM));

console.log("\n--- una partida vieja abre con los valores por defecto ---");
const vieja = P.desdeTexto([
  "# Partida: de antes",
  "Sistemas: S clasico · E moderno · N ninguno · O ninguno",
  "Manos: S 6-6 · E 6-5 · N 5-5 · O 4-4",
  "Sale: S",
  "1. S 6-6 CPP",
].join("\n"));
eq("no se le inventan campos", vieja.jugadores.S, { nombre: null, sistema: "clasico" });
eq("configJugador le pone los defectos", C.configJugador(vieja.jugadores.S),
  { sistema: "clasico", inicial: "moderno", salida: null });
const posVieja = P.posicionEn(vieja, 1);
eq("posicionEn da la config completa", posVieja.sistemas[0],
  { sistema: "clasico", inicial: "moderno", salida: null });
const textoViejo = P.aTexto(vieja);
t("al volver a texto no aparece la linea de Salida", !/^Salida:/m.test(textoViejo), textoViejo);
t("ni el 'desde' en los sistemas", !/desde/.test(textoViejo), textoViejo);
t("ni sufijos de sistema en las jugadas", !/(CPP|SPP)\//.test(textoViejo), textoViejo);

console.log("\n--- un valor que no entendemos es un error, no un silencio ---");
const malCfg = P.desdeTexto([
  "# Partida: rara", "Sistemas: S inventado · E moderno · N ninguno · O ninguno",
  "Salida: S loquesea · E fuerza · N fuerza · O fuerza",
  "Manos: S ? · E ? · N ? · O ?", "Sale: S",
].join("\n"));
// al pegar texto lo caza el parser
t("el parser avisa del sistema desconocido",
  (malCfg._errores || []).some(e => /no entiendo el sistema "inventado"/.test(e.texto)),
  JSON.stringify(malCfg._errores));
t("y de la convencion desconocida",
  (malCfg._errores || []).some(e => /convencion de salida "loquesea"/.test(e.texto)),
  JSON.stringify(malCfg._errores));
// y si llega por JSON (un enlace trucado, un fichero a mano), lo caza validar
const malJson = P.desdeTexto(["# Partida: rara2", "Manos: S ? · E ? · N ? · O ?", "Sale: S"].join("\n"));
malJson.jugadores.S = { nombre: null, sistema: "inventado", salida: "loquesea", combinado: { inicial: "raro" } };
const vMal = P.validar(malJson);
t("validar avisa del sistema desconocido", vMal.errores.some(e => /sistema desconocido/.test(e.texto)),
  JSON.stringify(vMal.errores));
t("validar avisa de la convencion desconocida", vMal.errores.some(e => /convencion de salida/.test(e.texto)),
  JSON.stringify(vMal.errores));
t("validar avisa del inicial desconocido", vMal.errores.some(e => /inicial desconocido/.test(e.texto)),
  JSON.stringify(vMal.errores));


/* ================= salida "ninguna" y partida sin titulo ================= */
/* El convenio de salida es de la MESA, no de cada jugador: la salida es una.
   Este bloque sustituye al que probaba la convencion por jugador. */
console.log("\n--- convenio de salida: uno para toda la mesa ---");
const MANOS_JUGUETE = { hands: [new Set(["0-1"]), new Set(["2-2"]), new Set(["3-3"]), new Set(["4-4"])],
  hist: [{ jugador: 0, ficha: "5-5", punta: null, pensada: null, veredicto: null, comentario: "" }] };
const conConvenio = (conv, extra) => P.desdeEstado(MANOS_JUGUETE,
  Object.assign({ salidor: 0, titulo: "Con convenio", id: "p-conv", convenio: conv,
    sistemas: { 0: "clasico", 1: "moderno", 2: "ninguno", 3: "ninguno" } }, extra || {}));

const porCalidad = conConvenio("calidad");
eq("el convenio va en la partida, no en los jugadores", porCalidad.convenio, "calidad");
t("ningun jugador lleva salida", ASI.every(a => porCalidad.jugadores[a].salida === undefined),
  JSON.stringify(porCalidad.jugadores));
const txtConv = P.aTexto(porCalidad);
t("una sola linea de Convenio", /^Convenio: calidad$/m.test(txtConv), txtConv);
t("y ninguna linea de Salida por jugador", !/^Salida:/m.test(txtConv), txtConv);
eq("ida y vuelta exacta", P.limpiar(P.desdeTexto(txtConv)), P.limpiar(porCalidad));
eq("convenioDe lo devuelve sin heredar", P.convenioDe(porCalidad), { convenio: "calidad", heredado: false, de: null });

// el de por defecto no se escribe, para que una partida normal quede igual que antes
const porDefecto = conConvenio("fuerza");
t("el convenio por defecto no engorda el texto", !/^Convenio:/m.test(P.aTexto(porDefecto)), P.aTexto(porDefecto));
eq("y al leerla sale igualmente 'fuerza'", P.convenioDe(porDefecto).convenio, "fuerza");
eq("sin convenio declarado, tambien 'fuerza'", P.convenioDe({ salidor: "S", jugadores: {} }).convenio, "fuerza");
eq("posicionEn lo trae puesto", P.posicionEn(porCalidad, 1).convenio, "calidad");
eq("estadoPara tambien", P.estadoPara(porCalidad, 0, "S").convenio, "calidad");
t("validar acepta el campo", P.validar(porCalidad).errores.every(e => !/convenio/.test(e.texto)),
  JSON.stringify(P.validar(porCalidad).errores));
const convMalo = P.desdeTexto(["# Partida: x", "Convenio: loquesea", "Manos: S ? \u00b7 E ? \u00b7 N ? \u00b7 O ?", "Sale: S"].join("\n"));
t("y se queja de uno que no entiende",
  (convMalo._errores || []).some(e => /convenio de salida/.test(e.texto)) ||
  P.validar(convMalo).errores.some(e => /convenio/.test(e.texto)), JSON.stringify(convMalo._errores));

console.log("\n--- una partida vieja hereda el convenio del salidor ---");
/* Asi se guardaban antes: la convencion dentro de cada jugador y sin campo de
   mesa. No se pierde: se hereda la del salidor y se avisa. */
const vieja2 = P.desdeTexto([
  "# Partida: de antes",
  "Sistemas: S clasico \u00b7 E moderno \u00b7 N ninguno \u00b7 O ninguno",
  "Salida: S calidad \u00b7 E fuerza \u00b7 N fuerza \u00b7 O fuerza",
  "Manos: S 6-6 \u00b7 E 6-5 \u00b7 N 5-5 \u00b7 O 4-4",
  "Sale: S",
  "1. S 6-6 CPP",
].join("\n"));
eq("sigue leyendo la salida por jugador", vieja2.jugadores.S.salida, "calidad");
eq("no se le inventa un campo de mesa", vieja2.convenio, undefined);
eq("hereda la del salidor", P.convenioDe(vieja2), { convenio: "calidad", heredado: true, de: "S" });
eq("y posicionEn lo marca como heredado", P.posicionEn(vieja2, 1).convenioHeredado, true);
eq("diciendo de quien", P.posicionEn(vieja2, 1).convenioDe, "S");
eq("la partida vieja vuelve entera, sin perder nada",
  P.limpiar(P.desdeTexto(P.aTexto(vieja2))), P.limpiar(vieja2));
// si el salidor no la llevaba pero otro si, tambien se rescata
const vieja3 = JSON.parse(JSON.stringify(vieja2));
delete vieja3.jugadores.S.salida;
vieja3.jugadores.E.salida = "ninguna";
eq("si el salidor no la llevaba, se toma la que haya",
  P.convenioDe(vieja3), { convenio: "ninguna", heredado: true, de: "E" });

console.log("\n--- partida sin titulo ---");
const anonima = P.desdeEstado(
  { hands: [new Set(["0-1"]), new Set(["2-2"]), new Set(["3-3"]), new Set(["4-4"])],
    hist: [{ jugador: 0, ficha: "5-5", punta: null, pensada: null, veredicto: null, comentario: "" }] },
  { salidor: 0, id: "p-anon", sistemas: { 0: "ninguno", 1: "ninguno", 2: "ninguno", 3: "ninguno" } });
eq("nace sin titulo", anonima.titulo, "");
const txtAnon = P.aTexto(anonima);
console.log(txtAnon.split("\n").map(l => "    " + l).join("\n"));
t("no se escribe la linea de titulo", !/^#/m.test(txtAnon), txtAnon);
t("ni aparece el (sin titulo) de antes", !/sin titulo/i.test(txtAnon), txtAnon);
eq("el titulo vuelve vacio", P.desdeTexto(txtAnon).titulo, "");
eq("ida y vuelta exacta sin titulo", P.limpiar(P.desdeTexto(txtAnon)), P.limpiar(anonima));

// y con titulo sigue saliendo la linea
const conTitulo = Object.assign(JSON.parse(JSON.stringify(anonima)), { titulo: "Con nombre" });
t("con titulo si se escribe", /^# Partida: Con nombre$/m.test(P.aTexto(conTitulo)), P.aTexto(conTitulo));
eq("y vuelve igual", P.limpiar(P.desdeTexto(P.aTexto(conTitulo))), P.limpiar(conTitulo));

console.log(fallos ? "\n" + fallos + " FALLOS" : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
