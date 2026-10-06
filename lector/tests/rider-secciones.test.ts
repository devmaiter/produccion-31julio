import { describe, expect, it } from "vitest";
import { interpretar, lineasDeTexto, SIN_NOMBRE, type RenglonLeido } from "../src/lectura";

/* Un rider como los que llegan en PDF: el nombre de la banda va en el logo (no en el texto),
 * cada sección se titula a su manera y hay renglones partidos. Inventado, sin contactos. */
const RIDER = `RIDER TÉCNICO 2026
INFORMACIÓN DE CONTACTO
Management: Fulana de Tal
BACKLINE
Baterías
Sugerimos: Tama Star Classic, Yamaha recording custom o similares.
1 bombo 22x18”.
1 stand Hi-Hat.
4 stands Platillos con Boom.
1 silla batería.
1 tapete antideslizante para la batería.
Amplificadores de bajo
Ampeg SVT Classic/SVT PRO 3/ SVT PRO 4 + Ampeg SVT810E, Fender Rumble
500 o Aguilar AG700.
Amplificadores de Guitarras Eléctricas
2 (dos) Fender Hot Rod DeVille 212 IV o Fender Twin Reverb.
Percu
1 Shaker LP
Adicionales
6 Bases para guitarra (Hércules o similares), 1 Base para bajo, 1 Base para
Teclados, 2 Mesas de percusión. Especial atención a estas bases de instrumentos
por favor.
OUTPUT LIST
GUITARRA
3   LIDER IEM /`;

describe("rider con secciones a su manera", () => {
  const traza: RenglonLeido[] = [];
  const e = interpretar([{ nombre: "rider.pdf", tipo: "pdf", lineas: lineasDeTexto(RIDER), avisos: [] }], { traza });

  it("sin el nombre en el texto, la banda queda sin nombre (no 'Información de contacto')", () => {
    expect(e.artistas).toEqual([SIN_NOMBRE]);
  });
  it("cada sección es un grupo; los renglones partidos se unen; la nota y el in-ear no son ítems", () => {
    expect(e.items.map(i => `${i.cantidad} ${i.descripcion} [${i.grupo}·${i.categoria}]`)).toEqual([
      "1 bombo 22x18” [Baterías·Batería]",
      "1 stand Hi-Hat [Baterías·Batería]",
      "4 stands Platillos con Boom [Baterías·Batería]",
      "1 silla batería [Baterías·Batería]",
      "1 tapete antideslizante para la batería [Baterías·Batería]",
      "1 Ampeg SVT Classic/SVT PRO 3/ SVT PRO 4 + Ampeg SVT810E, Fender Rumble 500 o Aguilar AG700 [Amplificadores de bajo·Ampli bajo]",
      "2 Fender Hot Rod DeVille 212 IV o Fender Twin Reverb [Amplificadores de Guitarras Eléctricas·Ampli guitarra]",
      "1 Shaker LP [Percu·Percusión]",
      "6 Bases para guitarra (Hércules o similares) [Adicionales·Bases]",
      "1 Base para bajo [Adicionales·Bases]",
      "1 Base para Teclados [Adicionales·Bases]",
      "2 Mesas de percusión [Adicionales·Percusión]",
    ]);
  });
  it("el modelo sugerido queda en la traza como nota de su sección", () => {
    expect(traza.find(r => r.texto.startsWith("Sugerimos"))).toMatchObject({ etiqueta: "nota", grupo: "Baterías" });
  });
});

/* Otro rider real, en inglés y en mayúsculas (inventado aquí, sin contactos): "TOUR 2026" no es la
 * banda, el modelo del kit va como título dentro de DRUMS, medidas "8 X 10" y modelos con números. */
const RIDER_TOUR = `RIDER TÉCNICO
TOUR 2026
1 Escenario principal de 12,20 mts x 12,20 m x 1,70 mts
1 Red wifi confiable y potente en todas las áreas
Contacto: fulano@correo.com +52 55 1234 5678
MIXER DE MONITORES:
08 monitores de piso L-Acoustics, Meyer Sound, Nexo, JBL
DRUMS
1 DRUM RUG
YAMAHA MAPLE CUSTOM ABSOLUTE
1 KICK 22” X 18” WITH NEW DRUMHEAD
2 SNARE DRUM 14” X 5” WITH
2 STANDS
BASS
1 AMPEG 8 X 10“ ENCLOSURE
PERCUSSION (MEINL PROFESSIONAL SERIES)
1 MEINL CH27 CORTINA 27 BARRAS
GUITAR
2 ROLAND JC 120 JAZZ CHORUS
KEYBOARD
1 LP ASPIRE TRAP TABLE
OTHER
1 ORANGE GAFFER TAPE ROLL 1.89 IN
20 1,5V AA PROCELL BATTERIES`;

describe("rider de gira en inglés", () => {
  const traza: RenglonLeido[] = [];
  const e = interpretar([{ nombre: "rider.pdf", tipo: "pdf", lineas: lineasDeTexto(RIDER_TOUR), avisos: [] }], { traza });

  it("risers y sobretarimas no son backline (lo definió el usuario)", () => {
    const t: RenglonLeido[] = [];
    const r = interpretar([{ nombre: "r.pdf", tipo: "pdf", lineas: lineasDeTexto("RIDER TÉCNICO\nLOS RAYOS\nBACKLINE\nDRUMS\n1 Drum riser 8x8 con ruedas\n2 sobretarimas de 2x2\n1 Kick 22\nKEYS\n1 riser de teclados\n1 Nord Stage 3"), avisos: [] }], { traza: t });
    expect(r.items.map(i => i.descripcion)).toEqual(["Kick 22", "Nord Stage 3"]);
  });
  it("'TOUR 2026' no es el nombre de la banda", () => {
    expect(e.artistas).toEqual([SIN_NOMBRE]);
  });
  it("el nombre que el rider repite en sus frases, en mayúsculas y minúsculas, es la banda", () => {
    const texto = RIDER_TOUR.replace("TOUR 2026", "TOUR 2026\nwww.losrayosmusica.com\nLos sobre escenarios son de uso exclusivo de Los Rayos y por ningún motivo se comparten.\n" +
      "Los Rayos no se presentarán sin haber realizado el soundcheck.\nEl Contratante debe garantizar el show de Los Rayos y El Artista lo confirmará.");
    const r = interpretar([{ nombre: "rider.pdf", tipo: "pdf", lineas: lineasDeTexto(texto), avisos: [] }]);
    expect(r.artistas).toEqual(["Los Rayos"]);
  });
  it("quien firma es la banda si su nombre está en el correo del documento", () => {
    const conFirma = (firma: string) => interpretar([{ nombre: "rider.pdf", tipo: "pdf", avisos: [],
      lineas: lineasDeTexto(RIDER.replace("Management: Fulana de Tal", "Management: Fulana de Tal\nlosrayosyelfin@gmail.com") + "\nGracias\n" + firma) }]).artistas;
    expect(conFirma("Att: Los Rayos")).toEqual(["Los Rayos"]);
    expect(conFirma("Atentamente,\nLos Rayos")).toEqual(["Los Rayos"]);
    expect(conFirma("Att: Fulana de Tal")).toEqual([SIN_NOMBRE]);   // firma alguien que no está en el correo
  });
  it("'El Contratante' y 'El Artista' repetidos no son la banda", () => {
    const texto = RIDER_TOUR.replace("TOUR 2026", "TOUR 2026\nEl Contratante proveerá el backline.\nEl Artista y El Contratante firman.\nEl Contratante paga.\nEl Artista llega.\nEl Artista toca.");
    const r = interpretar([{ nombre: "rider.pdf", tipo: "pdf", lineas: lineasDeTexto(texto), avisos: [] }]);
    expect(r.artistas).toEqual([SIN_NOMBRE]);
  });
  it("lo de antes del backline (tarima, wifi, monitores) y los datos de contacto no son ítems", () => {
    expect(e.items[0]!.descripcion).toBe("DRUM RUG");
    expect(traza.find(r => r.texto.includes("@"))?.etiqueta).not.toBe("item");
    expect(traza.find(r => r.texto.startsWith("1 Red wifi"))).toMatchObject({ etiqueta: "no-backline", item: null });
  });
  it("el modelo del kit es nota de DRUMS; medidas y modelos con números no son cantidades; cinta y pilas no son backline", () => {
    expect(traza.find(r => r.texto.startsWith("YAMAHA"))).toMatchObject({ etiqueta: "nota", grupo: "Drums" });
    expect(e.items.map(i => `${i.cantidad} ${i.descripcion} [${i.grupo}·${i.categoria}]`)).toEqual([
      "1 DRUM RUG [Drums·Batería]",
      "1 KICK 22” X 18” WITH NEW DRUMHEAD [Drums·Batería]",
      "2 SNARE DRUM 14” X 5” [Drums·Batería]",
      "2 STANDS [Drums·Batería]",
      "1 AMPEG 8 X 10“ ENCLOSURE [Bass·Ampli bajo]",
      "1 MEINL CH27 CORTINA 27 BARRAS [Percussion (Meinl Professional Series)·Percusión]",
      "2 ROLAND JC 120 JAZZ CHORUS [Guitar·Ampli guitarra]",
      "1 LP ASPIRE TRAP TABLE [Keyboard·Percusión]",
    ]);
  });
});
