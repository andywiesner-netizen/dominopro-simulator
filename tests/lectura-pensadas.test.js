/* Segunda corrida de la regresión: con sistemas asignados y las pensadas
   CALCULADAS (no inventadas) a partir de las manos que da el enunciado.
   Solo se puede hacer en los ejercicios donde el taller publica las manos de
   los cuatro jugadores: Ej.16a, Ej.16b y Ej.17. En los demás únicamente se
   conoce mi propia mano, así que anotar la pensada ajena sería inventarla. */
const { sugerirJugada, reconstruirMesa, pensadaPara } = require("../conocimiento.js");
const NOM = ["A", "B", "C", "D"];

// Manos completas publicadas por el taller para el Ej.16 / Ej.17.
const MANOS_16 = { 0: ["3-3","3-1","6-5","6-0","5-2"], 1: ["6-3","6-1","6-6","6-4"],
                   2: ["6-2","3-5","3-0"],             3: ["2-3","5-4"] };
const MANOS_17 = { 0: ["3-3","3-1","6-5","6-0","5-2"], 1: ["6-3","6-1","6-6"],
                   2: ["6-2","3-5"],                   3: ["2-3","5-4","6-4"] };

const casos = [
  { n: "Ej.16a", yo: 3, manos: MANOS_16,
    jug: [{jugador:0,ficha:"3-3"},{jugador:1,ficha:"3-6"},{jugador:2,ficha:"6-2"}],
    mano: ["2-3","5-4"], esperado: ["2-3"], esperadoGenera: 3 },
  { n: "Ej.16b", yo: 0, manos: MANOS_16,
    jug: [{jugador:0,ficha:"3-3"},{jugador:1,ficha:"3-6"},{jugador:2,ficha:"6-2"},
          {jugador:3,ficha:"2-3",punta:"I"},{jugador:0,ficha:"3-1"},{jugador:1,ficha:"1-6"},
          {jugador:2,ficha:"3-0"},{jugador:3,ficha:"0-4"}],
    mano: ["6-5","6-0","5-2"], esperado: ["6-0"] },
  { n: "Ej.17", yo: 2, manos: MANOS_17,
    jug: [{jugador:0,ficha:"3-3"},{jugador:1,ficha:"3-6"}],
    mano: ["6-2","3-5"], esperado: ["3-5"] },
];

// Reparte sistemas y CALCULA la pensada de cada jugada con la mano que tenía
// su autor en ese momento. Nada se anota a mano.
function anotar(caso, sistemas) {
  const restantes = {}; [0,1,2,3].forEach(p => restantes[p] = (caso.manos[p] || []).slice());
  const puestas = [];
  let ends = null;
  const marcas = [];
  for (const j of caso.jug) {
    if (j.paso) { marcas.push(null); continue; }
    const parcial = reconstruirMesa(caso.jug.slice(0, caso.jug.indexOf(j) + 1));
    const ult = parcial.secuencia[parcial.secuencia.length - 1];
    const pen = pensadaPara({ ficha: j.ficha, numeroCastigado: ult.castiga,
      numeroGenerado: (ult.genera || [])[0], mano: restantes[j.jugador],
      sistema: sistemas[j.jugador], jugadas: puestas.slice() });
    marcas.push(pen);
    const i = restantes[j.jugador].findIndex(f => {
      const [a,b] = f.split("-").map(Number), [c,d] = j.ficha.split("-").map(Number);
      return (a===c&&b===d)||(a===d&&b===c);
    });
    if (i >= 0) restantes[j.jugador].splice(i, 1);
    puestas.push(j.ficha);
  }
  return marcas;
}

function correr(titulo, sistemas) {
  console.log("\n=== " + titulo + " ===");
  console.log("caso   | esperada | sugerida | ok | decide            | pensadas leidas");
  console.log("-------+----------+----------+----+-------------------+----------------------------");
  let ok = 0;
  for (const c of casos) {
    const mesa = reconstruirMesa(c.jug);
    const marcas = anotar(c, sistemas);
    let k = 0; mesa.secuencia.forEach(sq => { while (c.jug[k] && c.jug[k].paso) k++; sq.pensada = marcas[k]; k++; });
    const prim = c.jug.find(x => !x.paso), iPrim = c.jug.indexOf(prim);
    const r = sugerirJugada({ yo: c.yo, miMano: c.mano, ends: mesa.ends, secuencia: mesa.secuencia,
      pases: mesa.pases, salidor: prim.jugador,
      salida: { ficha: prim.ficha, jugador: prim.jugador, pensada: marcas[iPrim] },
      sistemas: sistemas, pasesSeguidos: 0 });
    const norm = f => { const [a,b] = f.split("-").map(Number); return a<=b ? a+"-"+b : b+"-"+a; };
    let bien = r && c.esperado.map(norm).includes(r.recomendada.ficha);
    if (bien && c.esperadoGenera !== undefined) bien = r.recomendada.genera === c.esperadoGenera;
    if (bien) ok++;
    const decide = r.desempate ? r.desempate.principio + " (des)" : (r.razones[0] ? r.razones[0].principio : "-");
    const leidas = (r.lecturas || []).map(x => NOM[x.jugador] + " " + x.ficha + " " + x.pensada).join(", ") || "(ninguna)";
    console.log(c.n.padEnd(6) + " | " + c.esperado.map(norm).join("/").padEnd(8) + " | " +
      r.recomendada.ficha.padEnd(8) + " | " + (bien ? " ok" : " NO") + " | " +
      decide.padEnd(17) + " | " + leidas);
  }
  console.log("Aciertos: " + ok + "/" + casos.length);
  return ok;
}

const nada = { 0: "ninguno", 1: "ninguno", 2: "ninguno", 3: "ninguno" };
const mixto = { 0: "clasico", 1: "moderno", 2: "clasico", 3: "moderno" };
const a = correr("sistemas 'ninguno' (linea base)", nada);
const b = correr("sistemas mezclados (A,C clasico / B,D moderno)", mixto);
console.log("\n" + (a === b ? "Mismas decisiones en las dos corridas." :
  "Las lecturas de pensada cambiaron alguna decision (ver arriba)."));
process.exit(0);
