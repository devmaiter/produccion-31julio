/* El lector empaquetado para páginas sin bundler (la app de Cordillera):
 * un solo archivo `lector.js` que deja `window.LectorBackline`. La página
 * dice dónde sirve el worker de PDF y la carpeta del OCR. */
import { PaqueteEvento } from "../../lector/src/dominio/entidades";
import type { RenglonLeido } from "../../lector/src/lectura/interpretar";
import { extraccionVacia, integrar, interpretar, leerArchivo, leerDesglose, unirExtracciones, type Extraccion, type ImagenPlano } from "../../lector/src/lectura";
import { lineasDeTexto } from "../../lector/src/lectura/documento";
import { lectoresNavegador, type RutasNavegador } from "../../lector/src/lectura/navegador";

export interface OpcionesLectura {
  rutas: RutasNavegador;
  /** Evento base: artistas y días que el lector reconoce. Puede ser parcial. */
  base?: Partial<PaqueteEvento> | null;
  artista?: string;
  fecha?: string;
  /** Se llama antes y después de cada archivo. */
  alProgreso?: (nombre: string, estado: string) => void;
  /** Si viene, se llena con lo que se decidió de cada renglón (PDF, fotos, correos y texto; no el desglose .xlsx). */
  traza?: RenglonLeido[];
}

export interface Lectura {
  extraccion: Extraccion;
  imagenes: ImagenPlano[];
  /** Por archivo: qué salió o qué falló. */
  archivos: Array<{ nombre: string; resumen: string; error: string | null }>;
}

let lectores: ReturnType<typeof lectoresNavegador> | null = null;

/** Lee varios archivos (o textos pegados) y devuelve una sola extracción. */
export async function leerTodo(entradas: Array<File | { nombre: string; texto: string }>, op: OpcionesLectura): Promise<Lectura> {
  lectores ??= lectoresNavegador(op.rutas);
  const base = (op.base ?? null) as PaqueteEvento | null;
  const parciales: Extraccion[] = [];
  const imagenes: ImagenPlano[] = [];
  const archivos: Lectura["archivos"] = [];
  for (const e of entradas) {
    const nombre = e instanceof File ? e.name : e.nombre;
    op.alProgreso?.(nombre, "leyendo…");
    try {
      let ext: Extraccion;
      if (!(e instanceof File)) {
        ext = interpretar([{ nombre, tipo: "texto", lineas: lineasDeTexto(e.texto), avisos: [] }], { base, artista: op.artista, fecha: op.fecha, traza: op.traza });
      } else if (/\.xlsx$/i.test(nombre)) {
        op.alProgreso?.(nombre, "leyendo hojas y planos (OCR)…");
        const d = await leerDesglose(new Uint8Array(await e.arrayBuffer()), nombre, { base, lectores });
        ext = d.extraccion; imagenes.push(...d.imagenes);
      } else {
        if (/\.(jpe?g|png|webp|gif|bmp)$/i.test(nombre) || e.type.startsWith("image/")) op.alProgreso?.(nombre, "leyendo con OCR…");
        const docs = await leerArchivo(nombre, new Uint8Array(await e.arrayBuffer()), e.type, lectores);
        ext = interpretar(docs, { base, artista: op.artista, fecha: op.fecha, traza: op.traza });
      }
      parciales.push(ext);
      const resumen = [`${ext.items.length} ítem(s)`, ext.bloques.length ? `${ext.bloques.length} bloque(s) de horario` : "", ext.zonas.length ? `${ext.zonas.length} zona(s)` : "", ext.canales.length ? `${ext.canales.length} canal(es)` : "", ext.planos.length ? `${ext.planos.length} plano(s)` : ""].filter(Boolean).join(" · ");
      archivos.push({ nombre, resumen, error: null });
      op.alProgreso?.(nombre, resumen);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      archivos.push({ nombre, resumen: "", error: m });
      op.alProgreso?.(nombre, `error: ${m}`);
    }
  }
  return { extraccion: parciales.length ? unirExtracciones(parciales) : extraccionVacia(), imagenes, archivos };
}

export { extraccionVacia, integrar, interpretar, leerArchivo, leerDesglose, unirExtracciones, lectoresNavegador };
export { categorizar } from "../../lector/src/dominio/categorias";
