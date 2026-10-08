import { describe, expect, it } from "vitest";
import { interpretar, lineasDeTexto } from "../src/lectura";
import { categorizar } from "../src/dominio/categorias";

/* In ears y consolas: secciones propias (las pidió el usuario, 2026-10-08). Inventado, sin contactos. */
const leer = (texto: string, tipo: "pdf" | "texto" = "texto") =>
  interpretar([{ nombre: "lista.txt", tipo, lineas: lineasDeTexto(texto), avisos: [] }], { artista: "Los Rayos" });
const resumen = (e: ReturnType<typeof leer>) => e.items.map(i => `${i.cantidad} ${i.descripcion} [${i.grupo ?? ""}·${i.categoria}]`);

describe("in ears y consolas", () => {
  it("la categoría sale por la marca o el modelo", () => {
    expect(categorizar("Shure PSM 1000 con antena helicoidal")).toBe("In ears");
    expect(categorizar("Sennheiser EW IEM G4")).toBe("In ears");
    expect(categorizar("DM7 con 48 canales")).toBe("Consolas");
    expect(categorizar("DiGiCo SD12")).toBe("Consolas");
    expect(categorizar("Mesa de percusión")).toBe("Percusión");
  });

  it("una lista corta, como la escrita a mano, saca los in ears y las consolas por su categoría", () => {
    const e = leer(`Batería DW
1 Yamaha Montage 8
1 Base de teclado
16 Shure PSM 1000 con antena helicoidal
2 DM7 con 48 canales`);
    expect(resumen(e).slice(-2)).toEqual([
      "16 Shure PSM 1000 con antena helicoidal [·In ears]",
      "2 DM7 con 48 canales [·Consolas]",
    ]);
  });

  it("sin títulos, los in ears y las consolas no hacen que se pierda el resto de la lista", () => {
    const e = leer(`Batería DW
1 Bajo Fender
16 Shure PSM 1000
2 DM7`, "pdf");
    expect(resumen(e)).toEqual(["1 Bajo Fender [·Bajo]", "16 Shure PSM 1000 [·In ears]", "2 DM7 [·Consolas]"]);
  });

  it("los títulos IN EARS y CONSOLAS abren su sección", () => {
    const e = leer(`BACKLINE
1 Bajo Fender Jazz Bass
IN EARS
8 Shure PSM 1000
1 combinador de antenas
CONSOLAS
1 DiGiCo SD12 para monitores
1 Yamaha CL5 para FOH
HOTEL
5 habitaciones dobles`, "pdf");
    expect(resumen(e)).toEqual([
      "1 Bajo Fender Jazz Bass [·Bajo]",
      "8 Shure PSM 1000 [In ears·In ears]",
      "1 combinador de antenas [In ears·In ears]",
      "1 DiGiCo SD12 para monitores [Consolas·Consolas]",
      "1 Yamaha CL5 para FOH [Consolas·Consolas]",
    ]);
  });

  it("en la sección de audio, la consola se lee pero la mezcla de in ear de un músico no", () => {
    const e = leer(`BACKLINE
1 Bajo Fender Jazz Bass
AUDIO
CONSOLA FOH: Yamaha CL5
2 Shure PSM 1000
OUTPUT LIST
3 LIDER IEM
13 DRUMS L IEM (PSM1000)`, "pdf");
    expect(resumen(e).filter(r => /In ears|Consolas/.test(r))).toEqual([
      "1 CONSOLA FOH: Yamaha CL5 [Consolas·Consolas]",
      "2 Shure PSM 1000 [In ears·In ears]",
    ]);
  });

  it("la consola escrita antes del backline se queda; las medidas de la tarima no", () => {
    const e = leer(`Consola: 1 Yamaha DM7
2 tarimas de 2x2
BACKLINE
1 Bajo Fender Jazz Bass`, "pdf");
    expect(resumen(e)).toEqual(["1 Consola: Yamaha DM7 [·Consolas]", "1 Bajo Fender Jazz Bass [·Bajo]"]);
  });

  it("\"Batería DW\" sin cantidad es el título del bloque de la batería, no se pierde", () => {
    const e = leer(`Batería DW
1 Bombo
1 Snare
TECLADO
1 Yamaha Montage 8`, "pdf");
    expect(resumen(e)).toEqual(["1 Bombo [Batería DW·Batería]", "1 Snare [Batería DW·Batería]", "1 Yamaha Montage 8 [Teclado·Teclado]"]);
  });

  it("una coma dentro del paréntesis no parte la pieza", () => {
    const e = leer(`IN EARS
16 Shure PSM 1000 (el dual va dentro del mismo rack, 4 de Audio Room)`, "pdf");
    expect(resumen(e)).toEqual(["16 Shure PSM 1000 (el dual va dentro del mismo rack, 4 de Audio Room) [In ears·In ears]"]);
  });
});
