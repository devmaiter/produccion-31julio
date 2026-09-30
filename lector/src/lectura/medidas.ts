/* Medidas de risers y sobretarimas tal como vienen en los riders:
 *   "2.40x2.40x.60"   "9.60 mts (ANCHO) x 2.44 (FONDO) x 1.50 mts (ALTO)"
 *   "12`X 8`X1'"      "2.44 x 2.44 m. X 60 cm"   "10 × 3 × 0,50 m"
 *   "8ft. X 8ft. X 23in."   "10.00 X 2.50 A 60 CM"   "1.22 x 2.44 x .20"
 * Todo se devuelve en metros: ancho × fondo × alto. */

export interface Medidas {
  ancho: number;
  fondo: number;
  alto: number | null;
  /** Índices [inicio, fin) del texto donde estaban las medidas. */
  desde: number;
  hasta: number;
}

const NUMERO = String.raw`(\d+(?:[.,]\d+)?|[.,]\d+)`;
const UNIDAD = String.raw`\s*(mts?|metros?|m\b|cm|cms|ft\b|feet|pies?|in\b|inch(?:es)?|pulg(?:adas)?|['´\`’]{1,2}|"|”|″)?\.?`;
// "(ANCHO)", "ancho", "profundo", y a veces una unidad repetida después: "9.60 mts (ANCHO) mts x"
const ETIQUETA = String.raw`(?:\s*\(?(?:ancho|fondo|alto|largo|profund\w*|altura|de ancho|de fondo|de alto)\)?)?(?:\s*(?:mts?|metros?)\b)?`;
const SEP = String.raw`\s*(?:x|×|\*|por|a|de)\s*`;
const MEDIDA = new RegExp(`${NUMERO}${UNIDAD}${ETIQUETA}${SEP}${NUMERO}${UNIDAD}${ETIQUETA}(?:${SEP}${NUMERO}${UNIDAD}${ETIQUETA})?`, "i");

function aMetros(valor: string, unidad: string | undefined, posicion: "ancho" | "fondo" | "alto"): number {
  const n = Number(valor.replace(",", "."));
  const u = (unidad ?? "").toLowerCase();
  if (/^(ft|feet|pie|pies|'|´|`|’)$/.test(u)) return redondear(n * 0.3048);
  if (/^(in|inch|inches|pulg|pulgadas|''|´´|``|’’|"|”|″)$/.test(u)) return redondear(n * 0.0254);
  if (/^(cm|cms)$/.test(u)) return redondear(n / 100);
  if (/^(m|mt|mts|metro|metros)$/.test(u)) return n;
  // Sin unidad: metros, salvo una altura "grande" que solo puede ser centímetros (60 → 0,60 m).
  if (posicion === "alto" && n >= 10) return redondear(n / 100);
  if (n >= 40) return redondear(n / 100);
  return n;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Busca la primera medida "a × b [× c]" en el texto. */
export function buscarMedidas(texto: string): Medidas | null {
  const m = texto.match(MEDIDA);
  if (!m || m.index === undefined) return null;
  const [todo, a, ua, b, ub, c, uc] = m;
  // Si el separador fue "de" o "a", exigimos al menos una unidad explícita para no leer "1 de 2".
  if (/\s(de|a)\s/i.test(todo) && !(ua || ub || uc)) return null;
  const ancho = aMetros(a!, ua, "ancho");
  const fondo = aMetros(b!, ub, "fondo");
  const alto = c ? aMetros(c, uc, "alto") : null;
  if (ancho <= 0 || fondo <= 0 || ancho > 60 || fondo > 60 || (alto !== null && alto > 5)) return null;
  return { ancho, fondo, alto, desde: m.index, hasta: m.index + todo.length };
}

export function medidasATexto(m: Pick<Medidas, "ancho" | "fondo" | "alto">): string {
  const f = (n: number) => String(n).replace(".", ",");
  return `${f(m.ancho)} × ${f(m.fondo)}${m.alto !== null ? ` × ${f(m.alto)}` : ""} m`;
}
