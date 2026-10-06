import { describe, expect, it } from "vitest";
import { agruparLineas, interpretar, lineasDeTexto, nombreDelArchivo, SIN_NOMBRE } from "../src/lectura";

/* Riders inventados con la forma de los que llegan (sin nombres ni textos reales). */

/** Un trozo de texto del PDF en (x, y), como lo entrega pdf.js. */
const t = (x: number, y: number, str: string) => ({ str, transform: [9, 0, 0, 9, x, y], width: str.length * 4.5, height: 9 });

describe("tabla con fila de títulos en un PDF", () => {
  // FAMILY TYPE | MODEL | NOTES, con celdas de dos renglones (la mitad arriba y la mitad abajo de la fila).
  const frags = [
    t(250, 760, "FULANO DE TAL GEAR"),
    t(80, 740, "FAMILY TYPE"), t(170, 740, "MODEL"), t(320, 740, "NOTES"),
    t(80, 728, "DRUM"),
    t(170, 718, "Marca Uno / Marca Dos /"), t(320, 718, "SERIE UNO / SERIE DOS /"),
    t(105, 710, "1 Kick 22”"), t(170, 710, "Marca Tres"), t(320, 710, "SERIE TRES"),
    t(105, 696, "1 Cymbals"), t(170, 696, "Ride 20” Modelo A"), t(320, 696, "MARCA X"),
    t(105, 684, "1 Cymbals"), t(170, 684, "Crash 16” Modelo B"), t(320, 684, "MARCA X"),
    t(112, 671, "Stereo Volume"),
    t(105, 664, "1"), t(112, 664, "Pedal"), t(170, 664, "Marca Uno, Marca Dos"), t(320, 664, "IN/OUT"),
  ];
  const lineas = agruparLineas(frags).map(l => l.texto);

  it("se lee fila por fila, con la celda de dos renglones unida, no columna por columna", () => {
    expect(lineas).toEqual([
      "FULANO DE TAL GEAR",
      "DRUM",
      "1 Kick 22”   Marca Uno / Marca Dos / Marca Tres   SERIE UNO / SERIE DOS / SERIE TRES",
      "1 Cymbals   Ride 20” Modelo A   MARCA X",
      "1 Cymbals   Crash 16” Modelo B   MARCA X",
      "1 Stereo Volume Pedal   Marca Uno, Marca Dos   IN/OUT",
    ]);
  });

  it("el equipo del músico no es la banda; la banda es el título del documento", () => {
    const e = interpretar([{ nombre: "r.pdf", tipo: "pdf", avisos: [], lineas: lineasDeTexto(["LOS RAYOS FEATURING ANA PÉREZ - GIRA 2026 (COLOMBIA)", "Backline a proveer por el promotor", ...lineas].join("\n")) }]);
    expect(e.artistas).toEqual(["Los Rayos Featuring Ana Pérez"]);
    expect(e.items.map(i => `${i.cantidad} ${i.descripcion} [${i.grupo}]`)).toEqual([
      "1 Kick 22” (Marca Uno / Marca Dos / Marca Tres, SERIE UNO / SERIE DOS / SERIE TRES) [Drum]",
      "1 Cymbals (Ride 20” Modelo A, MARCA X) [Drum]",
      "1 Cymbals (Crash 16” Modelo B, MARCA X) [Drum]",
      "1 Stereo Volume Pedal (Marca Uno, Marca Dos, IN/OUT) [Drum]",
    ]);
  });
});

describe("la banda cuando el rider no la dice junto a RIDER TÉCNICO", () => {
  it("del nombre del archivo, si el texto también la nombra", () => {
    const lineas = lineasDeTexto("BACKLINE 2025\nBajo:\n01 Caja 8x10\nCualquier consulta con la producción de Los Rayos.");
    expect(nombreDelArchivo("LOS RAYOS - BACKLINE 2026.pdf", lineas)).toBe("Los Rayos");
    const e = interpretar([{ nombre: "LOS RAYOS - BACKLINE 2026.pdf", tipo: "pdf", avisos: [], lineas }]);
    expect(e.items.map(i => `${i.artista}: ${i.cantidad} ${i.descripcion}`)).toEqual(["Los Rayos: 1 Caja 8x10"]);
  });
  it("si el texto no la nombra, queda sin nombre pero el listado no se pierde", () => {
    const e = interpretar([{ nombre: "documento final v2.pdf", tipo: "pdf", avisos: [], lineas: lineasDeTexto("BACKLINE 2025\nBajo:\n01 Caja 8x10") }]);
    expect(e.items.map(i => `${i.artista}: ${i.descripcion}`)).toEqual([`${SIN_NOMBRE}: Caja 8x10`]);
  });
});

describe("cantidades y medidas", () => {
  const leer = (t: string) => interpretar([{ nombre: "r.pdf", tipo: "pdf", avisos: [], lineas: lineasDeTexto(`RIDER TÉCNICO\nLOS RAYOS\nBACKLINE\n${t}`) }])
    .items.map(i => `${i.cantidad} ${i.descripcion}`);

  it("'01 Pedal … 01 Set de hardware' son dos ítems", () => {
    expect(leer("DRUMS\n01 Pedal de bombo Marca 900 01 Set de Hardware completo")).toEqual(["1 Pedal de bombo Marca 900", "1 Set de Hardware completo"]);
  });
  it("el número después del platillo es su medida, también al final del renglón", () => {
    expect(leer("DRUMS\n01 Crash 14 Marca\n01 Plato efecto Marca k 16\nHardware completo con 2 soportes")).toEqual([
      "1 Crash 14 Marca", "1 Plato efecto Marca k 16", "1 Hardware completo con 2 soportes",
    ]);
  });
});
