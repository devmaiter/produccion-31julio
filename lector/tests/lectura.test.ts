import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { agruparLineas, buscarFecha, integrar, interpretar, leerArchivo, lineasDeTexto, nombrePropio, normalizarHora, type Documento } from "../src/lectura";
import { lectoresNode } from "../src/lectura/node/lectores";
import { EVENTOS } from "../src/datos/eventos";

const lectores = lectoresNode();
afterAll(() => lectores.cerrar());
const fixture = (f: string) => new Uint8Array(readFileSync(`tests/fixtures/${f}`));
const texto = (t: string, extra: Partial<Documento> = {}): Documento => ({ nombre: "correo", tipo: "texto", lineas: lineasDeTexto(t), avisos: [], ...extra });

describe("fechas y horas", () => {
  it.each([
    ["Sábado 14 de noviembre de 2026", "2026-11-14"],
    ["sáb 12 sep", "2026-09-12"],
    ["DOMINGO 13 DE SEPTIEMBRE", "2026-09-13"],
    ["12/09/2026", "2026-09-12"],
    ["2026-09-11", "2026-09-11"],
    ["Nov 14, 2026", "2026-11-14"],
  ])("%s → %s", (t, f) => expect(buscarFecha(t, 2026)?.fecha).toBe(f));
  it("no confunde horas ni medidas con fechas", () => {
    expect(buscarFecha("16:00 - 16:45 Los Rayos", 2026)).toBeNull();
    expect(buscarFecha("Ampeg 8x10 cabinet", 2026)).toBeNull();
  });
  it("normaliza horas", () => {
    expect(normalizarHora("9:00")).toBe("09:00");
    expect(normalizarHora("21h30")).toBe("21:30");
    expect(normalizarHora("25:00")).toBeNull();
  });
  it("nombre propio", () => {
    expect(nombrePropio("LA TROVA NUEVA")).toBe("La Trova Nueva");
    expect(nombrePropio("Kany García")).toBe("Kany García");
  });
});

describe("intérprete de texto", () => {
  it("correo con horario y rider en frases", () => {
    const e = interpretar([texto(`Hola Julián, buenas tardes.
Te comparto la programación del Festival Sol de Noche 2026.

Viernes 13 de noviembre - Pruebas
9:00 - 10:30 Soundcheck Los Rayos

Sábado 14 de noviembre
Puertas 13:00
17:30 - 18:30 LOS RAYOS

LOS RAYOS
Bass:
1 Ampeg SVT Classic
Guitarra: 2 Fender Twin Reverb
Base de redoblante x2
3 guitar stand

Quedo atento, gracias.`)], { anio: 2026 });
    expect(e.evento?.nombre).toBe("Festival Sol de Noche 2026");
    expect(e.dias).toEqual([
      { fecha: "2026-11-13", nombre: "Viernes 13 de noviembre - Pruebas", tipo: "pruebas" },
      { fecha: "2026-11-14", nombre: "Sábado 14 de noviembre", tipo: "show" },
    ]);
    expect(e.bloques.map(b => [b.fecha, b.inicio, b.fin, b.artista, b.tipo])).toEqual([
      ["2026-11-13", "09:00", "10:30", "Los Rayos", "soundcheck"],
      ["2026-11-14", "13:00", null, null, "marca"],
      ["2026-11-14", "17:30", "18:30", "Los Rayos", "show"],
    ]);
    expect(e.items.map(i => [i.artista, i.cantidad, i.descripcion, i.categoria])).toEqual([
      ["Los Rayos", 1, "Ampeg SVT Classic", "Ampli bajo"],
      ["Los Rayos", 2, "Guitarra: Fender Twin Reverb", "Ampli guitarra"],
      ["Los Rayos", 2, "Base de redoblante", "Batería"],
      ["Los Rayos", 3, "guitar stand", "Bases"],
    ]);
    expect(e.items.every(i => i.fecha === "2026-11-14" && !i.dudoso)).toBe(true);
  });

  it("sin artista no inventa: avisa", () => {
    const e = interpretar([texto("2 Snare stand")]);
    expect(e.items).toHaveLength(0);
    expect(e.avisos[0]).toMatch(/no se sabe de qué artista/);
  });

  it("con artista y día indicados, todo va a ese artista y día", () => {
    const e = interpretar([texto("DRUMS\nSnare stand  2  CN\nNord Stage 3")], { artista: "Los Rayos", fecha: "2026-11-14" });
    expect(e.items.map(i => [i.artista, i.fecha, i.grupo, i.cantidad, i.descripcion, i.proveedor])).toEqual([
      ["Los Rayos", "2026-11-14", "Drums", 2, "Snare stand", "CN"],
      ["Los Rayos", "2026-11-14", "Drums", 1, "Nord Stage 3", null], // el grupo sigue hasta el siguiente encabezado
    ]);
  });

  it("reconoce artistas y días del evento destino por su nombre", () => {
    const cordillera = EVENTOS.find(e => e.evento.id === "cordillera-2026")!;
    const e = interpretar([texto("SEAN PAUL\nSábado 12\nPioneer CDJ-3000   2   OML")], { base: cordillera });
    expect(e.items[0]).toMatchObject({ artista: "Sean Paul", fecha: "2026-09-12", cantidad: 2, proveedor: "OML", categoria: "DJ" });
  });

  it("líneas de OCR con baja confianza se marcan para confirmar", () => {
    const e = interpretar([{ nombre: "foto.jpg", tipo: "imagen", avisos: [], lineas: [{ texto: "Snare stand   2   CN", confianza: 55 }] }], { artista: "X", fecha: "2026-01-01" });
    expect(e.items[0]).toMatchObject({ dudoso: true, nota: "lectura dudosa (55%)" });
  });
});

describe("PDF", () => {
  it("agrupa fragmentos en líneas y conserva las columnas", () => {
    const f = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 10, x, y], width: str.length * 5, height: 10 });
    expect(agruparLineas([f("Snare stand", 30, 500), f("2", 200, 500.5), f("CN", 260, 499.8), f("DRUMS", 30, 520)]).map(l => l.texto))
      .toEqual(["DRUMS", "Snare stand   2   CN"]);
  });
  it("hoja de backline en PDF → horario y backline completos", async () => {
    const e = interpretar(await leerArchivo("hoja-backline.pdf", fixture("hoja-backline.pdf"), "application/pdf", lectores));
    expect(e.evento?.nombre).toBe("Festival Sol de Noche 2026");
    expect(e.escenarios).toEqual(["Escenario Luna"]);
    expect(e.bloques).toHaveLength(2);
    expect(e.items.map(i => `${i.artista}|${i.grupo}|${i.cantidad}|${i.descripcion}|${i.proveedor ?? ""}`)).toEqual([
      "La Trova Nueva|Drums|2|Snare stand|CN", "La Trova Nueva|Drums|3|Boom cymbal stand|CN", "La Trova Nueva|Drums|1|Drum throne|OML",
      "La Trova Nueva|Keys|1|Nord Stage 3|BACKLINE COP", "La Trova Nueva|Keys|1|Keyboard stand doble|CN",
      "Los Rayos|Bass|1|Ampeg SVT Classic|CN", "Los Rayos|Bass|1|Ampeg 8x10 cabinet|CN",
      "Los Rayos|Guitar|2|Fender Twin Reverb|OML", "Los Rayos|Guitar|4|Guitar stand|CN",
    ]);
    const { paquete } = integrar(e, null, "hoja-backline.pdf");
    expect(paquete.evento.id).toBe("festival-sol-de-noche-2026");
    expect(paquete.items).toHaveLength(9);
  });
});

describe("fotos (OCR local)", () => {
  it("foto nítida de la hoja → igual que el PDF", async () => {
    const e = interpretar(await leerArchivo("hoja.png", fixture("hoja-backline.png"), "image/png", lectores));
    expect(e.artistas).toEqual(["La Trova Nueva", "Los Rayos"]);
    expect(e.items.map(i => [i.cantidad, i.descripcion, i.proveedor])).toEqual([
      [2, "Snare stand", "CN"], [3, "Boom cymbal stand", "CN"], [1, "Drum throne", "OML"], [1, "Nord Stage 3", "BACKLINE COP"],
      [1, "Keyboard stand doble", "CN"], [1, "Ampeg SVT Classic", "CN"], [1, "Ampeg 8x10 cabinet", "CN"], [2, "Fender Twin Reverb", "OML"], [4, "Guitar stand", "CN"],
    ]);
  }, 60_000);
  it("foto torcida y con ruido: encuentra el equipo y marca lo que no pudo leer", async () => {
    const e = interpretar(await leerArchivo("foto-hoja.jpg", fixture("foto-hoja.jpg"), "image/jpeg", lectores));
    expect(e.artistas).toEqual(["La Trova Nueva", "Los Rayos"]);
    expect(e.items.map(i => i.descripcion)).toEqual([
      "Snare stand", "Boom cymbal stand", "Drum throne", "Nord Stage 3", "Keyboard stand doble",
      "Ampeg SVT Classic", "Ampeg 8x10 cabinet", "Fender Twin Reverb", "Guitar stand",
    ]);
    // Lo que no se leyó con seguridad no pasa como cierto.
    for (const i of e.items) if (i.cantidad === 1 && i.nota) expect(i.dudoso).toBe(true);
  }, 60_000);
});

describe("correo .eml", () => {
  it("lee el cuerpo y el PDF adjunto", async () => {
    const pdf = Buffer.from(fixture("hoja-backline.pdf")).toString("base64").replace(/.{76}/g, "$&\r\n");
    const eml = [
      "From: Produccion <prod@festival.co>", "Subject: Festival Sol de Noche 2026 - backline", "Date: Tue, 29 Sep 2026 10:00:00 -0500",
      "MIME-Version: 1.0", 'Content-Type: multipart/mixed; boundary="XX"', "",
      "--XX", "Content-Type: text/plain; charset=utf-8", "", "Hola, adjunto la hoja. Los Rayos traen su propio pedal de bajo.", "",
      "--XX", 'Content-Type: application/pdf; name="hoja.pdf"', "Content-Transfer-Encoding: base64", 'Content-Disposition: attachment; filename="hoja.pdf"', "",
      pdf, "", "--XX--", "",
    ].join("\r\n");
    const docs = await leerArchivo("correo.eml", new TextEncoder().encode(eml), "", lectores);
    expect(docs.map(d => [d.tipo, d.fechaReferencia])).toEqual([["correo", "2026-09-29"], ["pdf", "2026-09-29"]]);
    const e = interpretar(docs);
    expect(e.evento?.nombre).toBe("Festival Sol de Noche 2026");
    expect(e.items).toHaveLength(9);
  });
  it("formatos desconocidos se avisan", async () => {
    const [d] = await leerArchivo("plano.dwg", new Uint8Array([1, 2]), "", lectores);
    expect(d!.avisos[0]).toMatch(/formato no soportado/);
  });
});
