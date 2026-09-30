import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { leerDesglose, leerLibro, leerTablas } from "../src/lectura";

/** Un libro como el inventario de OML: bloques "Cant | Requerimiento | Cant | Propuesta" por banda y una hoja plana. */
async function libroOml(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const h = wb.addWorksheet("ST4-D1");
  h.addRow(["Stage 4", "Stage 4", "2026-09-12", "2026-09-12", "Stage 4", "Stage 4", "2026-09-12", "2026-09-12"]);
  h.addRow(["", "Kapanga | Backline Stage 4 | 12/09", "", "", "", "Poligamia | Backline Stage 4 | 12/09", "", ""]);
  h.addRow(["Cat:", "★★☆☆☆", "Rider:", "https://drive.google.com/x", "Cat:", "★★★☆☆", "Rider:", "https://drive.google.com/y"]);
  h.addRow(["Cant", "Requerimiento", "Cant", "Propuesta", "Cant", "Requerimiento", "Cant", "Propuesta"]);
  h.addRow(["", "BATERÍA", "", "DRUM", "", "BATERÍA", "", "Drum"]);
  h.addRow(["", "Sonor Pro Lite o similar", "", "PEARL MASTER CUSTOM", "", "DW Collector", "1", "Mapex Saturn"]);
  h.addRow(["01 x", "Bombo 22”", "1", '22" KICK', "01 x", 'Bombo 24"', "1", 'kick 24"']);
  h.addRow(["03 x", "Rack Toms 8”, 10” y 12”", "3", '8" 10" 12" RACK TOM', "01 x", 'Tarola 14"', "1", 'rack tom 12"']);
  h.addRow(["", "", "", "HARDWARE", "", "", "", "HARDWARE"]);
  h.addRow(["06 x", "soportes de platillo con boom", "6", "BOOM CYMBALS STAND", "05 x", "Base de Platillo Tipo Boom", "5", "BOOM CYMBALS STAND"]);
  const e = wb.addWorksheet("EQUIPO SOLICITADO");
  e.addRow(["CANTIDAD", "DRUMS", "DIAS", "VALOR"]);
  e.addRow([1, "DW COLLECTORS SERIES", 2, 800000]);
  e.addRow([1, '22" KICK', 2, ""]);
  e.addRow(["", "HARDWARE", "", ""]);
  e.addRow([5, "BOOM CYMBAL STAND", 2, ""]);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

describe("tablas de backline en Excel", () => {
  it("un bloque por banda: ítems de la propuesta, el rider como requisito", async () => {
    const libro = await leerLibro(await libroOml());
    const e = leerTablas(libro);
    expect(e.artistas).toEqual(["Kapanga", "Poligamia", "Equipo Solicitado"]);
    expect(e.escenarios).toEqual(["Stage 4"]);
    expect(e.dias.map(d => d.fecha)).toEqual(["2026-09-12"]);
    const kap = e.items.filter(i => i.artista === "Kapanga");
    expect(kap.map(i => `${i.cantidad} ${i.descripcion} [${i.grupo}]`)).toEqual([
      "1 PEARL MASTER CUSTOM [Drum]", '1 22" KICK [Drum]', '3 8" 10" 12" RACK TOM [Drum]', "6 BOOM CYMBALS STAND [Hardware]",
    ]);
    expect(kap[0]).toMatchObject({ dudoso: true, nota: "sin cantidad en la hoja", fecha: "2026-09-12", categoria: "Batería" });
    expect(kap[3]!.categoria).toBe("Bases");
    const req = e.requisitos.find(r => r.artista === "Kapanga")!;
    expect(req.tema).toBe("backline");
    expect(req.texto).toContain("1 Bombo 22”");
    expect(req.texto).toContain("6 soportes de platillo con boom");
    expect(e.items.filter(i => i.artista === "Poligamia").map(i => i.descripcion)).toEqual(["Mapex Saturn", 'kick 24"', 'rack tom 12"', "BOOM CYMBALS STAND"]);
  });
  it("una hoja plana sin banda: columnas extra como nota y aviso de que no dice la banda", async () => {
    const e = leerTablas(await leerLibro(await libroOml()));
    const eq = e.items.filter(i => i.artista === "Equipo Solicitado");
    expect(eq.map(i => `${i.cantidad} ${i.descripcion} [${i.grupo ?? "-"}]`)).toEqual(["1 DW COLLECTORS SERIES [-]", '1 22" KICK [-]', "5 BOOM CYMBAL STAND [Hardware]"]);
    expect(eq[0]!.nota).toBe("dias: 2 · valor: 800000");
    expect(e.avisos).toEqual([`EQUIPO SOLICITADO: la tabla no dice de qué banda es; quedó como "Equipo Solicitado".`]);
  });
  it("leerDesglose usa las tablas cuando el libro no es el desglose y empareja con el evento", async () => {
    const base = { evento: { id: "x", nombre: "X", lugar: null, ciudad: null, desde: "2026-09-12", hasta: "2026-09-13" }, escenarios: [], dias: [], artistas: [{ id: "kapanga", eventoId: "x", nombre: "KAPANGA" }], bloques: [], items: [], stagePlots: [], zonas: [], puestos: [], canales: [], requisitos: [] };
    const { extraccion: e } = await leerDesglose(await libroOml(), "oml.xlsx", { base: base as never });
    expect(e.artistas).toContain("KAPANGA");
    expect(e.items.filter(i => i.artista === "KAPANGA").length).toBe(4);
    expect(e.avisos.some(a => /no encontré hojas/.test(a))).toBe(false);
  });
});
