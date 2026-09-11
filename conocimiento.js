"use strict";
/* ================= CONOCIMIENTO: análisis de la mano =================
   Criterios del taller de dominó, en funciones PURAS: no leen ni escriben
   estado global, no tocan el DOM y no llaman a engine.js (se carga después
   solo por orden de scripts). Se pueden probar sueltas en node.

   Las fichas se aceptan como "a-b" o como [a,b], en cualquier orden. */

/* Probabilidades de referencia del taller, sobre una mano de 7 de un doble-6.
   Son las hipergeométricas exactas: de las 28 fichas, 7 son dobles, y cada
   palo aparece en 7 fichas. La tabla de dobles llega hasta 5 porque 6 y 7
   dobles juntos no llegan al 0,02% de las manos. */
const PROB_DOBLES = { 0: 9.82, 1: 32.08, 2: 36.09, 3: 17.69, 4: 3.93, 5: 0.37 };
const PROB_FALLAS = { 0: 40, 1: 50, 2: 10, 3: 0.34 };
const FREQ_PALO = {
  3: "casi en cada mano",
  4: "una de cada 4 manos",
  5: "una de cada 40 manos",
  6: "una de cada 1.150 manos",
};

// Nombre de cada palo, para poder hablar de la mano como en la mesa.
const NOMBRE_PALO = ["blancas", "unos", "doses", "treses", "cuatros", "quintos", "seises"];

// Umbrales de puntos: Baja ≤32 · Media 33–49 · Alta ≥50
const PUNTOS_BAJA = 32, PUNTOS_MEDIA = 49;

/* ---------- utilidades ---------- */

// "a-b" o [a,b] -> [menor, mayor]. Devuelve null si no es una ficha válida.
function ficha(f) {
  let a, b;
  if (Array.isArray(f)) { a = +f[0]; b = +f[1]; }
  else {
    const p = String(f).split(/[-|,]/);
    a = +p[0]; b = +p[1];
  }
  if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
  if (a < 0 || a > 6 || b < 0 || b > 6) return null;
  return a <= b ? [a, b] : [b, a];
}
function fichas(lista) {
  return (lista || []).map(ficha).filter(Boolean);
}
function nombreFicha(t) { return t[0] + "-" + t[1]; }
function tienePalo(t, p) { return t[0] === p || t[1] === p; }

/* ---------- análisis ---------- */

/* analizarMano(fichas, jugadas)
   fichas  = mi mano.
   jugadas = fichas ya puestas sobre la mesa (opcional). Solo se usan para
             saber qué queda vivo de cada palo: las 7 del palo menos las
             jugadas. Mis propias fichas siguen vivas. */
function analizarMano(misFichas, jugadas = []) {
  const mano = fichas(misFichas);
  const mesa = fichas(jugadas);
  const conJugadas = mesa.length > 0;

  // --- puntos ---
  const puntos = mano.reduce((s, t) => s + t[0] + t[1], 0);
  const categoria = puntos <= PUNTOS_BAJA ? "Baja"
                  : puntos <= PUNTOS_MEDIA ? "Media"
                  : "Alta";

  // --- dobles ---
  const listaDobles = mano.filter(t => t[0] === t[1]).map(nombreFicha);

  // --- palo por palo ---
  const porPalo = [];
  for (let p = 0; p <= 6; p++) {
    const mias = mano.filter(t => tienePalo(t, p));
    const n = mias.length;
    const tieneDoble = mano.some(t => t[0] === p && t[1] === p);
    const jugadasDelPalo = mesa.filter(t => tienePalo(t, p)).length;
    const vivas = 7 - jugadasDelPalo;   // de las 7 del palo, las que siguen en juego
    const ajenas = vivas - n;           // vivas que no son mías

    /* Fuerza, en dos clases:
       · "origen": viene en el reparto. 4 o más del palo, o 3 con su doble.
       · "adquirida": la dan las fichas que ya salieron. Tienes más del palo
         que todos los demás juntos, aunque lleves pocas.
       Si se cumplen las dos, manda la de origen: la mano ya era fuerte. */
    let fuerza = false, claseFuerza = null, motivo = null;
    if (n >= 4) { fuerza = true; claseFuerza = "origen"; motivo = "4 o más del palo"; }
    else if (n === 3 && tieneDoble) { fuerza = true; claseFuerza = "origen"; motivo = "3 del palo, con su doble"; }
    else if (conJugadas && n > 0 && n > ajenas) {
      fuerza = true; claseFuerza = "adquirida";
      motivo = `tienes ${n} de las ${vivas} que quedan`;
    }

    porPalo.push({ palo: p, nombre: NOMBRE_PALO[p], n, fichas: mias.map(nombreFicha), tieneDoble, vivas, ajenas, fuerza, claseFuerza, motivo });
  }

  // --- fallas ---
  const listaFallas = porPalo.filter(x => x.n === 0).map(x => x.palo);

  const nD = listaDobles.length, nF = listaFallas.length;
  const palosFuertes = porPalo.filter(x => x.fuerza);
  const paloMasLargo = porPalo.reduce((a, b) => (b.n > a.n ? b : a), porPalo[0]);

  // --- etiquetas (pueden coincidir varias) ---
  const etiquetas = [];
  if (nD >= 2 && nF >= 2) etiquetas.push("Mala");
  if (nD === 2 || nF === 2 || (nD === 1 && nF === 1)) etiquetas.push("Regular");
  if (nD === 0 && nF === 0) etiquetas.push("Buena");
  if (porPalo.some(x => x.n >= 4)) etiquetas.push("Poderosa");
  if (nF === 0 && !porPalo.some(x => x.fuerza)) etiquetas.push("Equilibrada");

  return {
    fichas: mano.map(nombreFicha),
    n: mano.length,
    puntos,
    categoria,
    dobles: { lista: listaDobles, n: nD, prob: nD in PROB_DOBLES ? PROB_DOBLES[nD] : null },
    fallas: { lista: listaFallas, n: nF, prob: nF in PROB_FALLAS ? PROB_FALLAS[nF] : null },
    porPalo,
    palosFuertes,
    paloMasLargo,
    frecuenciaPaloMasLargo: paloMasLargo && paloMasLargo.n in FREQ_PALO ? FREQ_PALO[paloMasLargo.n] : null,
    etiquetas,
    conJugadas,
    probabilidades: { dobles: PROB_DOBLES, fallas: PROB_FALLAS, palo: FREQ_PALO },
  };
}

/* ================= ASESOR DE SALIDA =================
   Principios del taller, no leyes: el propio taller avisa de que la salida
   se juzga también por la tantera. La función es pura y devuelve además el
   motivo en lenguaje de mesa y una confianza, para que quien lo lea sepa
   cuánto pesa el consejo.

   Acompañamiento de un doble = cuántas fichas de su palo tienes, contándolo:
   1 en pelo, 2 en segunda, 3 en tercera, 4 en cuarta, 5 en quinta, 6 en
   sexta, 7 en séptima. */
const ACOMP = { 1: "en pelo", 2: "en segunda", 3: "en tercera", 4: "en cuarta",
                5: "en quinta", 6: "en sexta", 7: "en séptima" };
const NOTA_TANTERA = "Es un principio, no una ley: según cómo vaya la tantera " +
  "—si ganas o pierdes por mucho— la salida puede cambiar.";

function asesorSalida(misFichas) {
  const mano = fichas(misFichas);
  if (!mano.length) return null;

  const cuenta = [0, 0, 0, 0, 0, 0, 0];
  mano.forEach(t => { cuenta[t[0]]++; if (t[0] !== t[1]) cuenta[t[1]]++; });
  const esDoble = t => t[0] === t[1];
  const hayFuerza = p => cuenta[p] >= 4 || (cuenta[p] === 3 && mano.some(t => t[0] === p && t[1] === p));

  // dobles con su acompañamiento, de mejor a peor y, a igualdad, de mayor a menor
  const dobles = mano.filter(esDoble)
    .map(t => ({ ficha: nombreFicha(t), palo: t[0], acomp: cuenta[t[0]] }))
    .sort((a, b) => b.acomp - a.acomp || b.palo - a.palo);

  const alternativas = [];
  const apunta = (ficha, nota) => { if (ficha) alternativas.push({ ficha, nota }); };
  const cierra = (ficha, pensada, motivo, confianza) =>
    ({ ficha, pensada, motivo: motivo + " " + NOTA_TANTERA, confianza,
       alternativas: alternativas.filter(a => a.ficha !== ficha) });

  // Regla 5: con el doble en sexta o séptima no se sale. En sexta, si la
  // séptima ficha es otro doble, la salida es ese otro doble.
  const cargado = dobles.find(d => d.acomp >= 6);
  if (cargado) {
    const suelta = mano.filter(t => t[0] !== cargado.palo && t[1] !== cargado.palo);
    const otroDoble = suelta.find(esDoble);
    if (cargado.acomp === 6 && otroDoble) {
      apunta(cargado.ficha, `no se sale con el ${cargado.ficha} ${ACOMP[6]}`);
      return cierra(nombreFicha(otroDoble), "CPP",
        `El ${cargado.ficha} está ${ACOMP[cargado.acomp]}: con tanto de un palo no se sale por ahí. ` +
        `Sale el otro doble, el ${nombreFicha(otroDoble)}, con pensada.`, "media");
    }
  }

  // Candidatos: dobles acompañados (2 o más) que no estén en sexta ni séptima.
  const acompañados = dobles.filter(d => d.acomp >= 2 && d.acomp <= 5);
  const enPelo = dobles.filter(d => d.acomp === 1);

  if (acompañados.length) {
    let elegido = acompañados[0];                       // regla 1: el mejor acompañado; a igualdad, el más alto
    let regla = 1;

    // Regla 4: doble en quinta con otro en segunda -> sale el de segunda.
    if (elegido.acomp === 5) {
      const segunda = acompañados.find(d => d.acomp === 2);
      if (segunda) { apunta(elegido.ficha, `${ACOMP[5]}, se guarda`); elegido = segunda; regla = 4; }
    }
    acompañados.forEach(d => { if (d !== elegido) apunta(d.ficha, `doble ${ACOMP[d.acomp]}`); });

    const palo = NOMBRE_PALO[elegido.palo];
    if (regla === 4)
      return cierra(elegido.ficha, "CPP",
        `Tienes un doble en quinta y otro en segunda: sale el de segunda, el ${elegido.ficha}, con pensada.`, "alta");

    if (elegido.acomp >= 3)                              // regla 2
      return cierra(elegido.ficha, "SPP",
        `Doble ${ACOMP[elegido.acomp]}: sale el ${elegido.ficha} sin pensada (tienes fuerza en ${palo}).`, "alta");

    return cierra(elegido.ficha, "CPP",                   // regla 3
      `Doble ${ACOMP[2]}: sale el ${elegido.ficha} con pensada (solo lo acompaña una ficha de ${palo}).`, "alta");
  }

  // Regla 6: varios dobles en pelo y ninguno acompañado -> el más alto, con pensada.
  if (enPelo.length >= 2) {
    const alto = enPelo.reduce((a, b) => (b.palo > a.palo ? b : a));
    enPelo.forEach(d => { if (d !== alto) apunta(d.ficha, "doble en pelo"); });
    return cierra(alto.ficha, "CPP",
      `Solo tienes dobles en pelo (${enPelo.map(d => d.ficha).join(", ")}): sale el más alto, ` +
      `el ${alto.ficha}, con pensada, para soltarlo pronto.`, "media");
  }

  /* Regla 7: sin doble con el que salir, ficha mixta que una los dos palos
     más largos. Un único doble en pelo tampoco sirve de salida —no lo puedes
     acompañar—, así que la mano cae también aquí.
     Heurística floja, a afinar: puntúa por fichas que te quedan de cada punta
     y, a igualdad, evita romper un palo donde tienes fuerza. */
  const mixtas = mano.filter(t => !esDoble(t));
  if (!mixtas.length) return cierra(nombreFicha(mano[0]), "CPP", `Solo llevas dobles: sale el ${nombreFicha(mano[0])}.`, "baja");

  const puntuadas = mixtas.map(t => ({
    t,
    ficha: nombreFicha(t),
    apoyo: cuenta[t[0]] + cuenta[t[1]],
    rompeFuerza: hayFuerza(t[0]) || hayFuerza(t[1]),
    pips: t[0] + t[1],
  })).sort((a, b) => b.apoyo - a.apoyo || a.rompeFuerza - b.rompeFuerza || b.pips - a.pips);

  const m = puntuadas[0];
  puntuadas.slice(1, 3).forEach(x => apunta(x.ficha, `${x.apoyo} fichas de apoyo`));
  if (enPelo.length === 1) apunta(enPelo[0].ficha, "doble en pelo, mejor no salir con él");
  return cierra(m.ficha, "CPP",
    `Sin doble con el que salir: sale el ${m.ficha}, que une tus dos palos más largos ` +
    `(${NOMBRE_PALO[m.t[0]]} y ${NOMBRE_PALO[m.t[1]]}), para poder seguir por las dos puntas.`, "baja");
}

// Para poder probarlo con node fuera del navegador.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { analizarMano, asesorSalida, ficha, NOMBRE_PALO, ACOMP, PROB_DOBLES, PROB_FALLAS, FREQ_PALO };
}
