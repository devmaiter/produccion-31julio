/* Extracción automática de ítems de backline.
 *
 * Cada vez que alguien sube una foto en la app (bands/{bandId}/photos), esta
 * función le pide a Claude que identifique el equipo visible y deja el
 * resultado como SUGERENCIAS en bands/{bandId}/itemSuggestions (status:
 * "pending"). No escribe directo en la lista real de ítems: la app muestra
 * las sugerencias en la tarjeta de cada banda con botones ✓/✕ para que el
 * equipo las confirme o descarte — así un error de la IA nunca llega solo
 * al backline real que usan los técnicos.
 *
 * Deploy:
 *   cd functions && npm install
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 *   firebase deploy --only functions
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { Anthropic } = require("@anthropic-ai/sdk");
const { zodOutputFormat } = require("@anthropic-ai/sdk/helpers/zod");
const { z } = require("zod");

admin.initializeApp();

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const CATEGORIES = [
  "Batería", "Platillos", "Percusión", "Bajo", "Guitarra",
  "Ampli bajo", "Ampli guitarra", "Teclado", "Bases", "Otro",
];

const ItemsSchema = z.object({
  items: z.array(z.object({
    cat: z.enum(CATEGORIES),
    text: z.string().min(1).max(160),
  })).max(20),
});

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
]);

const SYSTEM_PROMPT = `Eres un técnico de backline revisando fotos de equipo en tarima antes de un show.
Identifica SOLO backline: instrumentos, amplificadores, batería/percusión, teclados,
bases/atriles de instrumento. NO incluyas micrófonos, monitores de piso, cajas directas (DI)
ni nada de sonido/FOH — eso no es backline, aunque aparezca en la foto.
No inventes marcas ni modelos que no se lean con claridad en la foto — descríbelo de forma
genérica si no estás seguro (ej. "1 combo de guitarra" en vez de adivinar la marca).
Si la foto no muestra backline identificable (solo personas, público, escenario vacío, equipo
de sonido, etc.) devuelve una lista vacía. Responde en español, con textos breves tipo
"1 bajo de 5 cuerdas".`;

exports.suggestItemsFromPhoto = onDocumentCreated(
  {
    document: "bands/{bandId}/photos/{photoId}",
    secrets: [ANTHROPIC_API_KEY],
    region: "us-central1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { bandId, photoId } = event.params;
    const photo = snap.data();
    const dataUrl = photo && photo.data;
    if (typeof dataUrl !== "string") return;

    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      logger.warn("Foto sin data URL válida, se omite extracción", { bandId, photoId });
      return;
    }
    const [, mediaType, base64Data] = match;
    if (!ALLOWED_IMAGE_TYPES.has(mediaType)) {
      logger.warn(`Tipo de imagen no soportado por Claude: ${mediaType}`, { bandId, photoId });
      return;
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    let parsed;
    try {
      const response = await client.messages.parse({
        model: "claude-opus-5",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
            { type: "text", text: "Lista el equipo de backline visible en esta foto." },
          ],
        }],
        output_config: { format: zodOutputFormat(ItemsSchema) },
      });
      parsed = response.parsed_output;
    } catch (err) {
      logger.error("Fallo llamando a Claude para extraer ítems", { bandId, photoId, err: String(err) });
      return;
    }

    if (!parsed || !parsed.items.length) return;

    const db = admin.firestore();
    const suggestionsRef = db.collection("bands").doc(bandId).collection("itemSuggestions");
    const batch = db.batch();
    for (const item of parsed.items) {
      batch.set(suggestionsRef.doc(), {
        cat: item.cat,
        text: item.text,
        status: "pending",
        photoId,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    logger.info(`Sugeridos ${parsed.items.length} ítems para "${bandId}" desde foto ${photoId}`);
  },
);
