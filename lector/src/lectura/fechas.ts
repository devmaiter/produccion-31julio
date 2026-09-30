/* Fechas y horas tal como aparecen en hojas de producción colombianas. */

const MESES: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1, feb: 2, febrero: 2, february: 2, mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4, may: 5, mayo: 5, jun: 6, junio: 6, june: 6, jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8, sep: 9, sept: 9, septiembre: 9, setiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10, nov: 11, noviembre: 11, november: 11, dic: 12, diciembre: 12, dec: 12, december: 12,
};
const DIAS = "lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lun|mar|mi[eé]|jue|vie|s[aá]b|dom";

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const iso = (a: number, m: number, d: number) =>
  m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

export interface FechaEncontrada { fecha: string; resto: string }

/** Busca una fecha en la línea: "Sábado 14 de noviembre de 2026", "sáb 12 sep",
 *  "12/09/2026", "2026-09-12", "Nov 14". Sin año usa `anio`. */
export function buscarFecha(linea: string, anio: number): FechaEncontrada | null {
  const t = sinTildes(linea.toLowerCase());
  let m = t.match(/\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/);
  if (m) return ok(iso(+m[1]!, +m[2]!, +m[3]!), m);
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](20\d\d|\d\d))?\b/);
  if (m && !/\d[:h]\d/.test(m[0])) {
    const a = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : anio;
    return ok(iso(a, +m[2]!, +m[1]!), m);
  }
  const mes = Object.keys(MESES).sort((a, b) => b.length - a.length).join("|");
  m = t.match(new RegExp(`\\b(?:(?:${DIAS})\\.?,?\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(${mes})\\.?(?:\\s+(?:de(?:l)?\\s+)?(20\\d\\d))?\\b`));
  if (m) return ok(iso(m[3] ? +m[3] : anio, MESES[m[2]!]!, +m[1]!), m);
  m = t.match(new RegExp(`\\b(${mes})\\.?\\s+(\\d{1,2})(?:,?\\s+(20\\d\\d))?\\b`));
  if (m) return ok(iso(m[3] ? +m[3] : anio, MESES[m[1]!]!, +m[2]!), m);
  return null;

  function ok(fecha: string | null, mm: RegExpMatchArray): FechaEncontrada | null {
    if (!fecha) return null;
    const i = mm.index ?? 0;
    return { fecha, resto: (linea.slice(0, i) + " " + linea.slice(i + mm[0].length)).replace(/\s+/g, " ").trim() };
  }
}

/** "Sábado 12" o "Día 2 · Sábado 12": día de la semana con número pero sin mes. */
export function buscarDiaSemana(linea: string): number | null {
  const m = sinTildes(linea.toLowerCase()).match(new RegExp(`\\b(?:${DIAS})\\.?\\s+(\\d{1,2})\\b(?!\\s*[:h.]\\d)`));
  return m ? +m[1]! : null;
}

/** "9:00", "9.00", "9h00", "21:30" → "HH:MM". */
export function normalizarHora(h: string): string | null {
  const m = h.trim().match(/^(\d{1,2})[:.h](\d{2})$/);
  if (!m) return null;
  const hh = +m[1]!, mm = +m[2]!;
  return hh < 24 && mm < 60 ? `${String(hh).padStart(2, "0")}:${m[2]}` : null;
}

export const HORA = String.raw`\d{1,2}[:.h]\d{2}`;
