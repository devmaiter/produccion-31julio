import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { agruparLineas, interpretar, leerArchivo, lineasDeTexto, type Documento } from "../src/lectura";
import { lectoresNode } from "../src/lectura/node/lectores";

/* Riders completos: además del backline traen input list, monitores, luces,
 * camerinos, catering, hotel y transporte, y suelen venir a dos o tres columnas.
 * De todo eso solo debe salir el backline. Los PDF de tests/fixtures/riders se
 * generan desde fuentes/*.html (imprimir a PDF en Chromium). */

const lectores = lectoresNode();
afterAll(() => lectores.cerrar());

async function leerRider(archivo: string) {
  const datos = new Uint8Array(readFileSync(`tests/fixtures/riders/${archivo}`));
  return interpretar(await leerArchivo(archivo, datos, "application/pdf", lectores));
}
const resumen = (e: ReturnType<typeof interpretar>) => e.items.map(i => `${i.cantidad} ${i.categoria}: ${i.descripcion}`);

describe("riders completos en PDF", () => {
  it("en inglés a dos columnas: backline sí; hospitality, input list y luces no", async () => {
    const e = await leerRider("rider-ingles-dos-columnas.pdf");
    expect(e.artistas).toEqual(["The Night Owls"]);
    expect(resumen(e)).toEqual([
      '1 Batería: Kick drum 22" with Remo Powerstroke 3 head',
      '2 Batería: Rack toms 10" and 12"',
      '1 Batería: Floor tom 16"',
      '2 Batería: Snare drums 14" x 6.5"',
      "4 Bases: Cymbal boom stands",
      "2 Bases: Snare stands",
      "1 Bases: Hi-hat stand",
      "1 Batería: Double kick pedal DW 9000",
      "1 Bases: Drum throne",
      "1 Ampli bajo: Ampeg SVT-4 Pro head",
      "1 Ampli bajo: Ampeg 8x10 cabinet",
      "2 Ampli guitarra: Fender Twin Reverb amps",
      "3 Bases: Guitar stands",
      "1 Teclado: Nord Stage 3 88 keys",
      "1 Bases: Double tier keyboard stand",
    ]);
  });

  it("tabla Cant | Equipo | Observación: la observación queda con su equipo", async () => {
    const e = await leerRider("rider-tabla-con-observaciones.pdf");
    expect(e.artistas).toEqual(["Los Rayos"]);
    expect(resumen(e)).toEqual([
      '1 Batería: Bombo 22" (Parche frontal sin logo)',
      '1 Batería: Redoblante 14" Ludwig Supraphonic (Con parche Remo Coated nuevo)',
      '2 Batería: Toms 10" y 12" (Montados en el bombo)',
      "3 Bases: Bases de platillo tipo boom (Con sus tuercas y fieltros)",
      "1 Ampli bajo: Amplificador de bajo Ampeg SVT (Con caja 4x10)",
      "2 Ampli guitarra: Amplificador de guitarra Fender Hot Rod Deluxe (A 110 V)",
      "1 Teclado: Teclado Nord Electro 6 (Con pedal de sustain)",
      "4 Percusión: Congas LP Classic (Con sus bases)",
    ]);
  });

  it("tres columnas con listas corridas: cada cantidad es un ítem; radios y monitores no", async () => {
    const e = await leerRider("rider-tres-columnas.pdf");
    expect(e.artistas).toEqual(["Cumbia del Valle"]);
    expect(resumen(e)).toEqual([
      '1 Batería: Bombo 22"',
      '1 Batería: Redoblante 14"',
      '2 Batería: Toms 10" y 12"',
      '1 Batería: Tom de piso 16"',
      "1 Bases: Silla de batería",
      "1 Escenario: Tapete",
      "3 Percusión: Congas LP con sus bases",
      "2 Percusión: Timbales con base",
      "1 Percusión: Mesa de percusión",
      "1 Ampli bajo: Ampeg SVT con caja 8x10",
    ]);
  });
});

describe("secciones del rider", () => {
  const doc = (t: string): Documento => ({ nombre: "rider", tipo: "pdf", lineas: lineasDeTexto(t), avisos: [] });

  it("solo lee ítems en el backline; transporte, input list, radios y luces quedan fuera", () => {
    const e = interpretar([doc(`RIDER TÉCNICO
DREAD MAR I 2026
TRANSPORTE
1 SUBURBAN con Asientos de Capitan
1 VAN para 15 personas (MÚSICOS)
INPUT LIST - LISTADO DE CANALES
27   SNARE 2   SM 57   SHORT BOOM
26   DRUM PAD   D BOX
OUTPUT MIX
13 DRUMS L IEM (PSM1000)
BACKLINE
DRUMS
BD 22
TOMS 10” + holder float, 12” + holder float (Remo
Pinstripe)
3 SN 14” (Ambassador Coated)
HARDWARE SET
4 Boom Stand 3
Snare Stand 1 Hi
Hat Stand 1 Kick
Pedal 1 Drum
Throne 1 Carpet
BASS
1 8X10
1 BASS GUITAR Fender Jazz Bass 5
KEYS
1 Keyboard Controller 61 Keys
Cada equipo deberá encontrase en perfectas
condiciones de
funcionamiento y con sus respectivos cables de
conexión.
MOTOROLA + EXTRAS
6 Modelo EP450 / Accesorio RMN5029
PLANTA DE ILUMINACION - LISTA DE MATERIALES
30 CLAY PAKY, MYTHOS 2`)]);
    expect(e.artistas).toEqual(["Dread Mar I"]);
    expect(resumen(e)).toEqual([
      "1 Batería: BD 22",
      "2 Batería: TOMS 10” + holder float, 12” + holder float (Remo Pinstripe)",
      "3 Batería: SN 14” (Ambassador Coated)",
      "4 Bases: Boom Stand",
      "3 Bases: Snare Stand",
      "1 Bases: Hi Hat Stand",
      "1 Batería: Kick Pedal",
      "1 Bases: Drum Throne",
      "1 Escenario: Carpet",
      "1 Ampli bajo: 8X10",
      "1 Bajo: BASS GUITAR Fender Jazz Bass 5",
      "1 Teclado: Keyboard Controller 61 Keys",
    ]);
  });

  it("tabla PIEZA | MEDIDA | MARCA, páginas repetidas, snakes y opciones de teclado", () => {
    const e = interpretar([doc(`Technical Rider
LOS TIGRES DEL NORTE 2026
P.A.
12 MAIN PER SIDE   PANTHER MEYER
8 SUBS PER SIDE   2100 LF MEYER
SUBSNAKES
1 SNAKE FOR DRUMS 16 CHANNELS W/4 RETURNS
BACKLINE
2 SETS DE BATERIAS IGUALES
PIEZA   MEDIDA   MARCA   MODELO   MIC
2-KICK   22" x 20"   DW   SERIE COLECTOR
2-SNARE   14" X 6"   DW   SERIE COLECTOR
2-TOM 1   10"   DW   SERIE COLECTOR
Technical Rider
BACKLINE
DRUMSET2 SETS DE BATERIAS IGUALES
2-KICK   22" x 20"   DW   SERIE COLECTOR
2-SNARE   14" X 6"   DW   SERIE COLECTOR
2-TOM 1   10"   DW   SERIE COLECTOR
2-TOM 2   12"   DW   SERIE COLECTOR
2-ASIENTO CON RESPALDO   DW   9120AL
2-PAR DE H/H   14"   ZILDJIAN   A CUSTOM
STAND DE MIC
4 STAND CON BOOM
SUB SNAKE BATERIA
1 SNAKE DE 16 CH, 4 RETORNOS
IMAGEN DE EJEMPLO
BACKLINE
PERCUSIONPERCUSSIONS
CONGA HI   QUINTO   LP559X   CLASIC
MESA DE TOYS   CORTINA, SHEKER, PANDERO CLAMP, TOYS VARIOS,CHACHA BELL, WOODBLOCK
TECALDO
OPCION #1   YAMAHA MO6 STAND   SUSTEIN
OPCION #2   KORG KRONOS 61 STAND   SUSTEIN
PRONTERS
3 pronters de TV. Minimo 40" conexcion hdmi al area de trabajo de monitores
ALIMENTOS ARTISTA:
16 ELECTROLIT SABOR DE COCO
50 BOTELLAS DE AGUA PURIFICADA`)]);
    expect(e.artistas).toEqual(["Los Tigres del Norte"]);
    expect(resumen(e)).toEqual([
      '2 Batería: KICK (22" x 20", DW, SERIE COLECTOR)',
      '2 Batería: SNARE (14" X 6", DW, SERIE COLECTOR)',
      '2 Batería: TOM 1 (10", DW, SERIE COLECTOR)',
      '2 Batería: TOM 2 (12", DW, SERIE COLECTOR)',
      "2 Bases: ASIENTO CON RESPALDO (DW, 9120AL)",
      '2 Platillos: PAR DE H/H (14", ZILDJIAN, A CUSTOM)',
      "1 Percusión: CONGA HI (QUINTO, LP559X, CLASIC)",
      "1 Percusión: MESA DE TOYS (CORTINA, SHEKER, PANDERO CLAMP, TOYS VARIOS,CHACHA BELL, WOODBLOCK)",
      "1 Teclado: YAMAHA MO6 STAND (SUSTEIN)",
      "1 Teclado: KORG KRONOS 61 STAND (SUSTEIN)",
    ]);
    expect(e.items.at(-1)!.nota).toContain("no suma"); // la opción 2 es alternativa
    expect(e.items.at(-2)!.nota).toBeNull();
  });

  it("sin títulos de sección se lee como antes", () => {
    const e = interpretar([doc("LOS RAYOS\n2 Snare stand\n1 Ampeg SVT")]);
    expect(resumen(e)).toEqual(["2 Bases: Snare stand", "1 Ampli bajo: Ampeg SVT"]);
  });
});

describe("columnas del PDF", () => {
  const frag = (str: string, x: number, y: number) => ({ str, transform: [10, 0, 0, 10, x, y], width: str.length * 5, height: 10 });

  it("dos columnas de texto se leen una después de la otra", () => {
    const filas = [
      ["DRUMS y hardware de la banda", "HOSPITALITY para todo el equipo"],
      ["1 Kick drum 22 pulgadas", "24 bottles of still water"],
      ["2 Snare drums de 14 pulgadas", "12 clean black towels"],
      ["1 Drum throne con respaldo", "Fresh fruit and sandwiches"],
    ];
    const lineas = agruparLineas(filas.flatMap((f, k) => [frag(f[0]!, 40, 700 - k * 14), frag(f[1]!, 320, 700 - k * 14)])).map(l => l.texto);
    expect(lineas).toEqual([...filas.map(f => f[0]), ...filas.map(f => f[1])]);
  });

  it("una tabla con la cantidad primero no se parte en columnas", () => {
    const filas = [["1", "Bombo 22 pulgadas", "Parche frontal sin logo"], ["2", "Toms de 10 y 12", "Montados en el bombo"], ["3", "Bases de platillo boom", "Con sus tuercas"]];
    const lineas = agruparLineas(filas.flatMap((f, k) => [frag(f[0]!, 40, 700 - k * 14), frag(f[1]!, 80, 700 - k * 14), frag(f[2]!, 320, 700 - k * 14)])).map(l => l.texto);
    expect(lineas).toEqual(filas.map(f => f.join("   ")));
  });
});
