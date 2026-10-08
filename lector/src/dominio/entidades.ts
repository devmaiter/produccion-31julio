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
  "In ears",
  "Consolas",
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
  /** De qué archivo salió (correo, PDF, foto), para poder rastrearlo. */
  origen: z.string().optional(),
  /** Dónde va en la tarima. */
  puestoId: Id.optional(),
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

/* ---- La tarima: dónde va cada cosa ------------------------------------ */

/** Lados desde el músico mirando al público: SR es su derecha (la izquierda del público). */
export const LADOS = ["sr", "centro", "sl"] as const;
export const PROFUNDIDADES = ["us", "centro", "ds"] as const;

/** Un riser (sobretarima) o un área de trabajo (drum tech, guitar world…) de un artista. */
export const Zona = z.object({
  id: Id,
  eventoId: Id,
  artistaId: Id,
  nombre: z.string().min(1),
  tipo: z.enum(["riser", "area"]),
  /** Metros. */
  ancho: z.number().positive().optional(),
  fondo: z.number().positive().optional(),
  alto: z.number().nonnegative().optional(),
  cantidad: z.number().int().min(1).default(1),
  ruedas: z.boolean().optional(),
  lado: z.enum(LADOS).optional(),
  profundidad: z.enum(PROFUNDIDADES).optional(),
  /** Posición sobre el stage plot, de 0 a 1, si se dibujó ahí. */
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  observacion: z.string().optional(),
  porConfirmar: z.boolean().default(false),
  origen: z.string().optional(),
});
export type Zona = z.infer<typeof Zona>;

export const ROLES_PUESTO = [
  "bateria", "percusion", "bajo", "guitarra", "teclados", "metales", "cuerdas", "dj", "voz", "playback", "tecnico", "otro",
] as const;
export const RolPuesto = z.enum(ROLES_PUESTO);
export type RolPuesto = z.infer<typeof RolPuesto>;

/** Un músico o rol en la tarima: dónde está, qué corriente y qué monitor tiene. */
export const Puesto = z.object({
  id: Id,
  eventoId: Id,
  artistaId: Id,
  nombre: z.string().min(1),
  rol: RolPuesto,
  zonaId: Id.optional(),
  /** Posición sobre el stage plot, de 0 a 1 (x hacia SL, y hacia el público). */
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  corriente: z.string().optional(),
  monitor: z.string().optional(),
  porConfirmar: z.boolean().default(false),
  origen: z.string().optional(),
});
export type Puesto = z.infer<typeof Puesto>;

/** Una línea del IO List: qué instrumento entra por qué canal, con qué micrófono, desde dónde. */
export const Canal = z.object({
  id: Id,
  eventoId: Id,
  artistaId: Id,
  diaId: Id.optional(),
  /** Entrada (micrófono/DI) o salida (mezcla de monitor, IEM). */
  tipo: z.enum(["entrada", "salida"]).default("entrada"),
  numero: z.string().min(1),
  instrumento: z.string().min(1),
  microfono: z.string().optional(),
  base: z.string().optional(),
  snake: z.string().optional(),
  /** Tal como lo escribe el IO List: "RISER A", "DRUMS - SR RISER", "DJ RISER UC". */
  ubicacion: z.string().optional(),
  observacion: z.string().optional(),
  puestoId: Id.optional(),
  zonaId: Id.optional(),
});
export type Canal = z.infer<typeof Canal>;

export const TEMAS_REQUISITO = ["backline", "risers", "corriente", "crew", "otro"] as const;

/** El texto original de un requerimiento del artista, para consultarlo tal cual. */
export const Requisito = z.object({
  id: Id,
  eventoId: Id,
  artistaId: Id,
  tema: z.enum(TEMAS_REQUISITO),
  texto: z.string().min(1),
  origen: z.string().optional(),
});
export type Requisito = z.infer<typeof Requisito>;

/** Todo lo de un evento en un solo documento: es lo que se importa y exporta. */
export const PaqueteEvento = z.object({
  evento: Evento,
  escenarios: z.array(Escenario),
  dias: z.array(Dia),
  artistas: z.array(Artista),
  bloques: z.array(Bloque),
  items: z.array(ItemBackline),
  stagePlots: z.array(StagePlot),
  zonas: z.array(Zona).default([]),
  puestos: z.array(Puesto).default([]),
  canales: z.array(Canal).default([]),
  requisitos: z.array(Requisito).default([]),
});
export type PaqueteEvento = z.infer<typeof PaqueteEvento>;
