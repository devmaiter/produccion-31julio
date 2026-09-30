import { describe, expect, it } from "vitest";
import { Extraccion, extraer, fuenteDesdeBytes, integrar, ErrorExtraccion, contextoDe } from "../src/extraccion";
import { EVENTOS } from "../src/datos/eventos";
import { totalesPorReferencia } from "../src/dominio";
import rider from "./fixtures/extraccion-rider.json";

const ext = Extraccion.parse(rider);

describe("integrar una extracción en un evento nuevo", () => {
  const { paquete: p, resumen: r } = integrar(ext, null, "rider-krapula.pdf");

  it("crea el evento con id estable y fechas de los días", () => {
    expect(p.evento).toMatchObject({ id: "rock-al-parque-2026", desde: "2026-11-06", hasta: "2026-11-07" });
    expect(r.evento.nuevo).toBe(true);
  });
  it("reconoce el mismo escenario escrito de dos formas", () => {
    expect(p.escenarios.map(e => e.nombre)).toEqual(["Escenario Plaza"]);
  });
  it("normaliza horas y descarta lo ilegible con aviso", () => {
    const sc = p.bloques.find(b => b.tipo === "soundcheck")!;
    expect(sc.inicio).toBe("09:00");
    expect(p.bloques).toHaveLength(4);
    expect(r.avisos.some(a => a.includes("Horario ilegible"))).toBe(true);
  });
  it("un rider sin día va a los días de show del artista", () => {
    const krapula = p.items.filter(i => i.artistaId === "doctor-krapula");
    expect(new Set(krapula.map(i => i.diaId))).toEqual(new Set(["rock-al-parque-2026-2026-11-07"]));
  });
  it("aplica referencia, categoría, propietario, dudas y origen", () => {
    const fan = p.items.find(i => i.descripcion === "Stage fan")!;
    expect(fan).toMatchObject({ categoria: "Escenario", porConfirmar: true, origen: "rider-krapula.pdf", propietario: { tipo: "sin-definir" } });
    const nord = p.items.find(i => i.descripcion === "Nord Stage 3")!;
    expect(nord.propietario).toEqual({ tipo: "tercero", nombre: "BACKLINE COP" });
    const [snare] = totalesPorReferencia(p.items.filter(i => i.referencia === "Snare stand"));
    expect(snare).toMatchObject({ aTener: 3, deTerceros: 1 });
  });
  it("no carga backline sin día ni horario, y lo avisa", () => {
    expect(p.items.some(i => i.artistaId === "banda-fantasma")).toBe(false);
    expect(r.avisos.some(a => a.includes("Banda Fantasma"))).toBe(true);
  });
  it("conserva los avisos del modelo", () => {
    expect(r.avisos).toContain("El rider de Los Petit Fellas trae una página cortada.");
  });
  it("procesar el mismo archivo dos veces no duplica nada", () => {
    const otra = integrar(ext, p, "rider-krapula.pdf");
    expect(otra.paquete.items).toHaveLength(p.items.length);
    expect(otra.paquete.bloques).toHaveLength(p.bloques.length);
    expect(otra.resumen.items).toMatchObject({ nuevos: 0, actualizados: 0 });
    expect(otra.resumen.itemsTocados).toEqual([]);
    expect(r.itemsTocados).toHaveLength(4);
  });
  it("un cambio de cantidad actualiza, marca para confirmar y avisa", () => {
    const cambio = structuredClone(rider);
    cambio.items[3]!.cantidad = 2;
    const otra = integrar(Extraccion.parse(cambio), p, "correo-nuevo.eml");
    const nord = otra.paquete.items.find(i => i.descripcion === "Nord Stage 3")!;
    expect(nord).toMatchObject({ cantidad: 2, porConfirmar: true, origen: "correo-nuevo.eml" });
    expect(otra.resumen.items.actualizados).toBe(1);
    expect(p.items.find(i => i.descripcion === "Nord Stage 3")!.cantidad).toBe(1); // el original no se tocó
  });
});

describe("integrar en un evento existente", () => {
  const cordillera = EVENTOS.find(e => e.evento.id === "cordillera-2026")!;
  it("usa los días y artistas que ya existen", () => {
    const e = Extraccion.parse({
      evento: null, escenarios: ["Aval Aconcagua"], dias: [], artistas: ["Sean Paul"], bloques: [], avisos: [],
      items: [{ artista: "Sean Paul", fecha: null, grupo: "DJ set", descripcion: "Pioneer DJM-A9", cantidad: 1, categoria: "DJ", proveedor: "OML", dudoso: false, nota: null }],
    });
    const { paquete, resumen } = integrar(e, cordillera, "correo-sean-paul.eml");
    expect(resumen).toMatchObject({ escenarios: { nuevos: 0 }, artistas: { nuevos: 0 }, items: { nuevos: 1 } });
    const nuevo = paquete.items.find(i => i.descripcion === "Pioneer DJM-A9")!;
    expect(nuevo.diaId).toBe("cordillera-sab-12");
    expect(paquete.items).toHaveLength(cordillera.items.length + 1);
  });
  it("advierte si los archivos parecen de otro evento", () => {
    const e = Extraccion.parse({ ...rider, items: [], bloques: [] });
    expect(integrar(e, cordillera, "x").resumen.avisos.some(a => /Rock al Parque.*Cordillera/.test(a))).toBe(true);
  });
  it("el contexto lista lo que ya existe", () => {
    expect(contextoDe(cordillera)).toMatch(/Artistas: .*Sean Paul/);
  });
});

describe("fuentes", () => {
  it("PDF y foto se convierten en documento e imagen", async () => {
    const pdf = await fuenteDesdeBytes("rider.pdf", Buffer.from("%PDF-1.4"));
    expect(pdf.bloques.map(b => b.type)).toEqual(["text", "document"]);
    const foto = await fuenteDesdeBytes("hoja.JPG", Buffer.from([0xff, 0xd8]));
    expect(foto.bloques[1]).toMatchObject({ type: "image", source: { media_type: "image/jpeg" } });
  });
  it("un correo trae su cuerpo y sus adjuntos", async () => {
    const eml = [
      "From: Producción <prod@festival.co>", "Subject: Rider Doctor Krápula", "Date: Tue, 29 Sep 2026 10:00:00 -0500",
      "MIME-Version: 1.0", 'Content-Type: multipart/mixed; boundary="XX"', "",
      "--XX", "Content-Type: text/plain; charset=utf-8", "", "Adjunto rider. 2 snare stand, 1 Nord Stage 3.", "",
      "--XX", 'Content-Type: application/pdf; name="rider.pdf"', "Content-Transfer-Encoding: base64", 'Content-Disposition: attachment; filename="rider.pdf"', "",
      Buffer.from("%PDF-1.4 rider").toString("base64"), "",
      "--XX", 'Content-Type: image/png; name="plot.png"', "Content-Transfer-Encoding: base64", 'Content-Disposition: attachment; filename="plot.png"', "",
      Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"), "",
      "--XX", 'Content-Type: application/zip; name="x.zip"', "Content-Transfer-Encoding: base64", 'Content-Disposition: attachment; filename="x.zip"', "",
      "UEsDBA==", "", "--XX--", "",
    ].join("\r\n");
    const f = await fuenteDesdeBytes("correo.eml", Buffer.from(eml));
    expect(f.tipo).toBe("correo");
    const texto = f.bloques[0]!;
    expect(texto.type === "text" && texto.text).toMatch(/Asunto: Rider Doctor Krápula[\s\S]*2 snare stand/);
    expect(f.bloques.map(b => b.type)).toEqual(["text", "text", "document", "text", "image", "text"]);
    expect(JSON.stringify(f.bloques.at(-1))).toMatch(/x\.zip.*omitido/);
  });
  it("rechaza formatos desconocidos", async () => {
    await expect(fuenteDesdeBytes("plano.dwg", Buffer.from("x"))).rejects.toThrow(/No sé leer/);
  });
});

describe("extraer (con cliente falso)", () => {
  interface Peticion { model: string; fallbacks: string; messages: [{ content: Array<{ text?: string }> }] }
  const peticiones: Peticion[] = [];
  const cliente = (msg: object) => ({
    beta: { messages: { stream: (params: Peticion) => { peticiones.push(params); return { finalMessage: async () => msg }; } } },
  }) as never;

  it("envía los archivos y devuelve la extracción validada", async () => {
    const fuente = await fuenteDesdeBytes("rider.txt", Buffer.from("2 snare stand"));
    const r = await extraer([fuente], { cliente: cliente({ stop_reason: "end_turn", parsed_output: rider }), contexto: "Evento: X" });
    expect(r.items).toHaveLength(5);
    const params = peticiones.at(-1)!;
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.messages[0].content.at(-1)!.text).toMatch(/Evento: X/);
  });
  it("explica los cortes y rechazos", async () => {
    const f = await fuenteDesdeBytes("a.txt", Buffer.from("x"));
    await expect(extraer([f], { cliente: cliente({ stop_reason: "max_tokens", parsed_output: null }) })).rejects.toThrow(ErrorExtraccion);
    await expect(extraer([f], { cliente: cliente({ stop_reason: "refusal", stop_details: { category: "cyber" } }) })).rejects.toThrow(/cyber/);
    await expect(extraer([])).rejects.toThrow(/No hay archivos/);
  });
});
