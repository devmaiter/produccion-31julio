// Compara dos salidas de la red de seguridad y muestra solo lo que cambió.
// Uso: node comparar.mjs base.json nuevo.json   (sale con código 1 si hay diferencias)
import fs from "node:fs";
const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
let n = 0;
function diff(x, y, ruta) {
  if (typeof x !== typeof y || Array.isArray(x) !== Array.isArray(y)) { console.log("TIPO", ruta); n++; return; }
  if (x && typeof x === "object") {
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (!(k in x)) { console.log("NUEVO", `${ruta}/${k}`); n++; }
      else if (!(k in y)) { console.log("FALTA", `${ruta}/${k}`); n++; }
      else diff(x[k], y[k], `${ruta}/${k}`);
    }
  } else if (x !== y) { console.log("CAMBIO", ruta, JSON.stringify(x).slice(0, 160), "→", JSON.stringify(y).slice(0, 160)); n++; }
}
diff(a, b, "");
console.log(n ? `${n} diferencias` : "Igual: nada cambió.");
process.exit(n ? 1 : 0);
