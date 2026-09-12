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

  /* Criterio A. Con tres dobles o más la mano pesa demasiado: generalmente
     sale el más alto aunque vaya mal acompañado, para descargarlo cuanto
     antes. Con solo dos sigue mandando el mejor acompañado. */
  if (dobles.length >= 3) {
    const alto = dobles.reduce((a, b) => (b.palo > a.palo ? b : a));
    dobles.forEach(d => { if (d !== alto) apunta(d.ficha, `doble ${ACOMP[d.acomp]}`); });
    const palo = NOMBRE_PALO[alto.palo];
    const pensada = alto.acomp >= 3 ? "SPP" : "CPP";
    const cola = alto.acomp >= 3
      ? `sin pensada (lo acompañan ${alto.acomp - 1} fichas de ${palo})`
      : `con pensada porque va ${ACOMP[alto.acomp]}`;
    return cierra(alto.ficha, pensada,
      `Tienes ${dobles.length} dobles: sale el más alto (${alto.ficha}) para descargarlo, ${cola}.`, "media");
  }

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

  /* Criterio B. Sin doble con el que salir, se sale de mixta. Un único doble
     en pelo tampoco es candidato: no lo puedes acompañar. */
  const mixtas = mano.filter(t => !esDoble(t));
  if (!mixtas.length) return cierra(nombreFicha(mano[0]), "CPP", `Solo llevas dobles: sale el ${nombreFicha(mano[0])}.`, "baja");
  if (enPelo.length === 1) apunta(enPelo[0].ficha, "doble en pelo, mejor no salir con él");
  const otraPunta = (t, p) => (t[0] === p ? t[1] : t[0]);

  // B.1 — Con fuerza en un palo (4 o más fichas), se abre ese palo enganchando
  //       con el siguiente más largo.
  const fuertes = [0, 1, 2, 3, 4, 5, 6].filter(p => cuenta[p] >= 4).sort((a, b) => cuenta[b] - cuenta[a] || b - a);
  if (fuertes.length) {
    const f = fuertes[0];
    const conFuerte = mixtas.filter(t => t[0] === f || t[1] === f)
      .sort((a, b) => cuenta[otraPunta(b, f)] - cuenta[otraPunta(a, f)] || (b[0] + b[1]) - (a[0] + a[1]));
    if (conFuerte.length) {
      const t = conFuerte[0], o = otraPunta(t, f);
      conFuerte.slice(1, 3).forEach(x => apunta(nombreFicha(x), `también abre ${NOMBRE_PALO[f]}`));
      return cierra(nombreFicha(t), "SPP",
        `Sin doble con el que salir, pero tienes fuerza en ${NOMBRE_PALO[f]} (${cuenta[f]} fichas): ` +
        `sale el ${nombreFicha(t)}, que abre tu palo fuerte y engancha con ${NOMBRE_PALO[o]} ` +
        `(${cuenta[o]}), sin pensada.`, "media");
    }
  }

  // B.2 — Sin fuerza: la mixta de más puntos que puedas repetir por las dos
  //       puntas (≥2 fichas de cada palo); a igualdad, la de palos más largos.
  const repetibles = mixtas.filter(t => cuenta[t[0]] >= 2 && cuenta[t[1]] >= 2);
  const pool = repetibles.length ? repetibles : mixtas;
  const puntuadas = pool.map(t => ({
    t, ficha: nombreFicha(t),
    pips: t[0] + t[1],
    apoyo: cuenta[t[0]] + cuenta[t[1]],
  })).sort((a, b) => b.pips - a.pips || b.apoyo - a.apoyo);

  const m = puntuadas[0];
  puntuadas.slice(1, 3).forEach(x => apunta(x.ficha, `${x.pips} puntos, ${x.apoyo} de apoyo`));
  return cierra(m.ficha, "CPP",
    repetibles.length
      ? `Sin doble con el que salir: sale el ${m.ficha}, la mixta de más puntos que puedes repetir ` +
        `por las dos puntas (${NOMBRE_PALO[m.t[0]]} y ${NOMBRE_PALO[m.t[1]]}, ${cuenta[m.t[0]]} y ${cuenta[m.t[1]]} fichas).`
      : `Sin doble con el que salir y sin palo que puedas repetir: sale el ${m.ficha}, ` +
        `la de más apoyo entre ${NOMBRE_PALO[m.t[0]]} y ${NOMBRE_PALO[m.t[1]]}.`,
    repetibles.length ? "media" : "baja");
}

/* ================= LA PENSADA (CPP / SPP) =================
   Marca que lleva cada ficha jugada y que informa sobre la punta donde se
   juega. NUNCA se infiere: o la calcula el sistema del que juega, o la anota
   quien la vio en la mesa. Los pases no llevan pensada.

   · clasico: informa el numero que CASTIGA.
   · moderno: informa el numero que GENERA.
   Ver principios-domino.md §5.6. Las jugadas sucesivas (§5.4) y el sistema
   combinado quedan fuera de esta version. */
const SISTEMAS = ["ninguno", "clasico", "moderno"];

/* pensadaPara({ficha, lado, numeroCastigado, numeroGenerado, mano, sistema, jugadas})
   mano = mi mano ANTES de jugar (incluye la ficha). jugadas = lo ya puesto en
   la mesa, para poder medir la fuerza adquirida. Devuelve "CPP", "SPP" o null. */
function pensadaPara(o) {
  const sistema = o.sistema || "ninguno";
  if (sistema === "ninguno") return null;
  const t = ficha(o.ficha);
  if (!t) return null;
  const mano = fichas(o.mano);
  const cuantas = n => mano.filter(x => x[0] === n || x[1] === n).length;

  // Salida: la decide el propio asesor de salida.
  if (o.numeroCastigado === null || o.numeroCastigado === undefined) {
    const sal = asesorSalida(o.mano);
    return sal ? sal.pensada : null;
  }

  // Doble en partida: igual en los dos sistemas. CPP si me quedan mas de ese
  // numero aparte del doble; SPP si el doble era lo unico que tenia.
  if (t[0] === t[1]) return cuantas(t[0]) >= 2 ? "CPP" : "SPP";

  // Mixta en clasico: informa el numero castigado.
  if (sistema === "clasico") return cuantas(o.numeroCastigado) >= 2 ? "CPP" : "SPP";

  // Mixta en moderno: informa el numero generado. SPP si tengo fuerza en el,
  // contando la ficha que juego (de origen o adquirida).
  const a = analizarMano(o.mano, o.jugadas || []);
  return a.porPalo[o.numeroGenerado].fuerza ? "SPP" : "CPP";
}

/* Lee las pensadas ya anotadas y devuelve lo que declaran sus autores.
   Solo lee de jugadores con sistema clasico o moderno y pensada no nula. */
function leerPensadas(secuencia, sistemas) {
  const vacio = () => ({ tieneMas: new Set(), noTiene: new Set(), fuerte: new Set() });
  const por = { 0: vacio(), 1: vacio(), 2: vacio(), 3: vacio() };
  const notas = [];
  (secuencia || []).forEach(s => {
    const sis = (sistemas || {})[s.jugador];
    if (!sis || sis === "ninguno" || !s.pensada) return;
    const t = ficha(s.ficha);
    if (!t) return;
    const gen = (s.genera || [])[0];
    const doble = t[0] === t[1];
    let n = null, dice = null;
    if (doble) {
      n = t[0];
      if (s.pensada === "CPP") { por[s.jugador].tieneMas.add(n); dice = "tiene mas " + NOMBRE_PALO[n]; }
      else { por[s.jugador].noTiene.add(n); dice = "no le quedan mas " + NOMBRE_PALO[n]; }
    } else if (sis === "clasico") {
      n = s.castiga;
      if (n === null || n === undefined) return;
      if (s.pensada === "CPP") { por[s.jugador].tieneMas.add(n); dice = "tiene mas " + NOMBRE_PALO[n]; }
      else { por[s.jugador].noTiene.add(n); dice = "esa era su ultima de " + NOMBRE_PALO[n]; }
    } else {                                   // moderno
      n = gen;
      if (n === null || n === undefined) return;
      if (s.pensada === "SPP") { por[s.jugador].fuerte.add(n); dice = "tiene fuerza en " + NOMBRE_PALO[n]; }
      else { dice = "sin fuerza en " + NOMBRE_PALO[n]; }
    }
    notas.push({ jugador: s.jugador, ficha: s.ficha, pensada: s.pensada, sistema: sis, numero: n, dice: dice });
  });
  return { por: por, notas: notas };
}

/* ================= SUGERIR JUGADA =================
   Principio de diseño: esta sugerencia razona SOLO con lo que el jugador sabe
   legítimamente —su mano, las puntas, quién jugó qué (qué castigó y qué
   generó), quién pasó y con qué puntas, y quién salió con qué—. NUNCA mira
   las manos ajenas. Por eso no tiene por qué coincidir con aiBestMovesDeep,
   que sí las ve: el contraste entre las dos es parte de lo didáctico.

   Pesos iniciales, a afinar. Positivos animan, negativos frenan. */
const PESOS_SUGERENCIA = {
  repetirSalidaFuerte:    20,   // P2+ repite la salida SPP del compañero (ahi tiene fuerza)
  repetirCompanero:       10,   // P2  toca un palo que abrió el compañero
  castigarContrario:      10,   // P3  castiga un palo que generó un contrario
  facilitarCompanero:      9,   // P9  genera un palo que el compañero tiene
  generarFallaCompanero: -12,   // P9  genera un palo donde el compañero pasó
  generarFallaContrario:  11,   // P10 genera un palo donde un contrario pasó
  generarPaloContrario:   -8,   // P10 genera un palo que abrió un contrario
  cuadrarBien:             7,   // P10 cuadra a un número que dominas o que fallan
  quedaRespuesta:          6,   // te queda al menos una punta contestable
  sinRespuesta:          -14,   // te quedas sin salida por las dos puntas
  encimaSalidaContrario:   5,   // P5/P6 por encima de la salida del contrario
  debajoSalidaCompanero:   5,   // P7/P8 por debajo de la salida del compañero
  generarFuerzaPropia:     6,   // P4  abre un palo donde tienes fuerza
  irseDeLaFalla:          26,   // sueltas la huerfana pudiendo soltar una con apoyo
  frenoFuerzaEnFalla:    0.3,   // ...pero sin prisa si mandas en el numero por el que juegas
  gastarLlave:           -12,   // gastas tu unica ficha de un numero abierto teniendo otra jugada
  dobleSolo:              -4,   // te quedas con un doble sin acompañamiento
  seguroAmbasPuntas:      12,   // respuesta garantizada por las dos puntas
  puntosPorPip:         0.45,   // descargar peso cuando la mano se cierra
  // Lecturas de pensada (§5.6). Moderadas: son señal, no certeza.
  lecturaCompanero:        6,   // el compañero declaro tener ahi
  lecturaCompaneroNo:     -6,   // el compañero declaro NO tener ahi
  lecturaCastigarFuerte:   6,   // castigar el palo donde el contrario declaro fuerza
  lecturaNoDarFuerte:     -6,   // no generarle el palo donde declaro fuerza
  lecturaCubrirContrario:  6,   // cubrir el palo donde el contrario declaro tener mas
};

/* Rehace la mesa desde las jugadas en orden. Cada entrada es
   {jugador, ficha, punta?} o {jugador, paso:true}. Valida legalidad y
   devuelve puntas, secuencia anotada (castiga / genera) y pases. */
function reconstruirMesa(jugadas) {
  let ends = null;
  const secuencia = [], pases = [];
  (jugadas || []).forEach((x, i) => {
    if (x.paso) { pases.push({ jugador: x.jugador, ends: ends ? ends.slice() : null }); return; }
    const t = ficha(x.ficha);
    if (!t) throw new Error("jugada " + i + ": ficha invalida " + x.ficha);
    if (ends === null) {                       // la salida genera sus dos numeros
      ends = [t[0], t[1]];
      secuencia.push({ jugador: x.jugador, ficha: nombreFicha(t), castiga: null,
                       genera: t[0] === t[1] ? [t[0]] : [t[0], t[1]], ends: ends.slice() });
      return;
    }
    const casaI = t[0] === ends[0] || t[1] === ends[0];
    const casaD = t[0] === ends[1] || t[1] === ends[1];
    let lado = x.punta;
    if (lado !== "I" && lado !== "D") {
      if (!casaI && !casaD) throw new Error("jugada " + i + ": " + x.ficha + " no casa en [" + ends + "]");
      lado = casaI ? "I" : "D";
    } else if ((lado === "I" && !casaI) || (lado === "D" && !casaD)) {
      throw new Error("jugada " + i + ": " + x.ficha + " no casa por la punta " + lado + " en [" + ends + "]");
    }
    const idx = lado === "I" ? 0 : 1, castiga = ends[idx];
    const genera = t[0] === castiga ? t[1] : t[0];
    ends[idx] = genera;
    secuencia.push({ jugador: x.jugador, ficha: nombreFicha(t), punta: lado,
                     castiga: castiga, genera: [genera], ends: ends.slice() });
  });
  return { ends: ends, secuencia: secuencia, pases: pases };
}

/* sugerirJugada(estado)
   estado = { yo, miMano, ends, secuencia, pases, salidor, salida,
              pasesSeguidos?, contrasteIA? }
   contrasteIA se recibe y se devuelve tal cual: calcularlo exigiría ver las
   manos ajenas, y esta función no las mira. */
function sugerirJugada(estado) {
  const P = PESOS_SUGERENCIA;
  const yo = estado.yo, mano = fichas(estado.miMano), ends = estado.ends;
  const secuencia = estado.secuencia || [], pases = estado.pases || [];
  const contrasteIA = estado.contrasteIA || null;
  if (!mano.length) return null;

  // Con la mesa vacia la decision es la salida: la resuelve el asesor de salida.
  if (!ends) {
    const sal = asesorSalida(estado.miMano);
    if (!sal) return null;
    return { recomendada: { ficha: sal.ficha, punta: "inicio" },
             razones: [{ peso: null, principio: "salida", texto: sal.motivo }],
             contras: [], confianza: sal.confianza, porQueNo: null,
             alternativas: [], contrasteIA: contrasteIA, esSalida: true };
  }

  const companero = (yo + 2) % 4;
  const contrarios = [(yo + 1) % 4, (yo + 3) % 4];

  // --- lo que delata cada jugador con lo que ha hecho ---
  const generoPor = {}, tocoPor = {}, fallaDe = {};
  [0, 1, 2, 3].forEach(j => { generoPor[j] = new Set(); tocoPor[j] = new Set(); fallaDe[j] = new Set(); });
  secuencia.forEach(s => {
    (s.genera || []).forEach(g => { generoPor[s.jugador].add(g); tocoPor[s.jugador].add(g); });
    if (s.castiga !== null && s.castiga !== undefined) tocoPor[s.jugador].add(s.castiga);
  });
  pases.forEach(p => (p.ends || []).forEach(e => fallaDe[p.jugador].add(e)));

  // La salida admite {ficha, jugador, pensada:"CPP"|"SPP"} o solo la ficha.
  const sal = (estado.salida && typeof estado.salida === "object") ? estado.salida
            : { ficha: estado.salida, jugador: estado.salidor, pensada: null };
  const nums = ficha(sal.ficha);
  const refSalida = nums ? Math.max(nums[0], nums[1]) : null;
  const salidorSeat = sal.jugador !== undefined && sal.jugador !== null ? sal.jugador : estado.salidor;
  const salidorContrario = contrarios.includes(salidorSeat);
  const salidorCompanero = salidorSeat === companero;
  // Salir SPP indica fuerza en ese palo; salir CPP a un doble no indica nada.
  const paloSalidaFuerte = (salidorCompanero && sal.pensada === "SPP" && nums) ? nums : null;

  // Lecturas de pensada: solo de quien juega con sistema y dejo marca.
  const lectura = leerPensadas(secuencia, estado.sistemas || {});
  const dice = (j, cual, n) => lectura.por[j] && lectura.por[j][cual].has(n);
  const algunContrario = (cual, n) => contrarios.some(c => dice(c, cual, n));

  const analisis = analizarMano(estado.miMano, secuencia.map(s => s.ficha));
  const tengoFuerza = n => analisis.porPalo[n].fuerza;
  const misDelPalo = n => mano.filter(t => t[0] === n || t[1] === n).length;

  // --- jugadas legales (ficha + punta), sin duplicar las equivalentes ---
  // Llave = mi unica ficha de un numero que esta abierto en la mesa. Gastarla
  // deja el numero libre para que me cuadren a el.
  const esLlave = t => ends.some(n => (t[0] === n || t[1] === n) && misDelPalo(n) === 1);

  const legales = [];
  mano.forEach(t => {
    [0, 1].forEach(i => {
      if (t[0] !== ends[i] && t[1] !== ends[i]) return;
      const castiga = ends[i], genera = t[0] === castiga ? t[1] : t[0];
      const nuevas = ends.slice(); nuevas[i] = genera;
      const clave = nombreFicha(t) + "|" + castiga + "|" + genera;
      if (legales.some(m => m.clave === clave)) return;
      legales.push({ clave: clave, t: t, ficha: nombreFicha(t), punta: i === 0 ? "I" : "D",
                     castiga: castiga, genera: genera, nuevas: nuevas });
    });
  });
  if (!legales.length) return null;

  const evaluadas = legales.map(m => {
    const razones = [];
    let puntos = 0;
    const suma = (peso, texto, principio) => {
      if (!peso) return;
      puntos += peso; razones.push({ peso: peso, texto: texto, principio: principio });
    };
    const resto = mano.slice();
    resto.splice(resto.findIndex(t => nombreFicha(t) === m.ficha), 1);
    const puedo = n => resto.some(t => t[0] === n || t[1] === n);

    const llave = esLlave(m.t);

    // P2 - repetir lo que abrio el compañero. Si salio SPP, ahi tiene fuerza
    // de verdad y pesa mas que un palo que solo genero de paso.
    const nSal = paloSalidaFuerte && (paloSalidaFuerte.includes(m.genera) ? m.genera
               : paloSalidaFuerte.includes(m.castiga) ? m.castiga : null);
    const repiteGen = generoPor[companero].has(m.genera);
    const repiteCas = generoPor[companero].has(m.castiga);
    if (nSal !== null && nSal !== undefined)
      suma(P.repetirSalidaFuerte, "repite el " + NOMBRE_PALO[nSal] + ", la salida sin pensada de tu compañero", "P2+");
    else if (repiteGen || repiteCas)
      suma(P.repetirCompanero, "repite el " + NOMBRE_PALO[repiteGen ? m.genera : m.castiga] + " que abrio tu compañero", "P2");

    // P3 - castigar lo que abrio el contrario. Dejar correr: si esa ficha es mi
    // llave, no la gasto por castigar; me guardo para cuando lo vuelva a mandar.
    if (contrarios.some(c => generoPor[c].has(m.castiga))) {
      if (llave) razones.push({ peso: 0, principio: "dejar correr",
        texto: "podria castigar el " + NOMBRE_PALO[m.castiga] + ", pero esa es tu unica ficha del palo: mejor dejarlo correr" });
      else suma(P.castigarContrario, "castiga el " + NOMBRE_PALO[m.castiga] + ", que abrio un contrario", "P3");
    }

    // P9 - facilidades al compañero
    if (tocoPor[companero].has(m.genera))
      suma(P.facilitarCompanero, "le deja " + NOMBRE_PALO[m.genera] + " al compañero, que lo ha jugado", "P9");
    if (fallaDe[companero].has(m.genera))
      suma(P.generarFallaCompanero, "abre " + NOMBRE_PALO[m.genera] + " y tu compañero fallo a ese numero", "P9");

    // P10 - dificultades al contrario
    if (contrarios.some(c => fallaDe[c].has(m.genera)))
      suma(P.generarFallaContrario, "abre " + NOMBRE_PALO[m.genera] + ", numero al que fallo un contrario", "P10");
    if (contrarios.some(c => generoPor[c].has(m.genera)))
      suma(P.generarPaloContrario, "le sirve " + NOMBRE_PALO[m.genera] + " a un contrario, que lo abrio", "P10");
    if (m.nuevas[0] === m.nuevas[1]) {
      const n = m.nuevas[0];
      if (contrarios.some(c => fallaDe[c].has(n)) || tengoFuerza(n))
        suma(P.cuadrarBien, "cuadra a " + NOMBRE_PALO[n] + ", numero que dominas o que falla un contrario", "P10");
    }

    // P5/P6 y P7/P8 - por encima del contrario, por debajo del compañero
    if (salidorContrario && refSalida !== null && (m.genera > refSalida || m.castiga > refSalida))
      suma(P.encimaSalidaContrario, "va por encima del " + refSalida + " con el que salio el contrario", "P5/P6");
    if (salidorCompanero && refSalida !== null && (m.genera < refSalida || m.castiga < refSalida))
      suma(P.debajoSalidaCompanero, "va por debajo del " + refSalida + " con el que salio tu compañero", "P7/P8");

    // Lecturas de pensada (informacion legitima: la marca esta en la mesa)
    if (dice(companero, "tieneMas", m.genera) || dice(companero, "fuerte", m.genera))
      suma(P.lecturaCompanero, "tu compañero marco " + NOMBRE_PALO[m.genera] + ": ahi tiene juego", "pensada");
    else if (dice(companero, "noTiene", m.genera))
      suma(P.lecturaCompaneroNo, "tu compañero marco que no le quedan " + NOMBRE_PALO[m.genera], "pensada");
    // Dejar correr tambien aqui: si la ficha con la que castigaria es mi llave,
    // no la gasto. Con mas motivo si el contrario marco fuerza en ese numero:
    // la va a volver a mandar y me quedo sin con que responder.
    if (algunContrario("fuerte", m.castiga)) {
      if (llave) razones.push({ peso: 0, principio: "dejar correr",
        texto: "un contrario marco fuerza en " + NOMBRE_PALO[m.castiga] + ", pero esa es tu unica ficha del palo: guardala" });
      else suma(P.lecturaCastigarFuerte, "castiga " + NOMBRE_PALO[m.castiga] + ", donde un contrario marco fuerza", "pensada");
    }
    if (algunContrario("fuerte", m.genera))
      suma(P.lecturaNoDarFuerte, "le sirve " + NOMBRE_PALO[m.genera] + ", donde un contrario marco fuerza", "pensada");
    if (algunContrario("tieneMas", m.castiga) && !llave)
      suma(P.lecturaCubrirContrario, "cubre " + NOMBRE_PALO[m.castiga] + ", que un contrario marco tener", "pensada");

    // P4 - indicar lo que tienes
    if (tengoFuerza(m.genera))
      suma(P.generarFuerzaPropia, "abre " + NOMBRE_PALO[m.genera] + ", donde tienes fuerza", "P4");

    // irse de la falla / seguro
    const rI = puedo(m.nuevas[0]), rD = puedo(m.nuevas[1]);
    if (rI && rD) suma(P.seguroAmbasPuntas, "te deja respuesta por las dos puntas", "seguro");
    else if (rI || rD) suma(P.quedaRespuesta, "te deja respuesta por una punta", "falla");
    else suma(P.sinRespuesta, "te quedas sin respuesta por ninguna punta", "falla");

    // C - guardar la llave: mi unica ficha de un numero abierto, teniendo otra jugada
    if (llave && legales.length > 1)
      suma(P.gastarLlave, "gasta tu llave del " + NOMBRE_PALO[ends.find(n => (m.t[0] === n || m.t[1] === n) && misDelPalo(n) === 1)] +
        ", la unica que te queda de ese numero", "llave");

    /* B - irse de la falla: soltar la huerfana pudiendo soltar, por el MISMO
       numero, una que si tenga apoyo. Vale toda la mano, pero modulada:
        · urgencia sube cuanto menos fichas quedan (curva cubica: con 3 o menos
          es maxima; con 6 o 7 es casi nula, porque aun hay mano por delante);
        · urgencia baja si tienes fuerza en el numero por el que juegas: vas a
          volver a jugar por ahi y la huerfana puede esperar. */
    if (!puedo(m.genera)) {
      const hermanas = legales.filter(o => o.castiga === m.castiga && o.ficha !== m.ficha);
      if (hermanas.some(o => resto.some(t => t[0] === o.genera || t[1] === o.genera))) {
        const urgencia = Math.min(1, Math.pow(Math.max(0, 8 - mano.length) / 5, 3));
        const freno = tengoFuerza(m.castiga) ? P.frenoFuerzaEnFalla : 1;
        const bono = +(P.irseDeLaFalla * urgencia * freno).toFixed(2);
        if (bono) suma(bono, "se va de la falla: suelta el " + NOMBRE_PALO[m.genera] +
          ", del que no tienes mas, y conserva el palo con apoyo" +
          (freno < 1 ? " (sin prisa: mandas en " + NOMBRE_PALO[m.castiga] + ")" : ""), "falla");
      }
    }
    if (resto.some(t => t[0] === t[1] && !resto.some(x => x !== t && (x[0] === t[0] || x[1] === t[0]))))
      suma(P.dobleSolo, "te deja un doble sin acompañamiento", "proteccion");

    // puntos: pesan mas segun se cierra la mano
    const cierre = Math.min(1, (estado.pasesSeguidos || 0) * 0.3 + (7 - mano.length) / 7);
    const pips = m.t[0] + m.t[1];
    if (cierre > 0 && pips) suma(+(P.puntosPorPip * pips * cierre).toFixed(2), "descarga " + pips + " puntos", "puntos");

    razones.sort((a, b) => Math.abs(b.peso) - Math.abs(a.peso));
    return { ficha: m.ficha, punta: m.punta, castiga: m.castiga, genera: m.genera,
             t: m.t, nuevas: m.nuevas, puntos: +puntos.toFixed(2), razones: razones };
  }).sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    // A igualdad de puntos decide el principio, no el numero por el numero:
    // contra la salida del contrario, la ficha mas alta (P5); con la del
    // compañero, la mas baja (P7).
    const pa = a.t[0] + a.t[1], pb = b.t[0] + b.t[1];
    if (salidorContrario && pa !== pb) return pb - pa;
    if (salidorCompanero && pa !== pb) return pa - pb;
    return (b.castiga + b.genera) - (a.castiga + a.genera);
  });

  const mejor = evaluadas[0], segunda = evaluadas[1] || null;
  let desempate = null;
  if (segunda && segunda.puntos === mejor.puntos) {
    const pm = mejor.t[0] + mejor.t[1], ps = segunda.t[0] + segunda.t[1];
    if (salidorContrario && pm > ps) desempate = { principio: "P5",
      texto: "empata con el " + segunda.ficha + ": contra la salida del contrario se juega la mas alta" };
    else if (salidorCompanero && pm < ps) desempate = { principio: "P7",
      texto: "empata con el " + segunda.ficha + ": con la salida de tu compañero se juega la mas baja" };
  }
  const margen = segunda ? mejor.puntos - segunda.puntos : Infinity;
  const confianza = margen >= 8 ? "alta" : margen >= 3 ? "media" : "baja";

  let porQueNo = null;
  if (segunda) {
    const suyas = new Set(segunda.razones.filter(r => r.peso > 0).map(r => r.principio));
    const gana = mejor.razones.filter(r => r.peso > 0 && !suyas.has(r.principio));
    const pierde = segunda.razones.filter(r => r.peso < 0);
    porQueNo = "El " + segunda.ficha + " por la punta " +
      (segunda.punta === "I" ? "izquierda" : "derecha") + " queda cerca (" + segunda.puntos + " frente a " + mejor.puntos + ")" +
      (gana.length ? ", pero no " + gana[0].texto : "") +
      (pierde.length ? " y " + pierde[0].texto : "") + ".";
  }

  return {
    recomendada: { ficha: mejor.ficha, punta: mejor.punta, castiga: mejor.castiga,
                   genera: mejor.genera, puntos: mejor.puntos },
    razones: mejor.razones.filter(r => r.peso > 0).slice(0, 3),
    contras: mejor.razones.filter(r => r.peso < 0),
    confianza: confianza,
    desempate: desempate,
    lecturas: lectura.notas,
    porQueNo: porQueNo,
    alternativas: evaluadas.slice(1).map(m => ({ ficha: m.ficha, punta: m.punta,
      puntos: m.puntos, razones: m.razones.slice(0, 2) })),
    contrasteIA: contrasteIA,
  };
}

// Para poder probarlo con node fuera del navegador.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { analizarMano, asesorSalida, sugerirJugada, reconstruirMesa,
                     pensadaPara, leerPensadas, SISTEMAS, ficha,
                     NOMBRE_PALO, ACOMP, PESOS_SUGERENCIA, PROB_DOBLES, PROB_FALLAS, FREQ_PALO };
}
