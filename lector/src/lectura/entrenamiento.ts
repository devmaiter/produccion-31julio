/* El texto de entrenamiento (tests/fixtures/entrenamiento/*.txt): casos con renglones de backline y
 * las piezas que deben salir, de izquierda a derecha y de arriba abajo. Lo usan `npm run entrenar`
 * y las pruebas.
 *
 *   ## nombre del caso
 *   texto tal cual viene en el rider
 *   => 2 | Crash 16"          una pieza: cantidad | descripción
 *   => (nada)                 no debe salir nada */
import { lineasDeTexto, type Documento } from "./documento";
import { interpretar } from "./interpretar";

export interface Esperada { cantidad: number; texto: string }
export interface Caso { nombre: string; renglones: string[]; esperadas: Esperada[] }
export interface Resultado { caso: Caso; salio: Esperada[]; aciertos: boolean[]; pasa: boolean }

export function leerCasos(txt: string): Caso[] {
  const casos: Caso[] = [];
  for (const linea of txt.split(/\r?\n/)) {
    if (linea.startsWith("## ")) { casos.push({ nombre: linea.slice(3).trim(), renglones: [], esperadas: [] }); continue; }
    const caso = casos.at(-1);
    if (!caso || linea.startsWith("#") || !linea.trim()) continue;
    const m = linea.match(/^=>\s*(.*)$/);
    if (!m) { caso.renglones.push(linea); continue; }
    if (/^\(nada\)$/.test(m[1]!.trim())) continue;
    const [cant, ...resto] = m[1]!.split("|");
    caso.esperadas.push({ cantidad: Number(cant!.trim()), texto: resto.join("|").trim() });
  }
  return casos;
}

const palabras = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/["”″“’'′]/g, "").split(/[^a-z0-9.]+/).map(w => w.replace(/^\.+|\.+$/g, "")).filter(Boolean);

/** Misma cantidad y mismas palabras (sin mayúsculas, tildes ni comillas); se permite una palabra de más. */
export function coincide(esperada: Esperada, salio: Esperada): boolean {
  if (esperada.cantidad !== salio.cantidad) return false;
  const quiero = palabras(esperada.texto), tengo = palabras(salio.texto);
  const sobran = tengo.filter(w => !quiero.includes(w) && !["de", "x", "con", "para"].includes(w));
  return quiero.every(w => tengo.includes(w)) && sobran.length <= 1;
}

export function medirCaso(caso: Caso): Resultado {
  const doc: Documento = { nombre: "entrenamiento", tipo: "texto", lineas: lineasDeTexto(["BACKLINE", ...caso.renglones].join("\n")), avisos: [] };
  const salio = interpretar([doc], { artista: "Los Rayos" }).items.map(i => ({ cantidad: i.cantidad, texto: i.descripcion }));
  const n = Math.max(salio.length, caso.esperadas.length);
  const aciertos = Array.from({ length: n }, (_, k) => !!caso.esperadas[k] && !!salio[k] && coincide(caso.esperadas[k]!, salio[k]!));
  return { caso, salio, aciertos, pasa: aciertos.every(Boolean) };
}
