/* Deja en cordillera/lector/ todo lo que la app necesita para leer documentos:
 *   lector.js             el lector empaquetado (window.LectorBackline)
 *   pdf.worker.min.mjs    worker de pdfjs
 *   ocr/                  motor y idiomas de Tesseract (lo que genera `npm run preparar` en lector/)
 * Uso: npm run build:cordillera   (desde extractor/) */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "..", "..");
const destino = process.argv[2] ? resolve(process.argv[2]) : resolve(raiz, "cordillera", "lector");
const ocr = resolve(raiz, "lector", "ocr");
if (!existsSync(ocr)) { console.error("Falta lector/ocr: corre `npm run preparar` en lector/."); process.exit(1); }
rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
cpSync(resolve(aqui, "..", "dist-lib", "lector.js"), resolve(destino, "lector.js"));
cpSync(resolve(raiz, "lector", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"), resolve(destino, "pdf.worker.min.mjs"));
cpSync(ocr, resolve(destino, "ocr"), { recursive: true, dereference: true });
console.log("listo:", destino);
