import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { documentosAMarkdown, leerArchivo, leerLibro, libroAMarkdown, renglon, type Documento, type Libro } from "../src/lectura";
import { lectoresNode } from "../src/lectura/node/lectores";

const lectores = lectoresNode();
afterAll(() => lectores.cerrar());
const fixture = (f: string) => new Uint8Array(readFileSync(`tests/fixtures/${f}`));

describe("texto antes de interpretar", () => {
  it("renglón: columnas con │ y OCR dudoso con su confianza", () => {
    expect(renglon({ texto: "Snare stand    2   CN" })).toBe("Snare stand │ 2 │ CN");
    expect(renglon({ texto: "Drum throne  1", confianza: 62 })).toBe("Drum throne  1  ⟨62 %⟩");
    expect(renglon({ texto: "Drum throne", confianza: 90 })).toBe("Drum throne");
  });

  it("PDF: página por página, renglones numerados y columnas visibles", async () => {
    const md = documentosAMarkdown(await leerArchivo("hoja-backline.pdf", fixture("hoja-backline.pdf"), "", lectores));
    expect(md).toContain("# hoja-backline.pdf\nPDF · 1 página · 19 renglones");
    expect(md).toContain("## Página 1\n```text\n 1  FESTIVAL SOL DE NOCHE 2026 - ESCENARIO LUNA");
    expect(md).toContain(" 7  Snare stand │ 2 │ CN");
    expect(md).toContain("19  Guitar stand │ 4 │ CN\n```");
  });

  it("correo: el cuerpo y cada adjunto, con la numeración de corrido y las páginas sin leer", () => {
    const docs: Documento[] = [
      { nombre: "correo.eml", tipo: "correo", asunto: "Rider Los Rayos", fechaReferencia: "2026-09-29", avisos: [], lineas: [{ texto: "Hola, va el rider." }, { texto: "" }, { texto: "Saludos" }] },
      {
        nombre: "rider.pdf", tipo: "pdf", avisos: ["rider.pdf, página 2: es una imagen escaneada y aquí no hay OCR; súbela como foto."],
        paginas: [{ numero: 1, origen: "texto" }, { numero: 2, origen: "sin-leer" }],
        lineas: [{ texto: "BASS", pagina: 1 }, { texto: "Ampeg SVT   1", pagina: 1 }],
      },
    ];
    expect(documentosAMarkdown(docs)).toBe([
      "# correo.eml", "Correo · Asunto: Rider Los Rayos · Fecha: 2026-09-29 · 2 renglones", "",
      "```text", "1  Hola, va el rider.", "", "2  Saludos", "```", "",
      "## Adjunto: rider.pdf", "PDF · 2 páginas · 1 escaneada · 2 renglones",
      "> ⚠ rider.pdf, página 2: es una imagen escaneada y aquí no hay OCR; súbela como foto.", "",
      "### Página 1", "```text", "3  BASS", "4  Ampeg SVT │ 1", "```", "",
      "### Página 2 · escaneada, sin leer (aquí no hay OCR)", "",
    ].join("\n"));
  });

  it("Excel: fila por fila con su número, sin columnas vacías a la izquierda y celdas largas debajo", () => {
    const celdas: Record<string, string> = { "2,2": "LOS RAYOS", "2,3": "BAJO\n1 Ampeg SVT\n\n1 Caja 8x10", "2,4": "ok", "3,2": "TOTAL", "3,4": "2" };
    const libro: Libro = {
      hojas: [{ nombre: "Backline Day 1", filas: 3, columnas: 4, celda: (f, c) => celdas[`${f},${c}`] ?? "", imagenes: [{ bytes: new Uint8Array(), extension: "png", filaDesde: 5, filaHasta: 20, colDesde: 1, colHasta: 28 }], combinadas: [], anchos: [] }],
      hoja: () => undefined,
    };
    expect(libroAMarkdown(libro, "desglose.xlsx")).toBe([
      "# desglose.xlsx", "Excel · 1 hoja", "",
      "## Hoja «Backline Day 1» · 3 filas × 4 columnas", "- Imagen (png) en A5:AB20", "_Desde la columna B._",
      "```text", "2  LOS RAYOS │ ↓ C │ ok", "     BAJO", "     1 Ampeg SVT", "     1 Caja 8x10", "3  TOTAL │  │ 2", "```", "",
    ].join("\n"));
  });

  it("Excel: una celda combinada sale una sola vez (exceljs la copia en todo el rango)", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("ST4-D1");
    ws.getCell("A1").value = "LOS RAYOS";
    ws.mergeCells("A1:C1");
    ws.getCell("A2").value = 2; ws.getCell("B2").value = "Snare stand"; ws.getCell("C2").value = "CN";
    ws.getColumn(2).width = 30;
    const libro = await leerLibro(new Uint8Array(await wb.xlsx.writeBuffer()));
    const h = libro.hojas[0]!;
    expect(h.celda(1, 3)).toBe("LOS RAYOS"); // así lo entrega exceljs
    expect(h.combinadas).toEqual([{ filaDesde: 1, filaHasta: 1, colDesde: 1, colHasta: 3 }]);
    expect(h.anchos[1]).toBe(30);
    expect(libroAMarkdown(libro, "oml.xlsx")).toContain("```text\n1  LOS RAYOS\n2  2 │ Snare stand │ CN\n```");
  });

  it("Excel real: el desglose de Cordillera muestra el rider de cada banda renglón por renglón", async () => {
    const md = libroAMarkdown(await leerLibro(fixture("desglose-cordillera-2026.xlsx")), "desglose.xlsx");
    expect(md).toContain("## Hoja «Backline Day 1»");
    expect(md).toMatch(/\n3 {2}NELDA PIÑA │ ↓ C │ check\n {5}La agrupación lleva\n {5}• Tambora tradicional\n/);
  });
});
