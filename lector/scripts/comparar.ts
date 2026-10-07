/* Compara la batería que sale del rider con la que quedó en la planilla OML, pieza por pieza
 * (bombo 22, toms 10/12, hi-hat 14…), sin importar el idioma ni cómo se repartieron las filas.
 *
 *   npm run comparar -- planilla.xlsx "Nombre de la banda" rider.pdf
 *
 * En la planilla se busca la columna de la banda (fila 2: "Banda | Backline …") y se leen sus
 * filas "Cant | Requerimiento". Todo corre en el computador; nada se guarda. */
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { compararBaterias, piezasDeFila, type PiezaContada } from "../src/dominio/bateria";
import { filasDelRider, interpretar, leerArchivo, type RenglonLeido } from "../src/lectura";
import { lectoresNode } from "../src/lectura/node/lectores";

const [planilla, banda, rider] = process.argv.slice(2);
if (!planilla || !banda || !rider) throw new Error('Uso: npm run comparar -- planilla.xlsx "Banda" rider.pdf');
const clave = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const texto = (v: ExcelJS.CellValue): string => v == null ? "" : typeof v === "object" ? ("richText" in v ? v.richText.map(r => r.text).join("") : "text" in v ? String(v.text) : "result" in v ? String(v.result ?? "") : "") : String(v);

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(readFileSync(planilla) as never);
/* Una silla en la sección de teclados, bajo o guitarra es del músico, no de la batería
 * ("Throne (K&M)" del tecladista), salvo que diga que es de batería. */
const DE_OTRO = /key|tecl|piano|bass|bajo|guit|gtr/i;
const contar = (cant: number, t: string, seccion: string): PiezaContada[] =>
  piezasDeFila(cant, t).filter(p => p.pieza !== "silla" || !DE_OTRO.test(seccion) || /drum|bater/i.test(t));
const deExcel: PiezaContada[] = [];
let hallada = false;
for (const ws of wb.worksheets) {
  for (let col = 1; col < Math.min(ws.columnCount, 200); col++) {
    if (!clave(texto(ws.getRow(2).getCell(col).value)).startsWith(clave(banda))) continue;
    // Cada banda ocupa 4 columnas (Cant | Requerimiento | Cant | Propuesta); el nombre puede quedar
    // en la de la cantidad o en la del requerimiento.
    const c = Math.floor((col - 1) / 4) * 4 + 1;
    hallada = true;
    let seccion = "";
    ws.eachRow((row, r) => {
      if (r < 6) return;
      const cant = Number(texto(row.getCell(c).value).replace(/\D/g, ""));
      const req = texto(row.getCell(c + 1).value);
      if (cant) deExcel.push(...contar(cant, req, seccion)); else if (req) seccion = req;
    });
    break;
  }
  if (hallada) break;
}
if (!hallada) throw new Error(`No encontré la columna de "${banda}" en la planilla.`);

const lectores = lectoresNode();
const docs = await leerArchivo(basename(rider), new Uint8Array(readFileSync(rider)), "", lectores);
await lectores.cerrar();
const traza: RenglonLeido[] = [];
const filas = filasDelRider(interpretar(docs, { traza }), traza);
let seccionRider = "";
const delRider = filas.flatMap(f => {
  if (f.tipo === "seccion") seccionRider = f.texto;
  return f.tipo === "item" ? contar(f.cantidad ?? 1, f.texto, seccionRider) : [];
});

const r = compararBaterias(deExcel, delRider);
console.log(`${banda}: ${r.coinciden} de ${r.total} piezas de batería iguales (${Math.round(100 * r.coinciden / Math.max(1, r.total))} %)`);
if (r.soloA.length) console.log(`  solo en la planilla: ${r.soloA.join(", ")}`);
if (r.soloB.length) console.log(`  solo en lo que leyó: ${r.soloB.join(", ")}`);
