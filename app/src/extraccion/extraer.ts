/* Llama a Claude con las fuentes y devuelve una Extraccion validada.
 *
 * Solo corre en servidor o en la terminal: la clave de la API nunca va al
 * navegador. El cliente se puede inyectar para las pruebas.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CATEGORIAS } from "../dominio/entidades";
import { Extraccion } from "./esquema";
import type { Fuente } from "./fuentes";

export const MODELO = "claude-opus-5-5";

const SISTEMA = `Eres coordinador de backline en festivales de música en Colombia. Recibes lo que
llega de producción: correos, riders en PDF, hojas de backline impresas fotografiadas,
horarios y carteles. Tu trabajo es transcribirlo a datos estructurados, sin inventar nada.

Qué extraer:
- Evento, escenarios, días, artistas, horario (shows, pruebas, montajes, cambios) y el
  backline de cada artista.
- Backline es equipo de tarima que se alquila o se pone: batería y hardware, platillos,
  percusión, amplis, instrumentos, teclados, bases/stands, sillas, DJ, tarimas/risers,
  ventiladores, cables de instrumento y energía. NO es backline: micrófonos, monitores,
  in-ears, consolas de sonido, cajas directas ni luces; no los incluyas como ítems.

Cómo transcribir:
- Un ítem por línea del rider. Separa la cantidad de la descripción ("2 Snare stand" →
  cantidad 2, "Snare stand"). Conserva marca y modelo tal como aparecen; no los traduzcas
  ni los corrijas. Si el documento dice "igual que el día 1" o repite un rider, repítelo
  para cada día al que aplica.
- Categorías disponibles: ${CATEGORIAS.join(", ")}. Las bases y stands (de platillo, de
  redoblante, de teclado, de guitarra), sillas y throne van en "Bases".
- "CN" en la columna de observaciones significa equipo propio; otros nombres (OML,
  BACKLINE COP, una persona) son el proveedor. Cópialo en "proveedor" tal cual.
- Fechas AAAA-MM-DD y horas HH:MM en 24 horas. Si el año no aparece, usa el del correo
  o el del evento. Un show que empieza después de medianoche pertenece a la jornada
  anterior.
- Si algo no se lee bien (foto borrosa, tachón, número a mano sobre uno impreso), transcribe
  tu mejor lectura, marca el ítem como dudoso y explícalo en "avisos". Nunca adivines un
  modelo que no se lee: describe el equipo de forma genérica.
- Si varias fuentes se contradicen, usa la más reciente y deja el conflicto en "avisos".`;

export interface OpcionesExtraccion {
  /** Contexto que ya conocemos (evento, artistas existentes) para que use los mismos nombres. */
  contexto?: string;
  cliente?: Pick<Anthropic, "beta">;
}

export class ErrorExtraccion extends Error {}

export async function extraer(fuentes: Fuente[], opciones: OpcionesExtraccion = {}): Promise<Extraccion> {
  if (!fuentes.length) throw new ErrorExtraccion("No hay archivos para leer");
  const cliente = opciones.cliente ?? new Anthropic();

  const contenido: Anthropic.Beta.BetaContentBlockParam[] = fuentes.flatMap(f => f.bloques);
  contenido.push({
    type: "text",
    text: (opciones.contexto ? `Lo que ya tenemos registrado (usa estos mismos nombres cuando se refieran a lo mismo):\n${opciones.contexto}\n\n` : "")
      + "Extrae todo lo que traen estos archivos.",
  });

  // En streaming: un rider largo puede pasar de los 10 minutos que permite
  // una petición normal.
  const respuesta = await cliente.beta.messages.stream({
    model: MODELO,
    max_tokens: 64000,
    system: SISTEMA,
    messages: [{ role: "user", content: contenido }],
    output_config: { effort: "high", format: betaZodOutputFormat(Extraccion) },
    // Si un clasificador de seguridad rechaza la petición, la API la reintenta
    // en el modelo recomendado en vez de devolver el rechazo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  }).finalMessage();

  if (respuesta.stop_reason === "refusal") {
    throw new ErrorExtraccion(`El modelo no procesó los archivos (${respuesta.stop_details?.category ?? "sin categoría"})`);
  }
  if (respuesta.stop_reason === "max_tokens") {
    throw new ErrorExtraccion("La respuesta se cortó: son demasiados datos para una sola llamada. Envía los archivos por partes.");
  }
  const salida = respuesta.parsed_output;
  if (!salida) throw new ErrorExtraccion("La respuesta no tiene el formato esperado");
  return Extraccion.parse(salida);
}
