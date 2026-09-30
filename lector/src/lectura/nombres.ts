/* Emparejar nombres de bandas escritos de distintas formas:
 *   "NICHE" ↔ "Grupo Niche", "ED MAVEWRICK" ↔ "Ed Maverick", "TAN BIOTICA" ↔ "Tan Biónica". */

export const clave = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const RELLENO = /^(grupo|banda|los|las|el|la|orquesta|ft\.?|feat\.?)$/i;

/** Las palabras que identifican al artista, sin "grupo", "los", etc. */
function palabras(nombre: string): string[] {
  return nombre.split(/[\s(]+/).map(clave).filter(p => p && !RELLENO.test(p));
}

function distancia(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length]![b.length]!;
}

/** Devuelve el nombre registrado que corresponde a `nombre`, o null si ninguno se parece. */
export function emparejar(nombre: string, registrados: readonly string[]): string | null {
  const k = clave(nombre);
  if (!k) return null;
  const exacto = registrados.find(r => clave(r) === k);
  if (exacto) return exacto;
  const ps = palabras(nombre);
  let mejor: { nombre: string; puntaje: number } | null = null;
  for (const r of registrados) {
    const rs = palabras(r);
    // Coincidencia de palabras con tolerancia a errores de tecleo (≤ 2 letras en palabras largas).
    const iguales = ps.filter(p => rs.some(q => p === q || (p.length >= 5 && q.length >= 5 && distancia(p, q) <= 2))).length;
    const puntaje = iguales / Math.max(ps.length, 1);
    const cubre = iguales / Math.max(rs.length, 1);
    if (iguales && puntaje >= 0.5 && (cubre >= 0.5 || iguales >= 2) && (!mejor || puntaje + cubre > mejor.puntaje)) {
      mejor = { nombre: r, puntaje: puntaje + cubre };
    }
  }
  return mejor?.nombre ?? null;
}
