/* Lee correos, PDF, fotos o texto y saca los datos del evento en JSON.
 *
 *   npm run leer -- [opciones] archivo1 archivo2 …
 *
 *   --evento <id>          evento de data/ al que pertenecen (usa sus artistas y días)
 *   --artista <nombre>     todo lo leído es de este artista (rider de una sola banda)
 *   --fecha <AAAA-MM-DD>   todo lo leído es de este día
 *   --integrar             además de la extracción, devuelve el evento ya integrado y el resumen
 *   --guardar              escribe data/<evento>.json (solo con --integrar)
 *
 * Salida: JSON por la salida estándar; los avisos también van al error estándar
 * para leerlos en la terminal. Este JSON es lo que recibe la app (Elm).
 */
import { basename, join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { DIR_DATA, cargarEvento } from "../src/datos/eventos";
import { integrar, interpretar, leerArchivo, type Documento } from "../src/lectura";
import { lectoresNode } from "../src/lectura/node/lectores";

const { values: op, positionals: archivos } = parseArgs({
  allowPositionals: true,
  options: {
    evento: { type: "string" },
    artista: { type: "string" },
    fecha: { type: "string" },
    integrar: { type: "boolean", default: false },
    guardar: { type: "boolean", default: false },
  },
});

async function main() {
  if (!archivos.length) throw new Error("Indica al menos un archivo (.eml, .pdf, .jpg, .png, .txt).");
  const base = op.evento ? cargarEvento(op.evento) : null;
  if (op.evento && !base) throw new Error(`No existe el evento "${op.evento}" en data/.`);

  const lectores = lectoresNode();
  const docs: Documento[] = [];
  try {
    for (const ruta of archivos) {
      docs.push(...await leerArchivo(basename(ruta), new Uint8Array(readFileSync(ruta)), "", lectores));
    }
  } finally {
    await lectores.cerrar();
  }

  const extraccion = interpretar(docs, { base, artista: op.artista, fecha: op.fecha });
  for (const a of extraccion.avisos) console.error(`aviso: ${a}`);

  if (!op.integrar) {
    console.log(JSON.stringify(extraccion, null, 1));
    return;
  }
  const { paquete, resumen } = integrar(extraccion, base, archivos.map(a => basename(a)).join(", "));
  for (const a of resumen.avisos.slice(extraccion.avisos.length)) console.error(`aviso: ${a}`);
  console.log(JSON.stringify({ extraccion, paquete, resumen }, null, 1));
  if (op.guardar) {
    const destino = join(DIR_DATA, `${paquete.evento.id}.json`);
    writeFileSync(destino, JSON.stringify(paquete, null, 1) + "\n");
    console.error(`guardado: ${destino}`);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
