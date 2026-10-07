/* Mide al lector con el texto de entrenamiento: cada caso trae renglones de backline y las piezas
 * que deben salir, de izquierda a derecha y de arriba abajo.
 *
 *   npm run entrenar                       (usa tests/fixtures/entrenamiento/renglones.txt)
 *   npm run entrenar -- otro.txt --todo    (--todo muestra también los casos que pasan) */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { leerCasos, medirCaso } from "../src/lectura/entrenamiento";

const { values: op, positionals } = parseArgs({ allowPositionals: true, options: { todo: { type: "boolean", default: false } } });
const ruta = positionals[0] ?? "tests/fixtures/entrenamiento/renglones.txt";

let piezasBien = 0, piezasTotal = 0, casosBien = 0;
const casos = leerCasos(readFileSync(ruta, "utf8"));
for (const caso of casos) {
  const r = medirCaso(caso);
  // Un caso "(nada)" cuenta como una pieza: acierta si no salió nada.
  piezasTotal += Math.max(1, r.aciertos.length);
  piezasBien += r.aciertos.length ? r.aciertos.filter(Boolean).length : 1;
  if (r.pasa) casosBien++;
  if (r.pasa && !op.todo) continue;
  console.log(`${r.pasa ? "✔" : "✘"} ${caso.nombre}`);
  if (!r.aciertos.length) { console.log("   ✔  (nada)"); continue; }
  r.aciertos.forEach((ok, k) => {
    const e = caso.esperadas[k], s = r.salio[k];
    console.log(`   ${ok ? "✔" : "✘"}  ${e ? `${e.cantidad} | ${e.texto}` : "(no debía salir)"}` + (ok ? "" : `\n        salió: ${s ? `${s.cantidad} | ${s.texto}` : "(nada)"}`));
  });
}
console.log(`\nCasos: ${casosBien}/${casos.length} · piezas: ${piezasBien}/${piezasTotal} (${Math.round(100 * piezasBien / piezasTotal)} %)`);
