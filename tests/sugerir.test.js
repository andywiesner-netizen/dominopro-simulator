const { sugerirJugada, reconstruirMesa } = require("../conocimiento.js");
const NOM = ["A", "B", "C", "D"];

// Cada caso: quien soy, las jugadas en orden, mi mano AHORA y lo que espera el taller.
const casos = [
  { n: "Ej.14", pensada: "SPP", yo: 3,
    jug: [{ jugador: 0, ficha: "3-3" }, { jugador: 1, paso: true }, { jugador: 2, ficha: "3-1" }],
    mano: ["1-6", "1-4", "3-6", "3-2", "3-5", "4-4", "2-5"], esperado: ["3-6"] },

  { n: "Ej.16a", pensada: "SPP", yo: 3,
    jug: [{ jugador: 0, ficha: "3-3" }, { jugador: 1, ficha: "3-6" }, { jugador: 2, ficha: "6-2" }],
    mano: ["2-3", "5-4"], esperado: ["2-3"], esperadoGenera: 3 },

  { n: "Ej.16b", pensada: "SPP", yo: 0,
    jug: [{ jugador: 0, ficha: "3-3" }, { jugador: 1, ficha: "3-6" }, { jugador: 2, ficha: "6-2" },
          { jugador: 3, ficha: "2-3", punta: "I" }, { jugador: 0, ficha: "3-1" },
          { jugador: 1, ficha: "1-6" }, { jugador: 2, ficha: "3-0" }, { jugador: 3, ficha: "0-4" }],
    mano: ["6-5", "6-0", "5-2"], esperado: ["6-0"] },

  { n: "Ej.17", pensada: "CPP", yo: 2,
    jug: [{ jugador: 0, ficha: "3-3" }, { jugador: 1, ficha: "3-6" }],
    mano: ["6-2", "3-5"], esperado: ["3-5"],
    nota: "el taller dice 3-2, ficha que no esta en la mano dada; se puntua contra 3-5 ('dejar correr el 6')" },

  { n: "Ej.18", pensada: "SPP", yo: 2,
    jug: [{ jugador: 0, ficha: "2-2" }, { jugador: 1, ficha: "2-1" }],
    mano: ["2-3", "3-3", "3-4", "3-0", "1-5", "1-6", "0-4"], esperado: ["2-3"] },

  { n: "Ej.19", yo: 0,
    jug: [{ jugador: 0, ficha: "5-3" }, { jugador: 1, ficha: "5-5" }, { jugador: 2, ficha: "3-3" },
          { jugador: 3, ficha: "3-6" }],
    mano: ["5-4", "5-1", "3-0", "1-3", "2-1", "6-0"], esperado: ["5-1"] },

  { n: "Ej.20", pensada: "SPP", yo: 0,
    jug: [{ jugador: 0, ficha: "5-5" }, { jugador: 1, ficha: "5-2" }, { jugador: 2, ficha: "2-4" },
          { jugador: 3, ficha: "4-1" }],
    mano: ["5-4", "5-3", "5-0", "1-1", "2-1"], esperado: ["5-4"] },

  { n: "Ej.23", pensada: "SPP", yo: 2,
    jug: [{ jugador: 0, ficha: "3-3" }, { jugador: 1, ficha: "3-5" }, { jugador: 2, ficha: "5-4" },
          { jugador: 3, ficha: "3-2" }, { jugador: 0, ficha: "2-4", punta: "D" },
          { jugador: 1, ficha: "4-6" }],
    mano: ["6-6", "4-4", "4-3", "2-2", "0-0"], esperado: ["4-3"] },

  { n: "Ej.13", pensada: "SPP", yo: 0,
    jug: [{ jugador: 0, ficha: "5-5" }, { jugador: 1, ficha: "5-3" }, { jugador: 2, ficha: "3-3" },
          { jugador: 3, ficha: "3-6" }],
    mano: ["5-4", "5-1", "5-2", "6-2", "0-1", "2-3"], esperado: ["5-2", "5-1"] },
];

const norm = f => { const [a, b] = f.split("-").map(Number); return a <= b ? a + "-" + b : b + "-" + a; };
let aciertos = 0; const fallos = [];

console.log("caso   | mi mano                          | esperado   | sugiere        | ok | decide");
console.log("-------+----------------------------------+------------+----------------+----+------------------------");

for (const c of casos) {
  let mesa;
  try { mesa = reconstruirMesa(c.jug); }
  catch (e) { console.log(c.n.padEnd(6) + " | REPLAY INVALIDO: " + e.message); continue; }

  const r = sugerirJugada({
    yo: c.yo, miMano: c.mano, ends: mesa.ends, secuencia: mesa.secuencia, pases: mesa.pases,
    salidor: c.jug[0].jugador,
    salida: { ficha: c.jug[0].ficha, jugador: c.jug[0].jugador, pensada: c.pensada || null },
    pasesSeguidos: 0,
  });

  const esp = c.esperado.map(norm);
  let ok = r && esp.includes(r.recomendada.ficha);
  if (ok && c.esperadoGenera !== undefined) ok = r.recomendada.genera === c.esperadoGenera;
  if (ok) aciertos++;
  const decide = r && r.desempate ? r.desempate.principio+" (desempate)" : (r && r.razones.length ? r.razones[0].principio : "-");
  const gen = r ? " (gen " + r.recomendada.genera + ")" : "";
  console.log(c.n.padEnd(6) + " | " + c.mano.join(" ").padEnd(32) + " | " +
    esp.join("/").padEnd(10) + " | " + (r ? (r.recomendada.ficha + gen).padEnd(14) : "(nada)".padEnd(14)) +
    " | " + (ok ? " ok" : " NO") + " | " + decide);

  if (!ok && r) fallos.push({ c, r, mesa });
}

console.log("\nAciertos: " + aciertos + "/" + casos.length);

if (fallos.length) {
  console.log("\n================ LOS QUE NO COINCIDEN ================");
  for (const { c, r, mesa } of fallos) {
    console.log("\n--- " + c.n + " --- puntas [" + mesa.ends + "]  yo=" + NOM[c.yo] +
      "  compañero=" + NOM[(c.yo + 2) % 4]);
    if (c.nota) console.log("    nota: " + c.nota);
    console.log("    esperado: " + c.esperado.join(" o ") + "   sugiere: " + r.recomendada.ficha +
      " por la punta " + r.recomendada.punta + " (castiga " + r.recomendada.castiga +
      ", genera " + r.recomendada.genera + ")  " + r.recomendada.puntos + " ptos, confianza " + r.confianza);
    r.razones.forEach(x => console.log("       + " + x.peso + "  [" + x.principio + "] " + x.texto));
    r.contras.forEach(x => console.log("       " + x.peso + "  [" + x.principio + "] " + x.texto));
    console.log("    ranking completo:");
    [{ ficha: r.recomendada.ficha, punta: r.recomendada.punta, puntos: r.recomendada.puntos, razones: r.razones }]
      .concat(r.alternativas).forEach(a =>
        console.log("       " + a.ficha + " (" + a.punta + ")  " + String(a.puntos).padStart(6) +
          "   " + a.razones.map(z => z.principio + ":" + z.peso).join(" ")));
  }
}

console.log("\n================ DESGLOSE DE LOS QUE SI ================");
for (const c of casos) {
  if (fallos.some(f => f.c.n === c.n)) continue;
  const mesa = reconstruirMesa(c.jug);
  const r = sugerirJugada({ yo: c.yo, miMano: c.mano, ends: mesa.ends, secuencia: mesa.secuencia,
    pases: mesa.pases, salidor: c.jug[0].jugador,
    salida: { ficha: c.jug[0].ficha, jugador: c.jug[0].jugador, pensada: c.pensada || null }, pasesSeguidos: 0 });
  console.log("\n" + c.n + ": " + r.recomendada.ficha + " (genera " + r.recomendada.genera + ") " +
    r.recomendada.puntos + " ptos, confianza " + r.confianza);
  r.razones.forEach(x => console.log("   + " + x.peso + "  [" + x.principio + "] " + x.texto));
  r.contras.forEach(x => console.log("   " + x.peso + "  [" + x.principio + "] " + x.texto));
  if (r.porQueNo) console.log("   por que no: " + r.porQueNo);
}
