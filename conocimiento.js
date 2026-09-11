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

// Para poder probarlo con node fuera del navegador.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { analizarMano, ficha, NOMBRE_PALO, PROB_DOBLES, PROB_FALLAS, FREQ_PALO };
}
