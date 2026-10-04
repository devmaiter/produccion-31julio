/* La planilla de backline de una banda tal como la arma producción (formato del inventario de
 * OML, el que todos conocen): encabezado "Stage | fecha", "Banda | Backline Stage | fecha",
 * "SET A", "Cat / Rider" y la tabla "Cant | Requerimiento | Cant | Propuesta".
 *
 * El lector llena el Requerimiento con lo que pide el rider (secciones, "01 x" + equipo y las
 * notas sin cantidad, como el modelo sugerido); la Propuesta queda vacía para quien la arma.
 * Así no reemplaza el Excel de siempre: lo empieza. */
import ExcelJS from "exceljs";
import type { Extraccion } from "./esquema";
import { categorizar } from "../dominio/categorias";
import { esTituloGenerico, familiaDe, type RenglonLeido } from "./interpretar";

export interface FilaPlanilla {
  tipo: "seccion" | "item" | "nota";
  /** Solo en los ítems. */
  cantidad: number | null;
  texto: string;
  /** Lo que se le va a poner, si quien arma la planilla ya lo escribió. */
  propuesta?: { cantidad: string; texto: string };
}

export interface Planilla {
  /** "Stage 4" */
  escenario: string;
  /** AAAA-MM-DD, o el texto que se quiera mostrar */
  fecha: string;
  banda: string;
  /** "SET A" */
  set: string;
  /** Categoría en estrellas, "★★★☆☆"; vacío si no se sabe */
  cat: string;
  /** Enlace o nombre del rider */
  rider: string;
  filas: FilaPlanilla[];
}

/** Las filas del Requerimiento, en el orden del rider. Con la traza salen también los títulos de
 *  sección y las notas sin cantidad; sin ella (p. ej. un Excel), se arman con los grupos de los ítems. */
export function filasDelRider(ext: Extraccion, traza?: readonly RenglonLeido[], artista?: string): FilaPlanilla[] {
  const filas: FilaPlanilla[] = [];
  const titulo = (t: string) => t.replace(/[\s:·|–—-]+$/, "").toUpperCase();
  // "bombo 22x18”" → "Bombo 22x18”", como se escribe en la planilla.
  const mayuscula = (t: string) => t.charAt(0).toLocaleUpperCase("es") + t.slice(1);
  if (traza?.some(r => r.etiqueta === "item")) {
    let dentro = false;
    for (const r of traza) {
      const it = r.item !== null ? ext.items[r.item] : undefined;
      if (r.etiqueta === "item" && it) {
        if (artista && it.artista !== artista) continue;
        // Lo que la banda dice que trae va marcado: producción no tiene que conseguirlo.
        filas.push({ tipo: "item", cantidad: it.cantidad, texto: mayuscula(it.descripcion) + (it.proveedor === "ARTISTA" ? " (lo trae la banda)" : "") });
        dentro = true;
      } else if (r.etiqueta === "grupo" && r.seccion === "backline") {
        filas.push({ tipo: "seccion", cantidad: null, texto: titulo(r.texto) });
        dentro = true;
      } else if (r.etiqueta === "nota" && r.seccion === "backline" && dentro && r.grupo && !CONTRATO.test(r.texto)) {
        // "Sugerimos: Tama Star Classic…" → "Tama Star Classic…", como se escribe en la planilla.
        filas.push({ tipo: "nota", cantidad: null, texto: mayuscula(r.texto.replace(/^(sugerimos|sugerido|sugerencia|sugerida|preferiblemente|preferible|preferido|preferida|recomendado|recomendamos|suggested|preferred|recommended|nota|note)\s*[:.-]\s*/i, "")) });
      }
    }
  } else {
    let grupo: string | null | undefined;
    for (const it of ext.items) {
      if (artista && it.artista !== artista) continue;
      if (it.grupo !== grupo) { grupo = it.grupo; if (grupo) filas.push({ tipo: "seccion", cantidad: null, texto: titulo(grupo) }); }
      filas.push({ tipo: "item", cantidad: it.cantidad, texto: mayuscula(it.descripcion) });
    }
  }
  // Una sección sin ítems solo va si es de un instrumento ("TECLADO / PIANO" con "la banda lleva su
  // teclado…"); "TRANSFORMADORES…" o "OTHER" con párrafos del contrato debajo no son backline.
  const quedan: FilaPlanilla[] = [];
  for (let i = 0; i < filas.length; i++) {
    if (filas[i]!.tipo !== "seccion") { quedan.push(filas[i]!); continue; }
    let fin = i + 1;
    while (fin < filas.length && filas[fin]!.tipo !== "seccion") fin++;
    const cuerpo = filas.slice(i + 1, fin);
    const deInstrumento = esTituloGenerico(filas[i]!.texto) || !!familiaDe(filas[i]!.texto) || !["Otro", "Cables y energía", "Escenario"].includes(categorizar(filas[i]!.texto));
    if (cuerpo.some(f => f.tipo === "item") || (cuerpo.length && deInstrumento)) quedan.push(filas[i]!, ...cuerpo);
    i = fin - 1;
  }
  return quedan;
}

/** Indicaciones del contrato: no son parte del backline aunque caigan dentro de una sección. */
const CONTRATO = /(deber[aá]n?|\bdebe\b|contratante|el artista|transporte|hotel|boletos?|vuelos?|choferes?)/i;

/** "01 x", como se escribe la cantidad del requerimiento. */
export const cantidadPlanilla = (n: number | null) => (n === null ? "" : `${String(n).padStart(2, "0")} x`);

/** "2026-09-12" → "12/09/2026" (y "12/09" corto); otro texto se deja igual. */
export function fechaPlanilla(f: string): { larga: string; corta: string } {
  const m = f.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { larga: `${m[3]}/${m[2]}/${m[1]}`, corta: `${m[3]}/${m[2]}` } : { larga: f, corta: f };
}

export async function planillaXlsx(p: Planilla): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(nombreHoja(p.banda), { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 9 }, { width: 50 }, { width: 9 }, { width: 50 }];
  const letra = { name: "Times New Roman", size: 10 };
  const borde = { style: "thin" as const, color: { argb: "FF000000" } };
  const bordes = { top: borde, left: borde, bottom: borde, right: borde };
  const relleno = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
  const f = fechaPlanilla(p.fecha);

  // 1 · Stage | fecha
  ws.mergeCells("A1:B1"); ws.mergeCells("C1:D1");
  ws.getCell("A1").value = p.escenario;
  ws.getCell("C1").value = f.larga;
  for (const c of ["A1", "C1"]) {
    Object.assign(ws.getCell(c), { font: { name: "Times New Roman", size: 20, bold: true, color: { argb: "FFFFFFFF" } }, fill: relleno("FF434343"), alignment: { horizontal: "center", vertical: "middle" } });
  }
  ws.getRow(1).height = 44;
  // 2 · Banda | Backline Stage | fecha
  ws.getCell("B2").value = [p.banda, `Backline ${p.escenario}`, f.corta].filter(Boolean).join(" | ");
  ws.getRow(2).height = 30;
  ws.getRow(2).alignment = { vertical: "middle" };
  // 3 · SET A
  ws.mergeCells("A3:D3");
  Object.assign(ws.getCell("A3"), { value: p.set, font: { ...letra, bold: true }, fill: relleno("FFA4C2F4"), alignment: { horizontal: "center" } });
  // 4 · Cat / Rider
  Object.assign(ws.getCell("A4"), { value: "Cat:", font: { ...letra, bold: true }, alignment: { horizontal: "center", vertical: "middle" } });
  Object.assign(ws.getCell("B4"), { value: p.cat, fill: relleno("FF939A28"), alignment: { vertical: "middle" } });
  Object.assign(ws.getCell("C4"), { value: "Rider:", font: { ...letra, bold: true }, alignment: { horizontal: "center", vertical: "middle" } });
  ws.getCell("D4").value = /^https?:\/\//i.test(p.rider) ? { text: p.rider, hyperlink: p.rider } : p.rider;
  ws.getCell("D4").alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(4).height = 30;
  // 5 · encabezados
  ["Cant", "Requerimiento", "Cant", "Propuesta"].forEach((t, i) => {
    Object.assign(ws.getRow(5).getCell(i + 1), { value: t, font: { ...letra, bold: true }, fill: relleno("FFEFEFEF"), alignment: { horizontal: i % 2 ? "left" : "center" } });
  });
  // 6… · el requerimiento y, si ya se escribió, la propuesta
  p.filas.forEach((fila, k) => {
    const r = ws.getRow(6 + k);
    r.getCell(1).value = fila.tipo === "item" ? cantidadPlanilla(fila.cantidad) : "";
    r.getCell(2).value = fila.texto;
    if (fila.propuesta?.cantidad) r.getCell(3).value = fila.propuesta.cantidad;
    if (fila.propuesta?.texto) r.getCell(4).value = fila.propuesta.texto;
    r.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(2).alignment = { wrapText: true, vertical: "middle" };
    r.getCell(4).alignment = { wrapText: true, vertical: "middle" };
  });
  const ultima = 5 + p.filas.length;
  for (let r = 1; r <= ultima; r++) {
    for (let c = 1; c <= 4; c++) {
      const celda = ws.getRow(r).getCell(c);
      celda.border = bordes;
      if (r >= 2 && r !== 3) celda.font = { ...letra, ...(celda.font?.bold ? { bold: true } : {}), ...(c === 4 && r === 4 ? { color: { argb: "FF1155CC" }, underline: true } : {}) };
    }
  }
  return new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer);
}

/** Excel no deja ciertos caracteres en el nombre de la hoja ni más de 31 letras. */
function nombreHoja(banda: string): string {
  return (banda.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim() || "Backline").slice(0, 31);
}
