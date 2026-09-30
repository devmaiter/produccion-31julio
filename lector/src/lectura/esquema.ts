/* Formato intermedio entre la lectura y el modelo de datos.
 *
 * Es deliberadamente "plano" y por NOMBRES (no ids): así lo produce el
 * intérprete de texto (interpretar.ts) y así se revisa y corrige en pantalla
 * antes de guardar. Convertirlo en entidades (ids, referencias, propietario,
 * fusión con lo que ya existe) lo hace integrar.ts.
 */
import { z } from "zod";
import { CATEGORIAS, LADOS, PROFUNDIDADES, RolPuesto, TEMAS_REQUISITO, TIPOS_BLOQUE } from "../dominio/entidades";

export const ExtraccionEvento = z.object({
  nombre: z.string().describe("Nombre del evento o festival, tal como aparece"),
  lugar: z.string().nullable().describe("Recinto, ej. Parque Simón Bolívar"),
  ciudad: z.string().nullable(),
  desde: z.string().nullable().describe("Primera fecha AAAA-MM-DD"),
  hasta: z.string().nullable().describe("Última fecha AAAA-MM-DD"),
});

export const ExtraccionDia = z.object({
  fecha: z.string().describe("AAAA-MM-DD"),
  nombre: z.string().describe("Como lo llama el documento, ej. 'Día 1', 'Sábado 12'"),
  tipo: z.enum(["show", "pruebas"]).describe("'pruebas' si ese día solo hay montaje/soundcheck, sin público"),
});

export const ExtraccionBloque = z.object({
  fecha: z.string().describe("AAAA-MM-DD del día de la jornada (un show de 00:30 pertenece a la noche anterior)"),
  escenario: z.string().nullable().describe("Nombre del escenario; null si el documento no lo dice"),
  artista: z.string().nullable().describe("null para marcas como 'Puertas' o 'Noise curfew'"),
  titulo: z.string().describe("Ej. 'Show', 'Soundcheck', 'Load in', 'Puertas'"),
  tipo: z.enum(TIPOS_BLOQUE),
  inicio: z.string().describe("HH:MM en 24 horas"),
  fin: z.string().nullable().describe("HH:MM en 24 horas; null si no se indica"),
});

export const ExtraccionItem = z.object({
  artista: z.string().describe("Artista o banda al que pertenece el ítem"),
  fecha: z.string().nullable().describe("AAAA-MM-DD si el documento separa el backline por día; null si no"),
  grupo: z.string().nullable().describe("Encabezado de sección en el rider, ej. 'Drums', 'Bass', 'Keys'"),
  descripcion: z.string().describe("El ítem sin la cantidad, con marca y modelo tal como aparecen"),
  cantidad: z.number().int().describe("Cantidad pedida; 1 si no se indica"),
  categoria: z.enum(CATEGORIAS),
  proveedor: z.string().nullable().describe("Quién lo pone, tal como aparece: 'CN', 'OML', 'BACKLINE COP', un nombre… null si no se indica"),
  dudoso: z.boolean().describe("true si la cantidad o el texto no se leen con seguridad (foto borrosa, tachones, anotación a mano)"),
  nota: z.string().nullable().describe("Anotaciones relevantes: 'trae la banda', 'confirmar', texto a mano…"),
});

/* ---- La tarima (vienen del desglose: hojas Risers, IO List y los planos) ---- */

export const ZonaExtraida = z.object({
  artista: z.string(),
  nombre: z.string(),
  tipo: z.enum(["riser", "area"]),
  ancho: z.number().nullable(),
  fondo: z.number().nullable(),
  alto: z.number().nullable(),
  cantidad: z.number().int().min(1),
  ruedas: z.boolean().nullable(),
  lado: z.enum(LADOS).nullable(),
  profundidad: z.enum(PROFUNDIDADES).nullable(),
  /** Posición sobre el plano (0–1) si se leyó de ahí. */
  x: z.number().nullable(),
  y: z.number().nullable(),
  dudoso: z.boolean(),
  nota: z.string().nullable(),
});
export type ZonaExtraida = z.infer<typeof ZonaExtraida>;

export const PuestoExtraido = z.object({
  artista: z.string(),
  nombre: z.string(),
  rol: RolPuesto,
  zona: z.string().nullable(),
  x: z.number().nullable(),
  y: z.number().nullable(),
  corriente: z.string().nullable(),
  monitor: z.string().nullable(),
  dudoso: z.boolean(),
  nota: z.string().nullable(),
});
export type PuestoExtraido = z.infer<typeof PuestoExtraido>;

export const CanalExtraido = z.object({
  artista: z.string(),
  fecha: z.string().nullable(),
  tipo: z.enum(["entrada", "salida"]),
  numero: z.string(),
  instrumento: z.string(),
  microfono: z.string().nullable(),
  base: z.string().nullable(),
  snake: z.string().nullable(),
  ubicacion: z.string().nullable(),
  nota: z.string().nullable(),
});
export type CanalExtraido = z.infer<typeof CanalExtraido>;

export const RequisitoExtraido = z.object({
  artista: z.string(),
  tema: z.enum(TEMAS_REQUISITO),
  texto: z.string(),
});
export type RequisitoExtraido = z.infer<typeof RequisitoExtraido>;

/** El archivo del plano lo entrega el lector aparte (bytes); aquí va su nombre. */
export const PlanoExtraido = z.object({
  artista: z.string(),
  archivo: z.string(),
});
export type PlanoExtraido = z.infer<typeof PlanoExtraido>;

export const Extraccion = z.object({
  evento: ExtraccionEvento.nullable().describe("null si el documento no identifica el evento"),
  escenarios: z.array(z.string()),
  dias: z.array(ExtraccionDia),
  artistas: z.array(z.string()),
  bloques: z.array(ExtraccionBloque),
  items: z.array(ExtraccionItem),
  avisos: z.array(z.string()).describe("Lo que no se pudo leer, contradicciones o datos que alguien debe confirmar"),
  zonas: z.array(ZonaExtraida).default([]),
  puestos: z.array(PuestoExtraido).default([]),
  canales: z.array(CanalExtraido).default([]),
  requisitos: z.array(RequisitoExtraido).default([]),
  planos: z.array(PlanoExtraido).default([]),
});
export type Extraccion = z.infer<typeof Extraccion>;
