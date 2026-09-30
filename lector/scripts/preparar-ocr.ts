/* Copia a lector/ocr/ lo que el OCR necesita para funcionar sin internet:
 * el worker de Tesseract, el motor WebAssembly y los idiomas (español e
 * inglés). Corre solo antes de las pruebas; la app sirve esa carpeta. */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const req = createRequire(import.meta.url);
const destino = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "ocr");
const dir = (paquete: string) => dirname(req.resolve(`${paquete}/package.json`));

mkdirSync(join(destino, "lang"), { recursive: true });
mkdirSync(join(destino, "core"), { recursive: true });

copiar(join(dir("tesseract.js"), "dist", "worker.min.js"), join(destino, "worker.min.js"));
for (const f of readdirSync(dir("tesseract.js-core"))) {
  // Solo las variantes LSTM (las que usa el motor por defecto), con el wasm embebido.
  if (/^tesseract-core(-simd|-relaxedsimd)?-lstm\.wasm\.js$/.test(f)) copiar(join(dir("tesseract.js-core"), f), join(destino, "core", f));
}
for (const l of ["spa", "eng"]) copiar(join(dir(`@tesseract.js-data/${l}`), "4.0.0_best_int", `${l}.traineddata.gz`), join(destino, "lang", `${l}.traineddata.gz`));

function copiar(de: string, a: string) {
  if (!existsSync(de)) throw new Error(`Falta ${de}: corre npm install`);
  copyFileSync(de, a);
}
console.log(`OCR listo en ${destino}`);
