/* Qué lleva una batería, se escriba como se escriba.
 *
 * Cada quien escribe el rider a su manera ("KD 22”", "Kick 22x18", "Bombo 22"", "1 22" Bass drum";
 * "03 x Toms 10/12/16" o un tom por renglón), pero una batería siempre son las mismas piezas: bombo,
 * redoblante, toms, tom de piso, hi-hat, platillos, sus bases, pedal, silla y alfombra. Aquí se
 * reconoce la pieza y su medida para comparar baterías pieza por pieza, sin importar el idioma
 * ni cómo se repartieron las filas. */

export type PiezaBateria =
  | "bombo" | "redoblante" | "tom" | "tom de piso"
  | "hi-hat" | "crash" | "ride" | "china" | "splash"
  | "máquina de hi-hat" | "base de redoblante" | "base de platillo" | "soporte de tom"
  | "pedal de bombo" | "silla" | "alfombra";

/* El orden importa: las bases y los pedales nombran el instrumento ("hi-hat stand", "pedal de bombo"),
 * así que se miran antes que el instrumento. */
const REGLAS: ReadonlyArray<readonly [PiezaBateria, RegExp]> = [
  // "Hi-hat stand", "Máquina de Hi-Hat", "STAND DW 5000 HI-HAT": la base del hi-hat, aunque la marca vaya en medio.
  ["máquina de hi-hat", /\b(hi[\s-]?hats?|hihats?|hit[\s-]?hats?|charles)\s*(stands?|machines?)\b|\b(stands?|bases?|soportes?|m[aá]quinas?)\b[^,;]{0,20}?\b(hi[\s-]?hats?|hihats?|hit[\s-]?hats?|charles)\b/i],
  ["base de redoblante", /\b(snare|redoblante|tarola)\s*stands?\b|\b(stands?|bases?|soportes?)\s+(de\s+|para\s+(el\s+)?|for\s+)?(snares?|redoblantes?|tarolas?|snare drums?)\b/i],
  ["base de platillo", /\b(cymbals?|platillos?|boom)\s*(boom\s*)?stands?\b|\b(stands?|bases?|soportes?)\s+(boom\s+)?(de\s+|para\s+)?(platillos?|platos?|cymbals?)\b|\bboom stands?\b/i],
  ["soporte de tom", /\btom\s*(holders?|stands?)\b|\bdouble tom\b|\b(soportes?|stands?)\s+(de\s+|para\s+)?toms?\b/i],
  ["pedal de bombo", /\b(kick|bass drum|bass|bombo)\s*(drum\s*)?pedals?\b|\bpedal(es)?\s+(de\s+|para\s+)?bombo\b|\b(doble|double|twin)\s+pedal\b|\bpedal de bombo\b/i],
  ["silla", /\b(drum\s*)?(throne|stool)s?\b|\bbanqueta\b|\bsill[ií]n\b|\bsilla de bater[ií]a\b|\bsilla bater[ií]a\b/i],
  ["alfombra", /\b(drum\s*)?(rug|carpet|mat)s?\b|\balfombras?\b|\btapetes?\b/i],
  ["tom de piso", /\bfloor\s*toms?\b|\btoms?\s+(de\s+)?(piso|pie)\b/i],
  ["bombo", /\b(kick|bass\s*drum|bombo|kd|bd)\b/i],
  ["redoblante", /\b(snares?|redoblantes?|tarolas?|piccolo)\b|^caja\b/i],
  ["tom", /\b(rack\s*)?toms?\b/i],
  ["hi-hat", /\b(hi[\s-]?hats?|hihats?|hit[\s-]?hats?|charles)\b/i],
  ["crash", /\bcrash/i],
  ["ride", /\bride\b/i],
  ["china", /\bchina\b/i],
  ["splash", /\bsplash\b/i],
];

/** La pieza de batería que nombra el texto, o null si no es de batería. */
export function piezaDeBateria(texto: string): PiezaBateria | null {
  // "KICK DRUM: EVANS POWER STROKE", "Parches: Remo…": son los parches recomendados, no otro tambor.
  if (/^\s*parches?\b|\b(evans|remo|aquarian)\b/i.test(texto) && !/\d\s*["”″]/.test(texto)) return null;
  for (const [pieza, re] of REGLAS) if (re.test(texto)) return pieza;
  // "Kcik 22”", "Snrae": un error de dedo en el nombre de la pieza también cuenta.
  const corregido = corregirDedo(texto);
  if (corregido !== texto) for (const [pieza, re] of REGLAS) if (re.test(corregido)) return pieza;
  return null;
}

/** Nombres de pieza que se escriben mal seguido ("Kcik", "Snrae", "Crahs"). */
const VOCABULARIO = ["kick", "snare", "crash", "splash", "china", "bombo", "throne", "cymbal", "cymbals", "floor", "redoblante", "tarola", "hihat"];

/** Cambia cada palabra que está a un error de dedo (una letra de más, de menos, cambiada o dos letras
 *  al revés) de un nombre de pieza por ese nombre. Solo palabras de 4 letras o más. */
function corregirDedo(texto: string): string {
  return texto.replace(/\p{L}{4,}/gu, w => VOCABULARIO.find(v => v !== w.toLowerCase() && aUnError(w.toLowerCase(), v)) ?? w);
}

function aUnError(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const dif = [...a].map((c, i) => c !== b[i] ? i : -1).filter(i => i >= 0);
    // Una letra cambiada, o dos letras seguidas al revés ("kcik" → "kick").
    return dif.length === 1 || (dif.length === 2 && dif[1] === dif[0]! + 1 && a[dif[0]!] === b[dif[1]!] && a[dif[1]!] === b[dif[0]!]);
  }
  const [corta, larga] = a.length < b.length ? [a, b] : [b, a];
  for (let i = 0; i < larga.length; i++) if (larga.slice(0, i) + larga.slice(i + 1) === corta) return true;
  return false;
}

/** Las medidas en pulgadas, en el orden en que aparecen: "22” x 18”" → [22]; "8” - 10”- 12”" → [8, 10, 12].
 *  La segunda medida de "14 x 6.5" es la profundidad, no otra pieza. */
export function medidasDe(texto: string): number[] {
  // "14 x 6.5" y "5.5 x 14": el diámetro es la mayor de las dos (la otra es la profundidad).
  const sinProfundidad = texto.replace(/(\d{1,2}(?:[.,]\d+)?)\s*["”″’'′]*\s*[x×]\s*(\d{1,2}(?:[.,]\d+)?)\s*["”″’'′]*/gi,
    (_, a: string, b: string) => `${Math.round(Math.max(Number(a.replace(",", ".")), Number(b.replace(",", "."))))}”`);
  const out: number[] = [];
  // "Tom piso 14 o 16 x 14”": la primera opción también cuenta, aunque no lleve comillas.
  for (const m of sinProfundidad.matchAll(/(?<![\d.,])(\d{1,2})(?:[.,]\d+)?\s*(?:["”″]|[’'′]{2}|pulg|(?=\s+(?:o|or|ó)\s+\d))/gi)) out.push(Number(m[1]));
  // "Toms 10/12/16", "KICK 22": sin comillas, después del nombre del tambor o platillo.
  if (!out.length) {
    const m = sinProfundidad.match(/\b(?:kick|bombo|kd|bd|toms?|floor|snare|redoblante|tarola|hi[\s-]?hats?|hihats?|crash|ride|china|splash)\b\D{0,12}?((?:\d{1,2}\s*[/,y-]?\s*)+)/i);
    if (m) for (const n of m[1]!.matchAll(/\d{1,2}/g)) if (Number(n[0]) >= 6 && Number(n[0]) <= 28) out.push(Number(n[0]));
  }
  return out;
}

export interface PiezaContada { pieza: PiezaBateria; medida: number | null; cantidad: number }

/** Las piezas de una fila: "03 x Toms 10” / 12” / 16”" → tom 10, tom 12, tom 16; "2 Crash 18”" → 2 crash 18.
 *  Con opciones ("China 16” / 18”", "Tom piso 14 o 16") cuenta la primera medida. */
export function piezasDeFila(cantidad: number, texto: string): PiezaContada[] {
  // "Floor Tom 16”, Redoblante 14”x6”": dos piezas distintas escritas en la misma fila.
  const partes = texto.split(/,\s+/);
  const deCada = partes.map(piezaDeBateria);
  if (partes.length >= 2 && deCada.every(Boolean) && new Set(deCada).size >= 2) return partes.flatMap(p => piezasDeFila(cantidad, p));
  const pieza = piezaDeBateria(texto);
  if (!pieza) return [];
  // Las bases, la silla y la alfombra no se distinguen por pulgadas ("tapete 2.40 x 2.40" son metros).
  const conMedida = !/^(máquina de hi-hat|base de|soporte de|pedal de|silla|alfombra)/.test(pieza);
  const medidas = conMedida ? medidasDe(texto) : [];
  if (medidas.length >= 2 && medidas.length === cantidad) return medidas.map(medida => ({ pieza, medida, cantidad: 1 }));
  return [{ pieza, medida: medidas[0] ?? null, cantidad }];
}

/** Compara dos baterías pieza por pieza. Una pieza sin medida en un lado se empareja con la misma pieza del otro. */
export function compararBaterias(a: readonly PiezaContada[], b: readonly PiezaContada[]) {
  const clave = (p: PiezaContada) => `${p.pieza}|${p.medida ?? ""}`;
  const sumar = (ps: readonly PiezaContada[]) => {
    const m = new Map<string, number>();
    for (const p of ps) m.set(clave(p), (m.get(clave(p)) ?? 0) + p.cantidad);
    return m;
  };
  const ma = sumar(a), mb = sumar(b);
  const iguales: string[] = [], soloA: string[] = [], soloB: string[] = [];
  let coinciden = 0, total = 0;
  for (const k of new Set([...ma.keys(), ...mb.keys()])) {
    let x = ma.get(k) ?? 0, y = mb.get(k) ?? 0;
    // Sin medida en un lado: se completa con la misma pieza del otro lado que sobre.
    if (x !== y) {
      const [pieza, medida] = k.split("|");
      if (!medida) {
        for (const [k2, v] of (x < y ? ma : mb)) if (k2 !== k && k2.startsWith(pieza + "|")) {
          const otro = x < y ? mb.get(k2) ?? 0 : ma.get(k2) ?? 0;
          const libre = v - otro;
          if (libre > 0) { const t = Math.min(libre, Math.abs(x - y)); if (x < y) x += t; else y += t; }
        }
      }
    }
    const comun = Math.min(x, y);
    coinciden += comun; total += Math.max(x, y);
    const nombre = k.replace("|", " ").trim() + (k.endsWith("|") ? "" : "”");
    if (comun) iguales.push(`${comun} ${nombre}`);
    if (x > comun) soloA.push(`${x - comun} ${nombre}`);
    if (y > comun) soloB.push(`${y - comun} ${nombre}`);
  }
  return { coinciden, total, iguales, soloA, soloB };
}
