/* El lector empaquetado para páginas sin bundler (la app de Cordillera):
 * un solo archivo `lector.js` que deja `window.LectorBackline`. La página
 * dice dónde sirve el worker de PDF y la carpeta del OCR. */
import { PaqueteEvento } from "../../lector/src/dominio/entidades";
import type { RenglonLeido } from "../../lector/src/lectura/interpretar";
import { extraccionVacia, integrar, interpretar, leerArchivo, leerDesglose, SIN_NOMBRE, unirExtracciones, type Extraccion, type ImagenPlano } from "../../lector/src/lectura";
import { lineasDeTexto } from "../../lector/src/lectura/documento";
import { lectoresNavegador, type RutasNavegador } from "../../lector/src/lectura/navegador";

export interface OpcionesLectura {
  rutas: RutasNavegador;
  /** Evento base: artistas y días que el lector reconoce. Puede ser parcial. */
  base?: Partial<PaqueteEvento> | null;
  artista?: string;
  fecha?: string;
  /** Si el documento no dice de qué banda es (una lista a mano, un listado suelto), todo va a
   *  "Banda sin nombre" en vez de quedarse sin leer. Lo usan los reels. */
  sinNombre?: boolean;
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
      // Sin banda conocida no sale nada: con `sinNombre` se relee (lo ya leído, sin OCR otra vez) con "Banda sin nombre".
      const leerDocs = (docs: Parameters<typeof interpretar>[0]) => {
        const traza: RenglonLeido[] = [];
        let r = interpretar(docs, { base, artista: op.artista, fecha: op.fecha, traza });
        if (op.sinNombre && !op.artista && !r.items.length && r.avisos.some(a => /no se sabe de qué artista/.test(a))) {
          traza.length = 0;
          r = interpretar(docs, { base, artista: SIN_NOMBRE, fecha: op.fecha, traza });
        }
        op.traza?.push(...traza);
        return r;
      };
      if (!(e instanceof File)) {
        ext = leerDocs([{ nombre, tipo: "texto", lineas: lineasDeTexto(e.texto), avisos: [] }]);
      } else if (/\.xlsx$/i.test(nombre)) {
        op.alProgreso?.(nombre, "leyendo hojas y planos (OCR)…");
        const d = await leerDesglose(new Uint8Array(await e.arrayBuffer()), nombre, { base, lectores });
        ext = d.extraccion; imagenes.push(...d.imagenes);
      } else {
        if (/\.(jpe?g|png|webp|gif|bmp)$/i.test(nombre) || e.type.startsWith("image/")) op.alProgreso?.(nombre, "leyendo con OCR…");
        const docs = await leerArchivo(nombre, new Uint8Array(await e.arrayBuffer()), e.type, lectores);
        ext = leerDocs(docs);
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
// La planilla de backline (formato OML): del rider leído al Requerimiento y al .xlsx.
export { filasDelRider, planillaXlsx, cantidadPlanilla, fechaPlanilla, SIN_NOMBRE } from "../../lector/src/lectura";
