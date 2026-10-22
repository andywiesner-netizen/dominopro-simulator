/* ================= ARNES DEL TORNEO (no es una prueba de regresion) =======
   Corre la matriz de sistemas con los cuatro jugadores movidos por Sugerir.
   Se llama torneo.js y no torneo.test.js a proposito: no dice bien ni mal,
   mide y reporta.

   AVISO: mide NUESTRA implementacion de cada sistema, no el sistema.

   Uso:  node tests/torneo.js cordura [manos] [semilla]
         node tests/torneo.js matriz  [manos] [semilla]
*/
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8"));
const T = require("../torneo.js");

const MODO = process.argv[2] || "cordura";
const MANOS = +(process.argv[3] || 200);
const SEMILLA = +(process.argv[4] || 20261022);
const CONVENIO = "fuerza";

/* Azar propio con semilla: dos corridas tienen que dar lo mismo, y todas las
   celdas tienen que ver EXACTAMENTE los mismos repartos. Si cada celda jugara
   repartos distintos, la mitad de la diferencia seria el reparto. */
function repartidor(semilla) {
  return function (i) {
    let x = (semilla + i * 2654435761) >>> 0;
    const rnd = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    const t = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) t.push(a + "-" + b);
    for (let k = t.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [t[k], t[j]] = [t[j], t[k]]; }
    return [0, 1, 2, 3].map(p => t.slice(p * 7, p * 7 + 7));
  };
}
const repartir = repartidor(SEMILLA);

console.log("AVISO: " + T.AVISO_MATRIZ + "\n");

if (MODO === "cordura") {
  console.log("Control de cordura · " + MANOS + " manos por sistema · semilla " + SEMILLA);
  console.log("Los dos bandos con el MISMO sistema: el reparto manda.\n");
  const t0 = Date.now();
  const c = T.cordura(MANOS, repartir, CONVENIO);
  console.log("  sistema    | manos | gana 0-2 | gana quien sale | dif. puntos/mano | empates");
  console.log("  -----------+-------+----------+-----------------+------------------+--------");
  c.filas.forEach(f => {
    console.log("  " + f.sistema.padEnd(10) + " | " + String(f.manos).padStart(5) +
      " | " + (f.pctA + " %").padStart(8) + " | " + (f.pctSale + " %").padStart(15) +
      " | " + String(f.difPuntos).padStart(16) + " | " + String(f.empates).padStart(7));
  });
  console.log("\n  Esperado: gana 0-2 cerca del 50 % (el reparto es lo unico que");
  console.log("  distingue a las parejas) y gana quien sale alrededor del 60 %.");
  console.log("\n  " + (c.ok ? "CONTROL SUPERADO" : "CONTROL NO SUPERADO: hay un fallo en el arnes"));
  if (!c.ok) {
    c.malSimetria.forEach(f => console.log("    simetria rota en " + f.sistema + ": " + f.pctA + " %"));
    c.malSalidor.forEach(f => console.log("    salidor raro en " + f.sistema + ": " + f.pctSale + " %"));
  }
  const sin = c.filas.reduce((a, f) => a + f.sinConsejo, 0);
  if (sin) console.log("    jugadas sin consejo (se jugo la primera legal): " + sin);
  console.log("\n  " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
  process.exit(0);
}

console.log("Matriz de sistemas · " + MANOS + " manos por celda · semilla " + SEMILLA);
console.log("Fila = sistema de la pareja 0-2. Columna = el de la 1-3.\n");
const t0 = Date.now();
const m = T.matriz(MANOS, repartir, CONVENIO, null,
  (a, b) => process.stderr.write("  " + a + " vs " + b + "...\r"));
process.stderr.write("                                        \r");

const S = m.sistemas;
const linea = (t, f) => "  " + t.padEnd(10) + " |" + S.map(b => f(b)).join("");
console.log("  VICTORIAS de la pareja 0-2 (%)");
console.log("             |" + S.map(b => b.slice(0, 9).padStart(10)).join(""));
S.forEach(a => console.log(linea(a, b => (m.celdas[a][b].pctA + "%").padStart(10))));
console.log("\n  PUNTOS por mano, a favor de 0-2 (negativo = pierde)");
console.log("             |" + S.map(b => b.slice(0, 9).padStart(10)).join(""));
S.forEach(a => console.log(linea(a, b => String(m.celdas[a][b].difPuntos).padStart(10))));
console.log("\n  MANOS por celda: " + m.manosPorCelda + " (total " + (m.manosPorCelda * 16) + ")");

/* Lo de arriba lleva dentro el sesgo del reparto: la diagonal deberia dar
   50 % y 0 puntos, y no lo da. Esto lo cancela con el espejo. */
const sim = T.simetrizar(m);
const fila = (tabla, a2) => "  " + a2.padEnd(10) + " |" + S.map(b2 => {
  const x = tabla[a2][b2];
  return ((x > 0 ? "+" : "") + x).padStart(10);
}).join("");
console.log("\n  VENTAJA LIMPIA de la fila sobre la columna, en puntos de %");
console.log("  (la diagonal es 0 por construccion: el sesgo del reparto se cancela)");
console.log("             |" + S.map(b2 => b2.slice(0, 9).padStart(10)).join(""));
S.forEach(a2 => console.log(fila(sim.victorias, a2)));
console.log("\n  VENTAJA LIMPIA en puntos por mano, con su error (1 sigma)");
console.log("             |" + S.map(b2 => b2.slice(0, 9).padStart(15)).join(""));
S.forEach(a2 => console.log("  " + a2.padEnd(10) + " |" + S.map(b2 => {
  const x = sim.puntos[a2][b2], e = sim.errPuntos[a2][b2];
  return ((x > 0 ? "+" : "") + x + " +-" + e).padStart(15);
}).join("")));
console.log("\n  Una diferencia menor que el doble de su error no se distingue de cero.");
const err = (100 / Math.sqrt(2 * MANOS)).toFixed(2);
console.log("\n  Margen de error aproximado por celda: +-" + err + " puntos de %.");
console.log("  Una ventaja menor que eso no se distingue del ruido.");

const salida = { fecha: new Date().toISOString(), semilla: SEMILLA,
  manosPorCelda: MANOS, convenio: CONVENIO, aviso: m.aviso, celdas: m.celdas };
const destino = path.join(__dirname, "..", "resultados-matriz.json");
fs.writeFileSync(destino, JSON.stringify(salida, null, 1));
console.log("  Guardado en resultados-matriz.json, para comparar entre versiones.");
console.log("\n  " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
