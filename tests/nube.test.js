const N = require("../nube.js");
const P = require("../partida.js");

let fallos = 0;
const t = (nombre, cond, extra) => {
  if (!cond) { fallos++; console.log("  FALLA  " + nombre + (extra ? "\n          " + extra : "")); }
  else console.log("  ok     " + nombre);
};
const eq = (nombre, a, b) => t(nombre, JSON.stringify(a) === JSON.stringify(b),
  "obtenido " + JSON.stringify(a) + "\n          esperado " + JSON.stringify(b));

const ASI = ["S", "E", "N", "O"];

/* ---- una partida legal, jugada de verdad ---- */
function repartir(semilla) {
  const todas = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) todas.push(a + "-" + b);
  const orden = [], quedan = todas.slice();
  let x = semilla;
  while (quedan.length) { x = (x * 31 + 17) % quedan.length; orden.push(quedan.splice(x, 1)[0]); }
  return { S: orden.slice(0, 7), E: orden.slice(7, 14), N: orden.slice(14, 21), O: orden.slice(21, 28) };
}
function jugar(manos, tope) {
  const quedan = {}; ASI.forEach(L => { quedan[L] = manos[L].slice(); });
  const jugadas = []; let ends = null, turno = 0, seguidos = 0;
  while (jugadas.length < tope && seguidos < 4) {
    const L = ASI[turno];
    let puesta = null;
    for (const f of quedan[L]) {
      const [a, b] = f.split("-").map(Number);
      if (ends === null) { puesta = { ficha: f, lado: null }; break; }
      if (a === ends[0] || b === ends[0]) { puesta = { ficha: f, lado: "I" }; break; }
      if (a === ends[1] || b === ends[1]) { puesta = { ficha: f, lado: "D" }; break; }
    }
    if (!puesta) { jugadas.push({ n: jugadas.length + 1, jugador: L, pase: true }); seguidos++; }
    else {
      seguidos = 0;
      quedan[L].splice(quedan[L].indexOf(puesta.ficha), 1);
      const [a, b] = puesta.ficha.split("-").map(Number);
      if (ends === null) ends = [a, b];
      else { const i = puesta.lado === "I" ? 0 : 1; ends[i] = (a === ends[i] ? b : a); }
      jugadas.push({ n: jugadas.length + 1, jugador: L, ficha: puesta.ficha, lado: puesta.lado,
                     pensada: null, veredicto: null, comentario: "" });
      if (!quedan[L].length) break;
    }
    turno = (turno + 1) % 4;
  }
  return jugadas;
}
function armar(manos, jugadas, extra) {
  return P.normalizar(Object.assign({
    version: 1, id: "p-enlace-1", titulo: "Llave del 6",
    fecha: "2026-09-12T14:32:10.000Z", autor: "Andy", notas: "Para el enlace.",
    etiquetas: ["llave"], modo: "simulador",
    jugadores: { S: { nombre: null, sistema: "clasico" }, E: { nombre: null, sistema: "moderno" },
                 N: { nombre: null, sistema: "ninguno" }, O: { nombre: null, sistema: "ninguno" } },
    manos: JSON.parse(JSON.stringify(manos)), salidor: "S",
    jugadas: JSON.parse(JSON.stringify(jugadas)),
  }, extra || {}));
}

/* ---- corta: 6 jugadas con marcas ---- */
const manosC = repartir(7);
const jugC = jugar(manosC, 6);
[["SPP", "correcta", "doble en cuarta"], ["CPP", "dudosa", "castiga sin fuerza"],
 ["SPP", null, ""], [null, "error", "aquí se pierde la mano"]].forEach((a, i) => {
  const j = jugC[i]; if (!j || j.pase) return;
  j.pensada = a[0]; j.veredicto = a[1]; j.comentario = a[2];
});
const corta = armar(manosC, jugC, { variante_de: { id: "p-madre", n: 3 } });

(async () => {
  console.log("\n--- ida y vuelta partida -> enlace -> partida ---");
  const r = await N.publicar(corta);
  t("publicar responde ok", r.ok, JSON.stringify({ ok: r.ok, motivo: r.motivo }));
  eq("backend actual", r.backend, "enlace");
  const vuelta = await N.abrir(r.url);
  eq("el objeto vuelve identico (salvo publicado)",
    P.limpiar(Object.assign({}, vuelta, { publicado: undefined })),
    P.limpiar(Object.assign({}, r.partida, { publicado: undefined })));
  eq("conserva pensadas", vuelta.jugadas.filter(j => j.pensada).length, corta.jugadas.filter(j => j.pensada).length);
  eq("conserva veredictos", vuelta.jugadas.filter(j => j.veredicto).length, corta.jugadas.filter(j => j.veredicto).length);
  eq("conserva comentarios", vuelta.jugadas.filter(j => j.comentario).length, corta.jugadas.filter(j => j.comentario).length);
  eq("conserva variante_de", vuelta.variante_de, corta.variante_de);
  eq("el id no cambia al publicar", vuelta.id, corta.id);
  eq("marca publicado", vuelta.publicado.backend, "enlace");
  eq("publicado usa el mismo id", vuelta.publicado.id, corta.id);

  console.log("\n--- prefijo de version ---");
  const carga = r.carga;
  t("empieza por 1z (comprimido)", carga.slice(0, 2) === "1z", carga.slice(0, 2));
  const plano = "1p" + N.aBase64Url(Buffer.from(JSON.stringify(corta), "utf8"));
  const desdePlano = await N.decodificar(plano);
  eq("un 1p plano se lee igual", P.limpiar(desdePlano), P.limpiar(corta));
  t("el plano ocupa mas que el comprimido", plano.length > carga.length,
    "plano " + plano.length + " vs comprimido " + carga.length);

  console.log("\n--- base64url apto para URL ---");
  t("solo A-Z a-z 0-9 - _", /^[A-Za-z0-9\-_]+$/.test(carga.slice(2)), carga.slice(2, 60));
  t("sin +, / ni =", !/[+/=]/.test(carga));
  eq("la url encodeada no cambia", encodeURI(r.url), r.url);

  console.log("\n--- enlaces malos: error claro, no excepcion suelta ---");
  const mal = async (nombre, ref, espera) => {
    try { await N.abrir(ref); t(nombre + " -> deberia fallar", false); }
    catch (e) { t(nombre + ': "' + e.message.slice(0, 58) + '"', espera.test(e.message), e.message); }
  };
  await mal("versión desconocida", "#p=9x" + carga.slice(2), /versi/i);
  await mal("cuerpo cortado", "#p=" + carga.slice(0, 30), /dañado|incompleto/i);
  await mal("caracteres raros", "#p=1z!!!!", /caracteres|dañado/i);
  await mal("fragmento vacío", "#p=", /no lleva/i);
  await mal("no es una partida", "#p=1p" + N.aBase64Url(Buffer.from("{}", "utf8")), /.+/);

  console.log("\n--- tamaños reales ---");
  console.log("  ENLACE DE LA PARTIDA CORTA (" + corta.jugadas.length + " jugadas, con comentarios):");
  console.log("  " + r.url);
  console.log("  tamaño: " + r.tamano + " caracteres (límite " + r.limite + ")");

  // larga: partida completa hasta agotar una mano, con comentario en cada jugada
  const manosL = repartir(13);
  const jugL = jugar(manosL, 28);
  jugL.forEach((j, i) => {
    if (j.pase) return;
    j.pensada = i % 2 ? "CPP" : "SPP";
    j.veredicto = ["correcta", "dudosa", "error", null][i % 4];
    j.comentario = "Comentario de análisis número " + (i + 1) + ": aquí se decide la mano.";
  });
  const larga = armar(manosL, jugL, { id: "p-larga-1", titulo: "Partida completa comentada" });
  t("la larga es válida", P.validar(larga).ok, JSON.stringify(P.validar(larga).errores));
  const rl = await N.publicar(larga);
  console.log("  PARTIDA LARGA: " + larga.jugadas.length + " jugadas, todas comentadas");
  console.log("  tamaño: " + rl.tamano + " caracteres · cabe: " + (rl.ok ? "sí" : "NO"));
  const sinCom = await N.publicar(larga, { sinComentarios: true });
  console.log("  la misma sin comentarios de jugada: " + sinCom.tamano + " caracteres · cabe: " + (sinCom.ok ? "sí" : "NO"));
  t("sin comentarios ocupa menos", sinCom.tamano < rl.tamano, sinCom.tamano + " vs " + rl.tamano);
  t("si no cabe, lo dice en vez de lanzar", rl.ok === true || rl.motivo === "demasiado largo", JSON.stringify(rl.motivo));
  const vueltaL = await N.abrir(rl.url);
  eq("la larga también vuelve entera", vueltaL.jugadas.length, larga.jugadas.length);

  console.log("\n--- interfaz del adaptador ---");
  eq("capacidades hoy", N.capacidades(), { publicar: true, comentar: false, backend: "enlace" });
  eq("comentarios requiere servidor", (await N.comentarios("x")).motivo, "requiere servidor");
  eq("comentar requiere servidor", (await N.comentar("x", "hola")).motivo, "requiere servidor");
  eq("migrar requiere servidor", (await N.migrar([])).motivo, "requiere servidor");

  console.log(fallos ? "\n" + fallos + " FALLOS" : "\nTodo correcto");
  process.exit(fallos ? 1 : 0);
})();
