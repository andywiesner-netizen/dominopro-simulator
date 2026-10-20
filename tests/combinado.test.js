/* ================= LECTURA DEL SISTEMA COMBINADO =================
   Principio: la marca Clas/Mod de una jugada es informacion DEL QUE LA JUEGA.
   Al leer a otro que juega combinado no se sabe con cual iba, asi que hay que
   DEDUCIR: se calculan las dos lecturas y se reparte el peso. Mirar su marca
   seria como verle la mano. */
const C = require("../conocimiento.js");

let fallos = 0;
const t = (nombre, cond, extra) => {
  if (!cond) { fallos++; console.log("  FALLA  " + nombre + (extra ? "\n           " + extra : "")); }
  else console.log("  ok     " + nombre);
};
const eq = (nombre, a, b) => t(nombre, JSON.stringify(a) === JSON.stringify(b),
  "obtenido " + JSON.stringify(a) + "\n           esperado " + JSON.stringify(b));

const COMB = { sistema: "combinado", combinado: { inicial: "moderno" } };

/* Una jugada: E castiga el 6 y genera el 2 con el 6-2, marcando CPP.
   · en clasico eso dice "le quedan mas seises"  (habla del castigado)
   · en moderno eso dice "no tiene fuerza en doses" (habla del generado)
   relleno sirve para situar la jugada mas tarde en la mano: son jugadas sin
   pensada del mismo jugador, que solo gastan fichas suyas. */
function secuencia(relleno, dominioDe) {
  const sq = [];
  // la salida fija de quien son las dos puntas (sirve para el ajuste por dominio)
  sq.push({ jugador: dominioDe, ficha: "4-4", castiga: null, genera: [4], ends: [4, 4], pensada: null });
  for (let i = 0; i < relleno; i++)
    sq.push({ jugador: 1, ficha: "0-1", castiga: 0, genera: [1], punta: "D", ends: [4, 1], pensada: null });
  sq.push({ jugador: 1, ficha: "6-2", castiga: 6, genera: [2], punta: "D", ends: [4, 2], pensada: "CPP" });
  return sq;
}

console.log("\n--- una CPP de un combinado produce LAS DOS lecturas ---");
const pronto = C.leerPensadas(secuencia(0, 1), { 1: COMB });
const nota = pronto.notas[0];
t("la nota viene marcada como deducida", nota.deducida === true, JSON.stringify(nota));
t("no se afirma ningun sistema", nota.sistema === null, String(nota.sistema));
eq("dos opciones, moderna y clasica", nota.opciones.map(o => o.sistema).sort(), ["clasico", "moderno"]);
const porSis = s => nota.opciones.find(o => o.sistema === s);
eq("la moderna habla del numero GENERADO (2)", porSis("moderno").numero, 2);
eq("la clasica habla del numero CASTIGADO (6)", porSis("clasico").numero, 6);
t("los pesos suman 1", Math.abs(porSis("moderno").peso + porSis("clasico").peso - 1) < 1e-9,
  porSis("moderno").peso + " + " + porSis("clasico").peso);
console.log("         moderno: " + porSis("moderno").dice + "  (" + porSis("moderno").peso + ")");
console.log("         clasico: " + porSis("clasico").dice + "  (" + porSis("clasico").peso + ")");

console.log("\n--- el peso se inclina a moderna al principio y a clasica al final ---");
const pesoMod = sq => {
  const n = C.leerPensadas(sq, { 1: COMB }).notas[0];
  return n.opciones.find(o => o.sistema === "moderno").peso;
};
const alPrincipio = pesoMod(secuencia(0, 1));
const aMitad = pesoMod(secuencia(3, 1));
const alFinal = pesoMod(secuencia(6, 1));
console.log("         1a ficha " + alPrincipio + "  ·  4a " + aMitad + "  ·  7a " + alFinal);
t("al principio manda la moderna", alPrincipio > 0.5, String(alPrincipio));
t("al final manda la clasica", alFinal < 0.5, String(alFinal));
t("y baja de forma monotona", alPrincipio > aMitad && aMitad > alFinal,
  [alPrincipio, aMitad, alFinal].join(" > "));

console.log("\n--- quien domina las puntas tira hacia moderna ---");
// mismas jugadas, pero la salida (y por tanto las dos puntas) es de su pareja
// (3 es companero de 1) o de un contrario (0 lo es de 1)
const conDominio = pesoMod(secuencia(3, 3));
const sinDominio = pesoMod(secuencia(3, 0));
console.log("         puntas suyas " + conDominio + "  ·  puntas del contrario " + sinDominio);
t("llevando la mano pesa mas la moderna", conDominio > sinDominio,
  conDominio + " vs " + sinDominio);

console.log("\n--- cuando las dos coinciden, la lectura es firme ---");
/* Solo coinciden en el doble: ahi castigado y generado son el mismo numero y
   los dos sistemas dicen lo mismo. */
const dobleComb = C.leerPensadas(
  [{ jugador: 1, ficha: "6-6", castiga: 6, genera: [6], punta: "D", ends: [4, 6], pensada: "CPP" }],
  { 1: COMB });
t("el doble se lee sin ambiguedad", dobleComb.notas[0].coinciden === true, JSON.stringify(dobleComb.notas[0]));
eq("y con certeza entera", dobleComb.por[1].tieneMas.get(6), 1);
const mixtaComb = C.leerPensadas(secuencia(3, 1), { 1: COMB });
t("la mixta pesa menos que el doble",
  mixtaComb.por[1].tieneMas.get(6) < dobleComb.por[1].tieneMas.get(6),
  mixtaComb.por[1].tieneMas.get(6) + " vs " + dobleComb.por[1].tieneMas.get(6));

console.log("\n--- clasico y moderno se leen EXACTAMENTE como antes ---");
const sqMixta = [{ jugador: 1, ficha: "6-2", castiga: 6, genera: [2], punta: "D", ends: [4, 2], pensada: "CPP" }];
const cla = C.leerPensadas(sqMixta, { 1: "clasico" });
const mod = C.leerPensadas(sqMixta, { 1: "moderno" });
eq("clasico: tiene mas seises, con certeza 1", cla.por[1].tieneMas.get(6), 1);
eq("clasico no toca el generado", cla.por[1].fuerte.size + cla.por[1].noTiene.size, 0);
eq("clasico sigue diciendo lo de siempre", cla.notas[0].dice, "tiene mas seises");
t("y no es deducida", !cla.notas[0].deducida);
const sqSPP = [{ jugador: 1, ficha: "6-2", castiga: 6, genera: [2], punta: "D", ends: [4, 2], pensada: "SPP" }];
eq("moderno SPP: fuerza en doses, certeza 1",
  C.leerPensadas(sqSPP, { 1: "moderno" }).por[1].fuerte.get(2), 1);
eq("moderno CPP no afirma nada", mod.por[1].fuerte.size + mod.por[1].tieneMas.size + mod.por[1].noTiene.size, 0);
eq("moderno sigue diciendo lo de siempre", mod.notas[0].dice, "sin fuerza en doses");

console.log("\n--- el lector SI sabe con que jugo el mismo ---");
const propia = [{ jugador: 1, ficha: "6-2", castiga: 6, genera: [2], punta: "D",
                  ends: [4, 2], pensada: "CPP", sistema: "moderno" }];
const comoAjena = C.leerPensadas(propia, { 1: COMB });
const comoPropia = C.leerPensadas(propia, { 1: COMB }, { yo: 1 });
t("leida como ajena, se deduce", comoAjena.notas[0].deducida === true);
t("leida como propia, no", comoPropia.notas[0].deducida === false);
eq("y usa el sistema que quedo registrado", comoPropia.notas[0].sistema, "moderno");

/* ================= sugerirJugada no mira la marca ajena =================
   Igual que estadoPara no deja colar las fichas de los demas, Sugerir no debe
   usar el Clas/Mod de las jugadas ajenas: si lo usara, cambiar esa marca
   cambiaria el consejo. */
console.log("\n--- Sugerir ignora la marca Clas/Mod de los demas ---");
const SIST = { 0: COMB, 1: COMB, 2: COMB, 3: COMB };
const base = {
  yo: 0,
  miMano: ["6-5", "6-0", "5-2", "3-1", "2-2"],
  ends: [6, 5],
  secuencia: [
    { jugador: 2, ficha: "3-3", castiga: null, genera: [3], ends: [3, 3], pensada: "CPP", sistema: "clasico" },
    { jugador: 3, ficha: "3-6", castiga: 3, genera: [6], punta: "I", ends: [6, 3], pensada: "SPP", sistema: "moderno" },
    { jugador: 0, ficha: "3-5", castiga: 3, genera: [5], punta: "D", ends: [6, 5], pensada: "CPP", sistema: "clasico" },
  ],
  pases: [], salidor: 2,
  salida: { ficha: "3-3", jugador: 2, pensada: "CPP" },
  sistemas: SIST, pasesSeguidos: 0,
};
const consejo = e => { const r = C.sugerirJugada(e); return r ? r.recomendada.ficha + "|" + r.recomendada.punta + "|" + r.recomendada.puntos : "(nada)"; };
const original = consejo(JSON.parse(JSON.stringify(base)));

// se le da la vuelta a la marca de TODAS las jugadas ajenas
const volteada = JSON.parse(JSON.stringify(base));
volteada.secuencia.forEach(s => {
  if (s.jugador === base.yo) return;
  s.sistema = s.sistema === "clasico" ? "moderno" : "clasico";
});
// y tambien se prueba a quitarla del todo
const borrada = JSON.parse(JSON.stringify(base));
borrada.secuencia.forEach(s => { if (s.jugador !== base.yo) delete s.sistema; });

console.log("         consejo: " + original);
eq("invertir la marca ajena no cambia el consejo", consejo(volteada), original);
eq("borrarla tampoco", consejo(borrada), original);

// control: si de verdad se estuviera leyendo algo, cambiar la PENSADA ajena si
// deberia poder cambiar el consejo. Si no, la prueba de arriba no probaria nada.
const otraPensada = JSON.parse(JSON.stringify(base));
otraPensada.secuencia[1].pensada = otraPensada.secuencia[1].pensada === "SPP" ? "CPP" : "SPP";
const lect = C.leerPensadas(base.secuencia, SIST, { yo: 0 }).notas.filter(n => n.jugador !== 0);
t("control: hay lecturas ajenas que leer", lect.length > 0, JSON.stringify(lect.map(n => n.ficha)));
t("control: todas las ajenas son deducidas", lect.every(n => n.deducida),
  JSON.stringify(lect.map(n => n.ficha + ":" + n.deducida)));

console.log(fallos ? "\n" + fallos + " FALLOS" : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
