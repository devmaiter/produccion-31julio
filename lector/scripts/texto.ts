/* Muestra lo que el lector sacó de cada archivo, como texto Markdown, sin
 * interpretar: para revisar que se leyó bien antes de buscar el backline.
 *
 *   npm run texto -- archivo1 archivo2 …
 *   npm run texto -- --guardar riders-reales/*.pdf
 *
 *   Acepta .pdf, fotos, .eml (con sus adjuntos), .txt/.csv y .xlsx.
 *
 *   --guardar   escribe <archivo>.md al lado de cada archivo en vez de
 *               mostrarlo en la terminal
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { documentosAMarkdown, leerArchivo, leerLibro, libroAMarkdown } from "../src/lectura";
import { lectoresNode } from "../src/lectura/node/lectores";

const { values: op, positionals: archivos } = parseArgs({
  allowPositionals: true,
  options: { guardar: { type: "boolean", default: false } },
});

async function main() {
  if (!archivos.length) throw new Error("Indica al menos un archivo: npm run texto -- rider.pdf");
  const lectores = lectoresNode();
  try {
    for (const ruta of archivos) {
      const bytes = new Uint8Array(readFileSync(ruta));
      const nombre = basename(ruta);
      const md = /\.xlsx$/i.test(ruta)
        ? libroAMarkdown(await leerLibro(bytes), nombre)
        : documentosAMarkdown(await leerArchivo(nombre, bytes, "", lectores));
      if (op.guardar) {
        writeFileSync(`${ruta}.md`, md);
        console.error(`guardado: ${ruta}.md`);
      } else {
        process.stdout.write(md + "\n");
      }
    }
  } finally {
    await lectores.cerrar();
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
