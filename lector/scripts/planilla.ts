/* Del rider a la planilla de backline (formato OML: Cant | Requerimiento | Cant | Propuesta).
 *
 *   npm run planilla -- rider.pdf --banda "Paula Pera" --escenario "Stage 4" --fecha 2026-09-12 [--salida planilla.xlsx]
 *
 * El Requerimiento sale del rider; la Propuesta queda vacía. Sin --salida escribe <rider>.xlsx al lado. */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { filasDelRider, interpretar, leerArchivo, planillaXlsx, SIN_NOMBRE, type RenglonLeido } from "../src/lectura";
import { lectoresNode } from "../src/lectura/node/lectores";

const { values: op, positionals: archivos } = parseArgs({
  allowPositionals: true,
  options: {
    banda: { type: "string" }, escenario: { type: "string", default: "Stage" }, fecha: { type: "string", default: "" },
    set: { type: "string", default: "SET A" }, cat: { type: "string", default: "" }, rider: { type: "string" }, salida: { type: "string" },
  },
});

async function main() {
  const ruta = archivos[0];
  if (!ruta) throw new Error('Indica el rider: npm run planilla -- rider.pdf --banda "Nombre"');
  const lectores = lectoresNode();
  try {
    const docs = await leerArchivo(basename(ruta), new Uint8Array(readFileSync(ruta)), "", lectores);
    const traza: RenglonLeido[] = [];
    const ext = interpretar(docs, { traza, artista: op.banda });
    const banda = op.banda ?? ext.artistas[0] ?? SIN_NOMBRE;
    const filas = filasDelRider(ext, traza);
    const salida = op.salida ?? ruta.replace(/\.[^.\\/]+$/, "") + ".xlsx";
    writeFileSync(salida, await planillaXlsx({ escenario: op.escenario!, fecha: op.fecha!, banda, set: op.set!, cat: op.cat!, rider: op.rider ?? basename(ruta), filas }));
    console.error(`planilla: ${salida} · ${filas.filter(f => f.tipo === "item").length} ítems en ${filas.filter(f => f.tipo === "seccion").length} secciones`);
  } finally {
    await lectores.cerrar();
  }
}

main().catch(err => { console.error(err instanceof Error ? err.message : String(err)); process.exitCode = 1; });
