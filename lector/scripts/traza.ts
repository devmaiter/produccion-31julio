/* Qué decidió el lector de cada renglón (la traza), para revisar un rider en la terminal.
 *
 *   npm run traza -- rider.pdf [--todo]
 *
 * Sin --todo muestra solo desde que empieza el backline hasta que termina. */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { interpretar, leerArchivo, type RenglonLeido } from "../src/lectura";
import { lectoresNode } from "../src/lectura/node/lectores";

const { values: op, positionals: archivos } = parseArgs({ allowPositionals: true, options: { todo: { type: "boolean", default: false } } });

async function main() {
  const ruta = archivos[0];
  if (!ruta) throw new Error("Indica un archivo: npm run traza -- rider.pdf");
  const lectores = lectoresNode();
  try {
    const docs = await leerArchivo(basename(ruta), new Uint8Array(readFileSync(ruta)), "", lectores);
    const traza: RenglonLeido[] = [];
    const ext = interpretar(docs, { traza });
    const desde = op.todo ? 0 : Math.max(0, traza.findIndex(r => r.seccion === "backline") - 1);
    for (const r of traza.slice(desde)) {
      if (!op.todo && r.seccion !== "backline" && r.etiqueta !== "seccion" && r.etiqueta !== "item") continue;
      const it = r.item !== null ? ext.items[r.item]! : null;
      const extra = it ? ` → ${it.cantidad} × ${it.descripcion} [${it.categoria}]` : "";
      console.log(`${r.etiqueta.padEnd(15)} ${(r.grupo ?? "").slice(0, 14).padEnd(14)} ${r.texto.slice(0, 70)}${extra}`);
    }
    console.error(`banda: ${ext.artistas.join(", ") || "—"} · ítems: ${ext.items.length}`);
  } finally {
    await lectores.cerrar();
  }
}

main().catch(err => { console.error(err instanceof Error ? err.message : String(err)); process.exitCode = 1; });
