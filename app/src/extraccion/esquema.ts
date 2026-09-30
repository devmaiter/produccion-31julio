/* Lo que Claude devuelve al leer un correo, PDF o foto.
 *
 * Es deliberadamente "plano" y por NOMBRES (no ids): el modelo solo transcribe
 * lo que ve. Convertirlo en entidades (ids, referencias, propietario,
 * validación cruzada, fusión con lo que ya existe) lo hace código
 * determinista en integrar.ts, que sí se puede probar sin llamar a la API.
 */
import { z } from "zod";
import { CATEGORIAS, TIPOS_BLOQUE } from "../dominio/entidades";

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

export const Extraccion = z.object({
  evento: ExtraccionEvento.nullable().describe("null si el documento no identifica el evento"),
  escenarios: z.array(z.string()),
  dias: z.array(ExtraccionDia),
  artistas: z.array(z.string()),
  bloques: z.array(ExtraccionBloque),
  items: z.array(ExtraccionItem),
  avisos: z.array(z.string()).describe("Lo que no se pudo leer, contradicciones o datos que alguien debe confirmar"),
});
export type Extraccion = z.infer<typeof Extraccion>;
