/* Lee correos, PDFs y fotos y llena las entidades del evento.
 *
 *   npm run extraer -- [--evento <id>] [--guardar] [--crudo salida.json] archivo1 archivo2 …
 *   npm run extraer -- --evento <id> --desde-crudo salida.json [--guardar]
 *
 *  --evento       evento existente en data/ al que se suma lo extraído;
 *                 sin él se crea un evento nuevo con lo que digan los archivos.
 *  --guardar      escribe data/<evento>.json. Sin esta opción solo muestra el
 *                 resumen: nada cambia hasta que alguien lo revise.
 *  --crudo        guarda lo que devolvió el modelo, para auditarlo o repetir
 *                 la integración sin volver a llamar a la API.
 *  --desde-crudo  integra una extracción guardada (no llama a la API).
 *
 * Necesita ANTHROPIC_API_KEY (o `ant auth login`) salvo con --desde-crudo.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { PaqueteEvento } from "../src/dominio";
import { Extraccion, ErrorExtraccion, contextoDe, extraer, integrar, leerFuente, type Resumen } from "../src/extraccion";

const DATA = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "data");

const { values: op, positionals: archivos } = parseArgs({
  allowPositionals: true,
  options: {
    evento: { type: "string" },
    guardar: { type: "boolean", default: false },
    crudo: { type: "string" },
    "desde-crudo": { type: "string" },
  },
});

function cargarEvento(id: string): PaqueteEvento {
  const ruta = join(DATA, `${id}.json`);
  if (!existsSync(ruta)) throw new Error(`No existe el evento "${id}" en data/`);
  return PaqueteEvento.parse(JSON.parse(readFileSync(ruta, "utf8")));
}

function imprimir(r: Resumen, p: PaqueteEvento) {
  const c = (n: string, x: { nuevos: number; actualizados: number; iguales: number }) =>
    `  ${n.padEnd(11)} ${String(x.nuevos).padStart(4)} nuevos · ${x.actualizados} actualizados · ${x.iguales} ya estaban`;
  console.log(`\n${r.evento.nuevo ? "Evento nuevo" : "Evento"}: ${p.evento.nombre} (${r.evento.id})`);
  console.log([c("Escenarios", r.escenarios), c("Días", r.dias), c("Artistas", r.artistas), c("Horario", r.bloques), c("Backline", r.items)].join("\n"));
  const dudosos = p.items.filter(i => i.porConfirmar && i.origen).length;
  if (dudosos) console.log(`  ${dudosos} ítems marcados "confirmar cantidad"`);
  if (r.avisos.length) console.log(`\nPara revisar:\n${r.avisos.map(a => `  • ${a}`).join("\n")}`);
}

async function main() {
  const base = op.evento ? cargarEvento(op.evento) : null;
  let ext: Extraccion;
  let origen: string;

  if (op["desde-crudo"]) {
    ext = Extraccion.parse(JSON.parse(readFileSync(op["desde-crudo"], "utf8")));
    origen = basename(op["desde-crudo"]);
  } else {
    if (!archivos.length) throw new Error("Indica al menos un archivo (.eml, .pdf, .jpg, .png, .txt)");
    const fuentes = await Promise.all(archivos.map(leerFuente));
    console.log(`Leyendo ${fuentes.map(f => `${f.nombre} (${f.tipo})`).join(", ")} …`);
    ext = await extraer(fuentes, { contexto: base ? contextoDe(base) : undefined });
    origen = fuentes.map(f => f.nombre).join(", ");
    if (op.crudo) { writeFileSync(op.crudo, JSON.stringify(ext, null, 1) + "\n"); console.log(`Extracción guardada en ${op.crudo}`); }
  }

  const { paquete, resumen } = integrar(ext, base, origen);
  imprimir(resumen, paquete);

  const destino = join(DATA, `${paquete.evento.id}.json`);
  if (!op.guardar) {
    console.log(`\nNo se guardó nada. Revisa el resumen y repite con --guardar para escribir ${basename(destino)}.`);
    return;
  }
  if (!base && existsSync(destino)) throw new Error(`Ya existe ${basename(destino)}. Usa --evento ${paquete.evento.id} para sumar a ese evento.`);
  writeFileSync(destino, JSON.stringify(paquete, null, 1) + "\n");
  console.log(`\n✓ Guardado en data/${basename(destino)}`);
}

main().catch(err => {
  if (err instanceof Anthropic.AuthenticationError) console.error("La clave de la API no es válida. Revisa ANTHROPIC_API_KEY.");
  else if (err instanceof Anthropic.RateLimitError) console.error("Límite de uso de la API alcanzado; intenta en un momento.");
  else if (err instanceof Anthropic.APIError) console.error(`Error de la API (${err.status}): ${err.message}`);
  else if (err instanceof Anthropic.AnthropicError) console.error("No hay credenciales de la API: define ANTHROPIC_API_KEY (o usa `ant auth login`).");
  else if (err instanceof ErrorExtraccion || err instanceof Error) console.error(err.message);
  else console.error(err);
  process.exitCode = 1;
});
