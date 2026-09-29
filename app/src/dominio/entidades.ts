/* Modelo de datos del backline.
 *
 * Une los dos prototipos:
 *  - Hoja de producción (Simón Bolívar, Vallenato al Parque): días, horario por
 *    banda, stage plots, fotos e ítems con categoría.
 *  - Lista de chequeo de Cordillera 2026: escenarios, ítems con cantidad,
 *    propietario (CN / terceros), conteo en cancha y totales por referencia.
 *
 * Cada entidad tiene su esquema zod: los datos que entran (JSON, Firestore,
 * formularios) se validan antes de llegar a la lógica.
 */
import { z } from "zod";

const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "id en minúsculas, números y guiones");
const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha AAAA-MM-DD");
const Hora = z.string().regex(/^\d{2}:\d{2}$/, "hora HH:MM");

export const CATEGORIAS = [
  "Batería",
  "Platillos",
  "Percusión",
  "Bajo",
  "Ampli bajo",
  "Guitarra",
  "Ampli guitarra",
  "Teclado",
  "Bases",
  "DJ",
  "Escenario",
  "Cables y energía",
  "Otro",
] as const;
export const Categoria = z.enum(CATEGORIAS);
export type Categoria = z.infer<typeof Categoria>;

/** Quién pone el equipo. "CN" en las hojas = equipo propio de la producción;
 *  OML, BACKLINE COP o un nombre propio = tercero (proveedor). */
export const Propietario = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("propio") }),
  z.object({ tipo: z.literal("tercero"), nombre: z.string().min(1) }),
  z.object({ tipo: z.literal("sin-definir") }),
]);
export type Propietario = z.infer<typeof Propietario>;

export const Evento = z.object({
  id: Id,
  nombre: z.string().min(1),
  lugar: z.string().min(1),
  ciudad: z.string().min(1),
  desde: Fecha,
  hasta: Fecha,
});
export type Evento = z.infer<typeof Evento>;

export const Escenario = z.object({
  id: Id,
  eventoId: Id,
  nombre: z.string().min(1),
});
export type Escenario = z.infer<typeof Escenario>;

/** Una jornada del evento. Los días de pruebas no tienen shows. */
export const Dia = z.object({
  id: Id,
  eventoId: Id,
  fecha: Fecha,
  nombre: z.string().min(1),
  tipo: z.enum(["show", "pruebas"]),
});
export type Dia = z.infer<typeof Dia>;

export const Artista = z.object({
  id: Id,
  nombre: z.string().min(1),
});
export type Artista = z.infer<typeof Artista>;

export const TIPOS_BLOQUE = ["show", "soundcheck", "linecheck", "load-in", "montaje", "cambio", "marca"] as const;

/** Un bloque del horario: show, prueba, montaje o cambio de un artista en un
 *  escenario. Un bloque que cruza la medianoche tiene fin < inicio. */
export const Bloque = z.object({
  id: Id,
  diaId: Id,
  escenarioId: Id,
  artistaId: Id.optional(),
  titulo: z.string().min(1),
  tipo: z.enum(TIPOS_BLOQUE),
  inicio: Hora,
  fin: Hora,
});
export type Bloque = z.infer<typeof Bloque>;

/** Una línea del rider de backline de un artista en un día. */
export const ItemBackline = z.object({
  id: Id,
  eventoId: Id,
  diaId: Id,
  artistaId: Id,
  grupo: z.string().optional(),
  descripcion: z.string().min(1),
  cantidad: z.number().int().min(0),
  categoria: Categoria,
  referencia: z.string().min(1),
  propietario: Propietario,
  observacion: z.string().optional(),
  /** La cantidad en el papel es dudosa: hay que confirmarla. */
  porConfirmar: z.boolean().default(false),
  /** Ya venía chuleado a mano en la hoja impresa. */
  chuleadoEnHoja: z.boolean().default(false),
});
export type ItemBackline = z.infer<typeof ItemBackline>;
export type ItemBacklineEntrada = z.input<typeof ItemBackline>;

export const StagePlot = z.object({
  artistaId: Id,
  eventoId: Id,
  archivo: z.string().min(1),
  descripcion: z.string().optional(),
});
export type StagePlot = z.infer<typeof StagePlot>;

/** Lo que se registra en cancha para un ítem. */
export const Verificacion = z.object({
  itemId: Id,
  contado: z.number().int().min(0).nullable().default(null),
  listo: z.boolean().default(false),
  /** Corrección de la cantidad esperada (la hoja estaba mal). */
  cantidadCorregida: z.number().int().min(0).optional(),
  actualizado: z.string().optional(),
});
export type Verificacion = z.infer<typeof Verificacion>;

/** Todo lo de un evento en un solo documento: es lo que se importa y exporta. */
export const PaqueteEvento = z.object({
  evento: Evento,
  escenarios: z.array(Escenario),
  dias: z.array(Dia),
  artistas: z.array(Artista),
  bloques: z.array(Bloque),
  items: z.array(ItemBackline),
  stagePlots: z.array(StagePlot),
});
export type PaqueteEvento = z.infer<typeof PaqueteEvento>;
