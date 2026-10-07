import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { cantidadPlanilla, fechaPlanilla, filasDelRider, interpretar, leerTablas, leerLibro, lineasDeTexto, planillaXlsx, type RenglonLeido } from "../src/lectura";

const RIDER = `RIDER TÉCNICO 2026
INFORMACIÓN DE CONTACTO
BACKLINE
Baterías
Sugerimos: Tama Star Classic, Yamaha recording custom o similares.
1 bombo 22x18”.
4 stands Platillos con Boom.
Amplificadores de bajo
Ampeg SVT Classic/SVT PRO 3/ SVT PRO 4 + Ampeg SVT810E, Fender Rumble
500 o Aguilar AG700.
Teclado / Piano
La banda lleva su teclado con computador e interfaz pero necesitamos la base de
teclado
OTHER
1 ORANGE GAFFER TAPE ROLL
TRANSFORMADORES Y CONVERTIDORES SUFICIENTES
El transporte de los equipos deberá estar a la disposición exclusiva del artista.
OUTPUT LIST
GUITARRA
3   LIDER IEM /`;

describe("planilla de backline (formato OML)", () => {
  const traza: RenglonLeido[] = [];
  const ext = interpretar([{ nombre: "rider.pdf", tipo: "pdf", lineas: lineasDeTexto(RIDER), avisos: [] }], { traza });
  const filas = filasDelRider(ext, traza);

  it("el requerimiento sale como en la planilla: sección, nota sin cantidad y '01 x' + equipo", () => {
    expect(filas.map(f => `${cantidadPlanilla(f.cantidad)}|${f.texto}`)).toEqual([
      "|BATERÍAS",
      "|Tama Star Classic, Yamaha recording custom o similares.",
      "01 x|Bombo 22x18”",
      "04 x|Stands Platillos con Boom",
      "|AMPLIFICADORES DE BAJO",
      "01 x|Ampeg SVT Classic/SVT PRO 3/ SVT PRO 4 + Ampeg SVT810E, Fender Rumble 500 o Aguilar AG700",
      "|TECLADO / PIANO",
      // "La banda lleva su teclado … pero necesitamos la base": las dos piezas (lo definió el usuario).
      "01 x|Teclado con computador e interfaz (lo trae la banda)",
      "01 x|Base de teclado",
    ]); // "GUITARRA" del output list no queda (nada debajo), ni OTHER (solo cinta) ni el párrafo del contrato.
  });

  it("el .xlsx trae el encabezado, SET A, Cat / Rider, Cant | Requerimiento | Cant | Propuesta y la propuesta vacía", async () => {
    const bytes = await planillaXlsx({ escenario: "Stage 4", fecha: "2026-09-12", banda: "Los Rayos", set: "SET A", cat: "★★☆☆☆", rider: "https://drive.google.com/x", filas });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as never);
    const ws = wb.worksheets[0]!;
    const v = (ref: string) => { const x = ws.getCell(ref).value; return typeof x === "object" && x && "text" in x ? x.text : x; };
    expect(ws.name).toBe("Los Rayos");
    expect(ws.model.merges).toEqual(["A1:B1", "C1:D1", "A3:D3"]);
    expect([v("A1"), v("C1"), v("B2"), v("A3")]).toEqual(["Stage 4", "12/09/2026", "Los Rayos | Backline Stage 4 | 12/09", "SET A"]);
    expect([v("A4"), v("B4"), v("C4"), v("D4")]).toEqual(["Cat:", "★★☆☆☆", "Rider:", "https://drive.google.com/x"]);
    expect([1, 2, 3, 4].map(c => ws.getRow(5).getCell(c).value)).toEqual(["Cant", "Requerimiento", "Cant", "Propuesta"]);
    expect([v("A8"), v("B8"), v("C8"), v("D8")]).toEqual(["01 x", "Bombo 22x18”", null, null]);
    expect(ws.getCell("A1").fill).toMatchObject({ fgColor: { argb: "FF434343" } });
  });

  it("sin traza (un Excel) se arma con los grupos de los ítems", async () => {
    const wb = new ExcelJS.Workbook();
    const h = wb.addWorksheet("Hoja");
    h.addRow(["", "Los Rayos | Backline | 12/09"]);
    h.addRow(["Cant", "Equipo"]);
    h.addRow(["", "DRUMS"]);
    h.addRow([1, "kick 22"]);
    const e = leerTablas(await leerLibro(new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer)));
    expect(filasDelRider(e).map(f => `${cantidadPlanilla(f.cantidad)}|${f.texto}`)).toEqual(["|DRUMS", "01 x|Kick 22"]);
  });

  it("las opciones en orden de prioridad van en una sola fila, como en la planilla", () => {
    const t: RenglonLeido[] = [];
    const texto = "RIDER TÉCNICO\nLOS RAYOS\nBACKLINE\nBASS/BAJO - ANA PÉREZ\nOPTIONS/OPCIONES AMPS EN ORDEN DE PRIORIDAD\n1 AMPEG SVT 450/SVT Classic/\n2 AGUILAR DB751\n3 MARKBASS LITTLE MARK\nINSTRUMENTOS\n1 Bajo Fender Precision";
    const e = interpretar([{ nombre: "r.pdf", tipo: "pdf", lineas: lineasDeTexto(texto), avisos: [] }], { traza: t });
    expect(filasDelRider(e, t).filter(f => f.tipo === "item").map(f => `${cantidadPlanilla(f.cantidad)}|${f.texto}`))
      .toEqual(["01 x|AMPEG SVT 450/SVT Classic / AGUILAR DB751 / MARKBASS LITTLE MARK", "01 x|Bajo Fender Precision"]);
  });

  it("lo que la banda trae va marcado en la planilla", () => {
    const t: RenglonLeido[] = [];
    const e = interpretar([{ nombre: "r.pdf", tipo: "pdf", lineas: lineasDeTexto("RIDER TÉCNICO\nNELDA\nBACKLINE\nPERCUSIÓN\nLa agrupación lleva:\n1 Tambora tradicional\nEl festival suministra:\n1 Soporte para tambora"), avisos: [] }], { traza: t });
    expect(filasDelRider(e, t).filter(f => f.tipo === "item").map(f => f.texto)).toEqual(["Tambora tradicional (lo trae la banda)", "Soporte para tambora"]);
  });

  it("fechas", () => {
    expect(fechaPlanilla("2026-09-12")).toEqual({ larga: "12/09/2026", corta: "12/09" });
    expect(fechaPlanilla("Sábado")).toEqual({ larga: "Sábado", corta: "Sábado" });
  });
});
