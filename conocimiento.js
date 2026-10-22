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
   · combinado: el jugador decide EN CADA MOMENTO con cual juega. No hay regla
     automatica de cambio: lo que vale es el sistema que quedo registrado al
     hacer esa jugada; si no viene (partida vieja), el inicial de su config.

   La PENSADA DE SALIDA es un eje APARTE del sistema (§6) y, sobre todo, es UNA
   SOLA EN LA MESA: la salida es una, asi que el convenio no es de cada
   jugador sino de la partida.
   · fuerza (por defecto): la decide el asesor de salida, y habla del PALO:
     dice si hay fuerza o no en la piedra con la que se sale.
   · calidad: habla de la MANO entera. Buena o Poderosa -> SPP; el resto, CPP.
     Si una mano es Poderosa y Mala a la vez, manda Poderosa.
   · ninguna: la salida no se marca.
   Las partidas guardadas antes de esto llevaban el convenio por jugador; se
   siguen leyendo, heredando el del salidor. Las jugadas sucesivas (§5.4)
   siguen fuera. */
const SISTEMAS = ["ninguno", "clasico", "moderno", "combinado"];
const SALIDAS = ["ninguna", "fuerza", "calidad"];
const CONVENIO_DEFECTO = "fuerza";

/* El convenio de salida que rige: el de la mesa si viene, el que llevaba el
   jugador si la partida es de las de antes, y si no el de por defecto. */
function convenioSalida(deLaMesa, cfgJugador) {
  if (SALIDAS.includes(deLaMesa)) return deLaMesa;
  if (cfgJugador && SALIDAS.includes(cfgJugador.salida)) return cfgJugador.salida;
  return CONVENIO_DEFECTO;
}

/* configJugador(c) -> {sistema, inicial, salida}
   Acepta la forma vieja ("clasico") y la nueva ({sistema, combinado:{inicial},
   salida}). Todos los campos nuevos son opcionales: lo que falte, por defecto.
   Asi una partida guardada antes de esto se lee sin tocarla. */
function configJugador(c) {
  /* Por defecto combinado: es lo que se juega en el alto nivel. `salida` ya no
     es del jugador; solo se conserva para leer partidas guardadas antes de
     moverlo a la mesa, y por eso nace en null. */
  const d = { sistema: "combinado", inicial: "moderno", salida: null };
  if (!c) return d;
  if (typeof c === "string") { if (SISTEMAS.includes(c)) d.sistema = c; return d; }
  if (SISTEMAS.includes(c.sistema)) d.sistema = c.sistema;
  const ini = (c.combinado && c.combinado.inicial) || c.inicial;
  if (ini === "clasico" || ini === "moderno") d.inicial = ini;
  if (SALIDAS.includes(c.salida)) d.salida = c.salida;
  return d;
}

/* Que sistema rige UNA jugada concreta. Para el combinado manda el que quedo
   registrado al jugarla; si no viene, el inicial. Devuelve null si no juega
   con sistema. */
function sistemaEnJuego(cfg, sistemaJugada) {
  const c = configJugador(cfg);
  if (c.sistema === "ninguno") return null;
  if (c.sistema !== "combinado") return c.sistema;
  return (sistemaJugada === "clasico" || sistemaJugada === "moderno") ? sistemaJugada : c.inicial;
}

/* pensadaPara({ficha, lado, numeroCastigado, numeroGenerado, mano, sistema,
                 sistemaJugada, salida, jugadas})
   mano = mi mano ANTES de jugar (incluye la ficha). jugadas = lo ya puesto en
   la mesa, para poder medir la fuerza adquirida.
   sistema  = "clasico" (forma vieja) o la config entera del jugador.
   sistemaJugada = para un combinado, con cual juega ESTA jugada.
   salida   = convencion de salida, si se quiere forzar aparte de la config.
   Devuelve "CPP", "SPP" o null. */
function pensadaPara(o) {
  const cfg = configJugador(o.sistema);
  const convenio = convenioSalida(o.salida, cfg);
  const t = ficha(o.ficha);
  if (!t) return null;

  /* LA SALIDA, primero y aparte: la decide su convencion, no el sistema.
     Por fuerza la resuelve el asesor de salida (habla del palo); por calidad
     la resuelve la etiqueta de la mano (habla del juego), y ahi Poderosa manda
     sobre Mala: un palo de cuatro es juego aunque sobren dobles y fallas. */
  if (o.numeroCastigado === null || o.numeroCastigado === undefined) {
    if (convenio === "ninguna") return null;
    if (convenio === "calidad") {
      const et = analizarMano(o.mano).etiquetas;
      return (et.includes("Poderosa") || et.includes("Buena")) ? "SPP" : "CPP";
    }
    const sal = asesorSalida(o.mano);
    return sal ? sal.pensada : null;
  }

  // El resto de la mano ya es cosa del sistema.
  if (cfg.sistema === "ninguno") return null;
  const sistema = sistemaEnJuego(cfg, o.sistemaJugada);
  const mano = fichas(o.mano);
  const cuantas = n => mano.filter(x => x[0] === n || x[1] === n).length;

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

/* ---------- leer a un combinado: deducir, no mirar la marca ----------
   La marca Clas/Mod de una jugada es informacion DEL QUE LA JUEGA: le sirve
   para calcular su propia pensada. En la mesa, cuando tu companero juega CPP
   no sabes si habla del numero que castiga o del que genera; deducirlo es la
   habilidad. Por eso, al leer a un combinado NO se mira su marca: se calculan
   LAS DOS lecturas y se reparte el peso entre ellas.

   La formula vive aqui y solo aqui, porque la vamos a afinar con partidas
   reales:

     pesoModerno = base - caida * avance + dominio * (puntasSuyas - ajenas)/2
     pesoClasico = 1 - pesoModerno

   · avance  va de 0 (su primera ficha) a 1 (la septima): cuantas lleva puestas
     ese jugador. Al principio de la mano se informa lo que se TIENE, que es
     moderno; segun se cierra, lo que se CASTIGA, que es clasico.
   · dominio son las dos puntas abiertas ANTES de esa jugada: cuantas las puso
     su pareja menos cuantas la contraria, de -2 a +2. Quien lleva la mano
     informa en moderno; quien defiende, en clasico.
   · el resultado se recorta a [min, max]: ninguna de las dos lecturas se
     descarta nunca del todo, porque nunca se sabe con certeza.

   Donde SI coinciden las dos lecturas es en el doble: ahi el numero castigado
   y el generado son el mismo, los dos sistemas dicen lo mismo y la lectura es
   firme (peso 1). En ficha mixta hablan siempre de numeros distintos, asi que
   el peso se reparte siempre. */
const PESOS_COMBINADO = { base: 0.75, caida: 0.50, dominio: 0.12, min: 0.10, max: 0.90 };

function pesoModernoEn(avance, dominio) {
  const K = PESOS_COMBINADO;
  const v = K.base - K.caida * avance + K.dominio * (dominio / 2);
  return +Math.min(K.max, Math.max(K.min, v)).toFixed(3);
}
const mismoEquipo = (a, b) => a !== null && b !== null && (a - b) % 2 === 0;

/* ================= QUE SISTEMA LLEVA CADA CONTRARIO =================
   Asimetria de informacion, que es la que hay en la mesa:
   · el sistema del COMPAnERO se sabe, porque se acordo antes de jugar;
   · el de los CONTRARIOS no. Hay que deducirlo viendolos jugar, incluido si
     usan alguno. Mirar su configuracion seria como verles las fichas.

   ---------------- LA FORMULA, EN UN SOLO SITIO ----------------
   Creencia inicial = frecuencias reales de la mesa (la mayoria juega clasico,
   bastantes ninguno, los avanzados combinado, moderno es el menos visto).

   Por cada jugada SUYA que no sea la salida (la salida la marca el convenio de
   la mesa, no su sistema), se mira que AFIRMA esa pensada segun cada sistema y
   si lo afirmado se cumple DESPUES:
     clasico  CPP -> "me quedan mas del numero que castigo"
              SPP -> "esa era mi ultima de ese numero"
     moderno  SPP -> "tengo fuerza en el numero que genero"
              CPP -> "no tengo fuerza en el que genero"
     doble    los dos dicen lo mismo, asi que no distingue
   Confirma si luego juega ese numero (o pasa a el, segun lo afirmado);
   contradice si hace lo contrario. Jugar en COMBINADO confirma si lo hace
   cualquiera de los dos y solo se contradice si fallan los dos.
   Una jugada SIN pensada es la senal mas fuerte de NINGUNO.

   No todas las jugadas valen igual: entre clasico y moderno cuenta solo lo
   que las SEPARA. Si las dos lecturas corren la misma suerte, la jugada no
   distingue y vale cero. Medido sobre 30 manos por sistema: de unas 5 jugadas
   marcadas por mano, ~1.1 son dobles (los dos sistemas dicen lo mismo), ~1.9
   salen empatadas y solo ~2.4 separan de verdad -- y de esas, el 60% apunta
   al sistema correcto.

   Cada jugada multiplica la creencia por (1 + FUERZA * evidencia) y se
   renormaliza. FUERZA es lo unico que hay que tocar para afinarla. */
const PRIOR_SISTEMA = { clasico: 0.45, ninguno: 0.30, combinado: 0.15, moderno: 0.10 };
const FUERZA_EVIDENCIA = 0.55;      // cuanto mueve una jugada
const PISO_CREENCIA = 0.02;         // ningun sistema se descarta del todo

/* Que afirma esa pensada leida con ese sistema. umbral = cuantas fichas de ese
   numero hacen falta despues para considerarlo desmentido. */
function _afirmaSistema(sistema, s) {
  const t = ficha(s.ficha);
  if (!t) return null;
  if (t[0] === t[1]) return { n: t[0], tiene: s.pensada === "CPP", umbral: 1, doble: true };
  if (sistema === "clasico") {
    if (s.castiga === null || s.castiga === undefined) return null;
    return { n: s.castiga, tiene: s.pensada === "CPP", umbral: 1 };
  }
  const g = (s.genera || [])[0];
  if (g === null || g === undefined) return null;
  // moderno: SPP dice fuerza; CPP solo dice que NO la tiene, asi que hace
  // falta mas de una ficha despues para desmentirlo
  return { n: g, tiene: s.pensada === "SPP", umbral: 2 };
}
function _compruebaAfirmacion(af, despues, pasesDespues) {
  if (!af) return 0;
  let cuantas = 0;
  despues.forEach(j => { const t = ficha(j.ficha); if (t && (t[0] === af.n || t[1] === af.n)) cuantas++; });
  const paso = pasesDespues.some(p => (p.ends || []).indexOf(af.n) >= 0);
  if (af.tiene) { if (cuantas >= 1) return 1; if (paso) return -1; return 0; }
  if (cuantas >= af.umbral) return -1;
  if (paso) return 1;
  return 0;
}

/* creenciaSistemas(secuencia, pases) -> {0:{prob,mejor,aciertos,fallos,marcadas,notas}, ...}
   Solo mira lo que se ve en la mesa: nunca recibe la configuracion de nadie. */
function creenciaSistemas(secuencia, pases) {
  const sec = (secuencia || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const pas = (pases || []).slice();
  const r = {};
  [0, 1, 2, 3].forEach(j => {
    const prob = Object.assign({}, PRIOR_SISTEMA);
    let marcadas = 0, aciertos = 0, fallos = 0, sinMarca = 0, diagnosticas = 0;
    let apuntanC = 0, apuntanM = 0;
    const notas = [];
    sec.forEach(s => {
      if (s.jugador !== j) return;
      const esSalida = s.castiga === null || s.castiga === undefined;
      if (esSalida) return;                       // la salida la manda el convenio
      const despues = sec.filter(x => x.jugador === j && (x.orden || 0) > (s.orden || 0));
      const pd = pas.filter(x => x.jugador === j && (x.orden || 0) > (s.orden || 0));
      let ev;
      if (!s.pensada) {
        sinMarca++;
        notas.push({ ficha: s.ficha, pensada: null, diagnostica: true, apunta: "ninguno", separacion: 1 });
        ev = { clasico: -1, moderno: -1, combinado: -1, ninguno: 1 };
      }
      else {
        marcadas++;
        const eC = _compruebaAfirmacion(_afirmaSistema("clasico", s), despues, pd);
        const eM = _compruebaAfirmacion(_afirmaSistema("moderno", s), despues, pd);
        /* ------- CUANTO DISCRIMINA ESTA JUGADA -------
           La mayoria de las jugadas NO distinguen: en un doble los dos
           sistemas dicen literalmente lo mismo, y en muchas otras lo que
           afirman se cumple (o falla) a la vez. Esas no informan de nada y
           tienen que valer CERO, por mas que se repitan. Solo separa cuando
           a uno le sale bien y al otro no: entonces la jugada vale lo que se
           alejen sus veredictos. Una diagnostica pesa mas que diez indiferentes. */
        const separacion = Math.abs(eC - eM) / 2;       // 0, 0.5 o 1
        const diagnostica = separacion > 0;
        if (diagnostica) diagnosticas++;
        const apunta = eC > eM ? "clasico" : eM > eC ? "moderno" : null;
        if (apunta === "clasico") apuntanC++;
        if (apunta === "moderno") apuntanM++;
        /* El combinado NO se confirma por "encaja cualquiera de los dos": asi
           siempre gana y se convierte en un sumidero (medido: se llevaba ~0.42
           fuera cual fuera el sistema real). Lo que de verdad delata a un
           combinado es ALTERNAR: unas jugadas apuntan a clasico y otras a
           moderno. Eso se decide al final, con todas a la vista, no jugada a
           jugada. Aqui solo se desmiente si fallan los dos.
           El ninguno gana cuando no encaja nada. */
        const eComb = (eC < 0 && eM < 0) ? -1 : 0;
        const eN = (eC < 0 && eM < 0) ? 1 : ((eC > 0 || eM > 0) ? -0.5 : 0);
        if (eC > 0 || eM > 0) aciertos++;
        if (eC < 0 && eM < 0) fallos++;
        notas.push({ ficha: s.ficha, pensada: s.pensada, diagnostica: diagnostica,
                     apunta: apunta, separacion: separacion });
        ev = { clasico: (eC - eM) / 2, moderno: (eM - eC) / 2,
               combinado: eComb, ninguno: eN };
      }
      Object.keys(prob).forEach(k => {
        prob[k] = Math.max(PISO_CREENCIA, prob[k] * (1 + FUERZA_EVIDENCIA * ev[k]));
      });
      const suma = Object.keys(prob).reduce((a, k) => a + prob[k], 0);
      Object.keys(prob).forEach(k => { prob[k] = prob[k] / suma; });
    });
    /* ------- ALTERNAR ES LA FIRMA DEL COMBINADO -------
       Con todas las jugadas diagnosticas a la vista: si unas apuntan a clasico
       y otras a moderno, es que va cambiando. Si todas apuntan al mismo lado,
       no es combinado por mucho que cada jugada encajase con algo. */
    const dia = apuntanC + apuntanM;
    if (dia >= 2) {
      const mezcla = Math.min(apuntanC, apuntanM) / dia;   // 0 = siempre lo mismo, 0.5 = mitad y mitad
      prob.combinado = Math.max(PISO_CREENCIA, prob.combinado * (1 + FUERZA_EVIDENCIA * (4 * mezcla - 1)));
      const suma2 = Object.keys(prob).reduce((a, k) => a + prob[k], 0);
      Object.keys(prob).forEach(k => { prob[k] = prob[k] / suma2; });
    }
    Object.keys(prob).forEach(k => { prob[k] = +prob[k].toFixed(4); });
    const mejor = Object.keys(prob).reduce((a, b) => (prob[b] > prob[a] ? b : a));
    r[j] = { prob: prob, mejor: mejor, aciertos: aciertos, fallos: fallos,
             marcadas: marcadas, sinMarca: sinMarca, jugadas: marcadas + sinMarca,
             diagnosticas: diagnosticas, apuntanC: apuntanC, apuntanM: apuntanM,
             notas: notas };
  });
  return r;
}

/* Lee las pensadas ya anotadas y devuelve lo que declaran sus autores.
   Cada pensada se lee con la CONFIGURACION DE QUIEN LA JUGO y con el sistema
   que quedo registrado en esa jugada, nunca con la del que lee.
   La salida por calidad no habla de un palo sino de la mano: va a `juego`. */
/* La creencia sobre un contrario se traduce en cuanto pesa cada lectura:
   lo que diria el clasico pesa P(clasico) mas la parte clasica del combinado,
   y lo mismo del otro lado. P(ninguno) no aporta nada, que es justo lo que
   significa: ese no esta diciendo nada. */
function _pesosDesdeCreencia(prob, pm) {
  return { clasico: (prob.clasico || 0) + (prob.combinado || 0) * (1 - pm),
           moderno: (prob.moderno || 0) + (prob.combinado || 0) * pm };
}

function leerPensadas(secuencia, sistemas, opciones) {
  const o = opciones || {};
  const creencias = o.creencias || null;
  // el convenio de salida es de la mesa; o.convenio lo trae desde la partida
  const convenioMesa = s2 => convenioSalida(o.convenio, s2);
  // Los cajones son Mapa numero -> peso. Una lectura sin ambiguedad pesa 1, asi
  // que quien juega clasico o moderno se lee exactamente igual que antes.
  const vacio = () => ({ tieneMas: new Map(), noTiene: new Map(), fuerte: new Map(), juego: null });
  const por = { 0: vacio(), 1: vacio(), 2: vacio(), 3: vacio() };
  const anota = (j, cual, n, peso) => {
    const m = por[j][cual];
    if (!m.has(n) || m.get(n) < peso) m.set(n, peso);
  };
  const notas = [];

  // estado que hace falta para ponderar: cuantas lleva jugadas cada uno y
  // quien puso cada punta, ambos ANTES de la jugada que se esta leyendo
  const puestas = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let duenoPunta = [null, null];

  (secuencia || []).forEach(s => {
    const cfg = configJugador((sistemas || {})[s.jugador]);
    const t = ficha(s.ficha);
    const esSalida = s.castiga === null || s.castiga === undefined;
    const avance = Math.min(1, puestas[s.jugador] / 6);
    const dominio = [0, 1].reduce((d, i) => d + (duenoPunta[i] === null ? 0
      : mismoEquipo(duenoPunta[i], s.jugador) ? 1 : -1), 0);
    // avanzar el estado para la siguiente, pase lo que pase con esta
    const tras = () => {
      if (!t) return;
      puestas[s.jugador]++;
      if (esSalida) duenoPunta = [s.jugador, s.jugador];
      else duenoPunta[s.punta === "I" ? 0 : 1] = s.jugador;
    };

    if (!s.pensada || !t) { tras(); return; }
    /* De quien hay creencia se deduce SIEMPRE: su configuracion no se mira.
       Del resto (yo y mi companero) se usa lo acordado antes de jugar. */
    const cre = creencias ? creencias[s.jugador] : null;
    // la salida se lee por su convencion; el resto de la mano, por el sistema
    const creeNinguno = cre && cre.mejor === "ninguno" && (cre.prob.ninguno || 0) > 0.6;
    if (esSalida ? convenioMesa(cfg) === "ninguna"
                 : (cre ? creeNinguno : cfg.sistema === "ninguno")) { tras(); return; }

    const gen = (s.genera || [])[0];
    const doble = t[0] === t[1];
    // la marca Clas/Mod solo vale para las jugadas del propio lector
    const propia = o.yo !== undefined && o.yo !== null && s.jugador === o.yo;
    const deduce = !!cre || (cfg.sistema === "combinado" && !propia);
    const sis = sistemaEnJuego(cfg, propia ? s.sistema : null);

    let n = null, dice = null, opcs = null, coinciden = false;

    if (esSalida && convenioMesa(cfg) === "calidad") {
      por[s.jugador].juego = s.pensada === "SPP" ? "bueno" : "malo";
      dice = s.pensada === "SPP" ? "salio declarando buen juego"
                                 : "salio declarando juego malo o complicado";
    } else if (doble) {
      // los dos sistemas dicen lo mismo: lectura firme, sin ambiguedad
      n = t[0]; coinciden = true;
      if (s.pensada === "CPP") { anota(s.jugador, "tieneMas", n, 1); dice = "tiene mas " + NOMBRE_PALO[n]; }
      else { anota(s.jugador, "noTiene", n, 1); dice = "no le quedan mas " + NOMBRE_PALO[n]; }
    } else if (esSalida) {
      /* Salida mixta por fuerza: la marca del asesor habla del acompañamiento
         de la ficha con la que sale, no de un numero de la mesa, asi que no se
         le atribuye un palo concreto. Se deja la nota y nada mas. */
      dice = s.pensada === "SPP" ? "salio sin pensada previa" : "salio con pensada previa";
    } else if (deduce) {
      const pm0 = pesoModernoEn(avance, dominio);
      // con creencia, el reparto sale de ella; si no, de la doctrina
      const w = cre ? _pesosDesdeCreencia(cre.prob, pm0) : { clasico: 1 - pm0, moderno: pm0 };
      const total = w.clasico + w.moderno;
      const pm = +(total ? w.moderno / total : pm0).toFixed(3);
      const pc = +(1 - pm).toFixed(3);
      opcs = [];
      if (gen !== null && gen !== undefined) {
        if (s.pensada === "SPP") anota(s.jugador, "fuerte", gen, pm);
        opcs.push({ sistema: "moderno", numero: gen, peso: pm,
          dice: (s.pensada === "SPP" ? "tiene fuerza en " : "no tiene fuerza en ") + NOMBRE_PALO[gen] });
      }
      if (s.castiga !== null && s.castiga !== undefined) {
        if (s.pensada === "CPP") anota(s.jugador, "tieneMas", s.castiga, pc);
        else anota(s.jugador, "noTiene", s.castiga, pc);
        opcs.push({ sistema: "clasico", numero: s.castiga, peso: pc,
          dice: (s.pensada === "CPP" ? "le quedan mas " : "esa era su ultima de ") + NOMBRE_PALO[s.castiga] });
      }
      opcs.sort((a, b) => b.peso - a.peso);
      coinciden = opcs.length === 2 && opcs[0].numero === opcs[1].numero;
      if (coinciden) opcs.forEach(x => { x.peso = 1; });
      if (opcs.length) { n = opcs[0].numero; dice = opcs[0].dice; }
    } else if (sis === "clasico") {
      n = s.castiga;
      if (n === null || n === undefined) { tras(); return; }
      if (s.pensada === "CPP") { anota(s.jugador, "tieneMas", n, 1); dice = "tiene mas " + NOMBRE_PALO[n]; }
      else { anota(s.jugador, "noTiene", n, 1); dice = "esa era su ultima de " + NOMBRE_PALO[n]; }
    } else {                                   // moderno
      n = gen;
      if (n === null || n === undefined) { tras(); return; }
      if (s.pensada === "SPP") { anota(s.jugador, "fuerte", n, 1); dice = "tiene fuerza en " + NOMBRE_PALO[n]; }
      else { dice = "sin fuerza en " + NOMBRE_PALO[n]; }
    }

    notas.push({ jugador: s.jugador, ficha: s.ficha, pensada: s.pensada,
                 sistema: deduce ? null : sis,
                 sistemaDeclarado: cre ? "creencia" : cfg.sistema,
                 creencia: cre ? cre.prob : null,
                 convencion: esSalida ? convenioMesa(cfg) : null, esSalida: esSalida,
                 deducida: !!deduce, opciones: opcs, coinciden: coinciden,
                 avance: +avance.toFixed(3), dominio: dominio,
                 numero: n, dice: dice });
    tras();
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
  repetirSalidaCalidad:   10,   // §6  salio SPP por calidad: buen juego, pero no dice el palo
  iniciativaPropia:        3,   // §6  salio CPP por calidad: toma tu la mano
  dificultarBuenJuego:     8,   // P10 extra si un contrario declaro buen juego
                                // (en 3 no llegaba a decidir nada: ver tests/calibrar.js)
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
    if (x.paso) { pases.push({ jugador: x.jugador, ends: ends ? ends.slice() : null, orden: i }); return; }
    const t = ficha(x.ficha);
    if (!t) throw new Error("jugada " + i + ": ficha invalida " + x.ficha);
    if (ends === null) {                       // la salida genera sus dos numeros
      ends = [t[0], t[1]];
      secuencia.push({ jugador: x.jugador, ficha: nombreFicha(t), castiga: null,
                       genera: t[0] === t[1] ? [t[0]] : [t[0], t[1]], ends: ends.slice(), orden: i });
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
                     castiga: castiga, genera: [genera], ends: ends.slice(), orden: i });
  });
  return { ends: ends, secuencia: secuencia, pases: pases };
}

/* Cuanto lleva jugado un asiento (0 = su primera ficha, 1 = la septima) y
   cuantas de las dos puntas abiertas las puso su pareja menos las que puso la
   contraria. Son los dos ingredientes de PESOS_COMBINADO. */
function avanceYDominio(secuencia, yo) {
  let puestas = 0;
  let duenoPunta = [null, null];
  (secuencia || []).forEach(s => {
    if (s.jugador === yo) puestas++;
    if (s.castiga === null || s.castiga === undefined) duenoPunta = [s.jugador, s.jugador];
    else duenoPunta[s.punta === "I" ? 0 : 1] = s.jugador;
  });
  const dominio = [0, 1].reduce((d, i) => d + (duenoPunta[i] === null ? 0
    : mismoEquipo(duenoPunta[i], yo) ? 1 : -1), 0);
  return { avance: Math.min(1, puestas / 6), dominio: dominio };
}

/* Con que sistema juega un combinado ESTA jugada. No se declara: lo decide la
   doctrina (moderno al principio y llevando la mano, clasico segun cierra y
   defendiendo). Devuelve tambien el porque, para poder explicarlo. */
function sistemaPorDoctrina(secuencia, yo, cfg) {
  const c = configJugador(cfg);
  if (c.sistema !== "combinado") return { sistema: c.sistema === "ninguno" ? null : c.sistema, motivo: null };
  const ctx = avanceYDominio(secuencia, yo);
  const pm = pesoModernoEn(ctx.avance, ctx.dominio);
  const porTiempo = ctx.avance < 0.5 ? "es temprano en la mano" : "la mano va cerrando";
  const porMando = ctx.dominio > 0 ? "llevas tu la mano" : ctx.dominio < 0 ? "estas defendiendo" : null;
  return { sistema: pm >= 0.5 ? "moderno" : "clasico",
           motivo: porMando ? porTiempo + " y " + porMando : porTiempo };
}

/* ---------- la pensada que acompana a la jugada ----------
   En esta escuela la ficha y la pensada son UNA sola decision: no basta con
   decir que ficha, hay que decir si se juega CPP o SPP y, en combinado, con
   que sistema conviene jugarla.

   Devuelve {marca, sistema, texto, aviso} o null si ese jugador no marca.
   `m` es la jugada elegida; con ends=null es la salida. */
function pensadaSugerida(estado, m, secuencia) {
  const yo = estado.yo;
  const cfg = configJugador((estado.sistemas || {})[yo]);
  const convenio = convenioSalida(estado.convenio, cfg);
  const esSalida = !m || m.castiga === null || m.castiga === undefined;
  if (esSalida ? convenio === "ninguna" : cfg.sistema === "ninguno") return null;

  // En combinado la doctrina elige con cual conviene jugarla: moderno al
  // principio y llevando la mano, clasico segun cierra y defendiendo.
  let sistema = cfg.sistema, motivoSistema = null;
  if (cfg.sistema === "combinado" && !esSalida) {
    const d = sistemaPorDoctrina(secuencia, yo, cfg);
    sistema = d.sistema; motivoSistema = d.motivo;
  }

  const marca = pensadaPara({
    ficha: m.ficha, numeroCastigado: esSalida ? null : m.castiga,
    numeroGenerado: esSalida ? null : m.genera, mano: estado.miMano,
    sistema: cfg, sistemaJugada: sistema, salida: convenio,
    jugadas: (secuencia || []).map(x => x.ficha),
  });
  if (!marca) return null;

  // el porque, en lenguaje de mesa
  const t = ficha(m.ficha);
  const doble = t && t[0] === t[1];
  let texto;
  if (esSalida) {
    texto = convenio === "calidad"
      ? (marca === "SPP" ? "tu mano es buena" : "tu mano no es de las buenas")
      : (marca === "SPP" ? "sales sin acompanamiento" : "sales con acompanamiento");
  } else if (doble) {
    texto = marca === "CPP" ? "te quedan mas " + NOMBRE_PALO[m.castiga] + " aparte del doble"
                            : "el doble era tu unica de " + NOMBRE_PALO[m.castiga];
  } else if (sistema === "clasico") {
    texto = marca === "CPP" ? "te quedan mas " + NOMBRE_PALO[m.castiga]
                            : "esa era tu ultima de " + NOMBRE_PALO[m.castiga];
  } else {
    texto = marca === "SPP" ? "tienes fuerza en " + NOMBRE_PALO[m.genera]
                            : "no tienes fuerza en " + NOMBRE_PALO[m.genera];
  }

  /* Si el companero juega sin sistema no va a leer la marca: se dice en vez de
     dejar creer que informa algo. Los contrarios si la leen, asi que no se
     suprime la pensada: solo se avisa. */
  const cfgComp = configJugador((estado.sistemas || {})[(yo + 2) % 4]);
  const aviso = cfgComp.sistema === "ninguno"
    ? "tu companero juega sin sistema: esa marca no se la va a leer"
    : null;

  return { marca: marca, sistema: esSalida ? null : sistema, convencion: esSalida ? convenio : null,
           combinado: cfg.sistema === "combinado", motivoSistema: motivoSistema,
           texto: texto, aviso: aviso };
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
             pensada: pensadaSugerida(estado, { ficha: sal.ficha }, secuencia),
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

  /* La salida se lee con la convencion DEL QUE SALIO, no con la mia:
     · fuerza  -> salir SPP indica fuerza en ese palo (CPP a un doble no dice nada);
     · calidad -> la pensada habla de la mano entera, no del palo. */
  /* El convenio de salida es de la mesa, asi que NO se mira la configuracion
     de un salidor contrario: eso seria informacion que no se tiene. */
  const cfgSalidor = (salidorSeat === yo || salidorSeat === companero)
    ? configJugador((estado.sistemas || {})[salidorSeat]) : null;
  // la convencion de salida no depende del sistema: quien no lleva sistema en
  // partida puede haber marcado su salida igual, y se lee igual
  const salidaPorCalidad = convenioSalida(estado.convenio, cfgSalidor) === "calidad";
  const paloSalidaFuerte = (salidorCompanero && !salidaPorCalidad && sal.pensada === "SPP" && nums) ? nums : null;
  const juegoSalidor = (salidaPorCalidad && sal.pensada) ? (sal.pensada === "SPP" ? "bueno" : "malo") : null;
  const companeroBuenJuego = salidorCompanero && juegoSalidor === "bueno";
  const companeroMalJuego  = salidorCompanero && juegoSalidor === "malo";
  const contrarioBuenJuego = salidorContrario && juegoSalidor === "bueno";
  const palosSalida = nums ? (nums[0] === nums[1] ? [nums[0]] : [nums[0], nums[1]]) : [];
  // numeros que el compañero ha tocado FUERA de la salida: esos siguen siendo
  // señal aunque su salida por calidad diga que lleva mal juego
  const otrasDelCompanero = new Set();
  secuencia.forEach(sq => {
    if (sq.jugador !== companero) return;
    if (sq.castiga === null || sq.castiga === undefined) return;   // la salida
    (sq.genera || []).forEach(g => otrasDelCompanero.add(g));
    otrasDelCompanero.add(sq.castiga);
  });

  // Lecturas de pensada: solo de quien juega con sistema y dejo marca.
  /* Se le pasa quien lee: de SUS jugadas si se sabe el sistema, de las ajenas
     se deduce. Cada lectura trae su peso (1 si no hay ambiguedad), y ese peso
     escala lo que empuja, que es justo lo que hace un jugador: fiarse menos de
     lo que no esta seguro. */
  /* A los contrarios se les deduce el sistema; al companero no hace falta,
     porque se acordo antes de jugar. */
  const creenciasContrarios = {};
  const todasLasCreencias = creenciaSistemas(secuencia, pases);
  contrarios.forEach(c => { creenciasContrarios[c] = todasLasCreencias[c]; });
  const lectura = leerPensadas(secuencia, estado.sistemas || {},
    { yo: yo, convenio: estado.convenio, creencias: creenciasContrarios });
  const peso = (j, cual, n) => {
    const m = lectura.por[j] && lectura.por[j][cual];
    return m && m.has(n) ? m.get(n) : 0;
  };
  const pesoContrario = (cual, n) => Math.max.apply(null, [0].concat(contrarios.map(c => peso(c, cual, n))));
  const escala = (base, p) => (p ? +(base * p).toFixed(2) : 0);

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
    const nRepe = repiteGen ? m.genera : repiteCas ? m.castiga : null;
    // ¿el palo repetido viene SOLO de la salida? Entonces lo que valga depende
    // de lo que declarase al salir; si lo ha vuelto a tocar, es señal aparte.
    const soloDeLaSalida = nRepe !== null && salidorCompanero &&
      palosSalida.includes(nRepe) && !otrasDelCompanero.has(nRepe);
    if (nSal !== null && nSal !== undefined)
      suma(P.repetirSalidaFuerte, "repite el " + NOMBRE_PALO[nSal] + ", la salida sin pensada de tu compañero", "P2+");
    else if (companeroBuenJuego && soloDeLaSalida)
      suma(P.repetirSalidaCalidad, "repite el " + NOMBRE_PALO[nRepe] + ", con el que tu compañero salio declarando buen juego", "P2");
    else if (companeroMalJuego && soloDeLaSalida)
      razones.push({ peso: 0, principio: "P2", texto: "repetiria el " + NOMBRE_PALO[nRepe] +
        ", pero tu compañero salio declarando juego malo: ahi no le ayudas" });
    else if (nRepe !== null)
      suma(P.repetirCompanero, "repite el " + NOMBRE_PALO[nRepe] + " que abrio tu compañero", "P2");

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
    let aprieta = false;
    if (contrarios.some(c => fallaDe[c].has(m.genera))) {
      suma(P.generarFallaContrario, "abre " + NOMBRE_PALO[m.genera] + ", numero al que fallo un contrario", "P10");
      aprieta = true;
    }
    if (contrarios.some(c => generoPor[c].has(m.genera)))
      suma(P.generarPaloContrario, "le sirve " + NOMBRE_PALO[m.genera] + " a un contrario, que lo abrio", "P10");
    if (m.nuevas[0] === m.nuevas[1]) {
      const n = m.nuevas[0];
      if (contrarios.some(c => fallaDe[c].has(n)) || tengoFuerza(n)) {
        suma(P.cuadrarBien, "cuadra a " + NOMBRE_PALO[n] + ", numero que dominas o que falla un contrario", "P10");
        aprieta = true;
      }
    }
    // el contrario salio declarando buen juego: hay que complicarselo
    if (aprieta && contrarioBuenJuego)
      suma(P.dificultarBuenJuego, "el contrario salio declarando buen juego: conviene apretarle", "P10");

    // P5/P6 y P7/P8 - por encima del contrario, por debajo del compañero
    if (salidorContrario && refSalida !== null && (m.genera > refSalida || m.castiga > refSalida))
      suma(P.encimaSalidaContrario, "va por encima del " + refSalida + " con el que salio el contrario", "P5/P6");
    if (salidorCompanero && refSalida !== null && (m.genera < refSalida || m.castiga < refSalida))
      suma(P.debajoSalidaCompanero, "va por debajo del " + refSalida + " con el que salio tu compañero", "P7/P8");

    // Lecturas de pensada (informacion legitima: la marca esta en la mesa)
    const pTiene = Math.max(peso(companero, "tieneMas", m.genera), peso(companero, "fuerte", m.genera));
    const pNoTiene = peso(companero, "noTiene", m.genera);
    if (pTiene)
      suma(escala(P.lecturaCompanero, pTiene), "tu compañero marco " + NOMBRE_PALO[m.genera] + ": ahi tiene juego" + (pTiene < 1 ? " (probable)" : ""), "pensada");
    else if (pNoTiene)
      suma(escala(P.lecturaCompaneroNo, pNoTiene), "tu compañero marco que no le quedan " + NOMBRE_PALO[m.genera] + (pNoTiene < 1 ? " (probable)" : ""), "pensada");
    // Dejar correr tambien aqui: si la ficha con la que castigaria es mi llave,
    // no la gasto. Con mas motivo si el contrario marco fuerza en ese numero:
    // la va a volver a mandar y me quedo sin con que responder.
    const pFuerteCas = pesoContrario("fuerte", m.castiga);
    if (pFuerteCas) {
      if (llave) razones.push({ peso: 0, principio: "dejar correr",
        texto: "un contrario marco fuerza en " + NOMBRE_PALO[m.castiga] + ", pero esa es tu unica ficha del palo: guardala" });
      else suma(escala(P.lecturaCastigarFuerte, pFuerteCas), "castiga " + NOMBRE_PALO[m.castiga] + ", donde un contrario marco fuerza" + (pFuerteCas < 1 ? " (probable)" : ""), "pensada");
    }
    const pFuerteGen = pesoContrario("fuerte", m.genera);
    if (pFuerteGen)
      suma(escala(P.lecturaNoDarFuerte, pFuerteGen), "le sirve " + NOMBRE_PALO[m.genera] + ", donde un contrario marco fuerza" + (pFuerteGen < 1 ? " (probable)" : ""), "pensada");
    const pCubrir = pesoContrario("tieneMas", m.castiga);
    if (pCubrir && !llave)
      suma(escala(P.lecturaCubrirContrario, pCubrir), "cubre " + NOMBRE_PALO[m.castiga] + ", que un contrario marco tener" + (pCubrir < 1 ? " (probable)" : ""), "pensada");

    // P4 - indicar lo que tienes
    if (tengoFuerza(m.genera)) {
      suma(P.generarFuerzaPropia, "abre " + NOMBRE_PALO[m.genera] + ", donde tienes fuerza", "P4");
      if (companeroMalJuego)
        suma(P.iniciativaPropia, "tu compañero salio con juego malo: lleva tu la mano por " + NOMBRE_PALO[m.genera], "P4");
    }

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
    // la ficha y la pensada son una sola decision
    pensada: pensadaSugerida(estado, mejor, secuencia),
    confianza: confianza,
    desempate: desempate,
    lecturas: lectura.notas,
    creencias: creenciasContrarios,
    porQueNo: porQueNo,
    alternativas: evaluadas.slice(1).map(m => ({ ficha: m.ficha, punta: m.punta,
      puntos: m.puntos, razones: m.razones.slice(0, 2) })),
    contrasteIA: contrasteIA,
  };
}

// Para poder probarlo con node fuera del navegador.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { analizarMano, asesorSalida, sugerirJugada, reconstruirMesa,
                     pensadaPara, leerPensadas, configJugador, sistemaEnJuego,
                     pesoModernoEn, PESOS_COMBINADO, pensadaSugerida, avanceYDominio,
                     creenciaSistemas, PRIOR_SISTEMA, FUERZA_EVIDENCIA, sistemaPorDoctrina,
                     convenioSalida, CONVENIO_DEFECTO, SISTEMAS, SALIDAS, ficha,
                     NOMBRE_PALO, ACOMP, PESOS_SUGERENCIA, PROB_DOBLES, PROB_FALLAS, FREQ_PALO };
}
