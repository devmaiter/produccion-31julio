import { describe, expect, it } from "vitest";
import { categorizar, parsearLista, propietarioDe, referenciaDe, separarCantidad } from "../src/dominio";

describe("categorizar", () => {
  it.each([
    ["1 HotRod Deville", "Ampli guitarra"],
    ["Base de teclado doble", "Bases"],
    ["Yamaha Montage 8", "Teclado"],
    ["22\" Ride Zildjian K", "Platillos"],
    ["14\" Snare Ludwig Black Magic", "Batería"],
    ["LP Congas Galaxy Giovanni Hidalgo", "Percusión"],
    ["Magician percussion table", "Percusión"],
    ["Ampeg SVT Classic", "Ampli bajo"],
    ["Pioneer CDJ-2000 NXS2", "DJ"],
    ["Stage fan 14\"", "Escenario"],
    ["Transformador 110/220", "Cables y energía"],
    ["Cosa rara", "Otro"],
    // El HARDWARE de la batería es batería (así vienen los riders); los demás stands son bases.
    ["SINGLE KICK PEDAL", "Batería"],
    ["HI HAT STAND", "Batería"],
    ["SNARE STAND", "Batería"],
    ["BOOM CYMBALS STAND", "Batería"],
    ["Base de Platillo Tipo Boom", "Batería"],
    ["DRUM THRONE", "Batería"],
    ["Banqueta de batería", "Batería"],
    ["DRUM CARPET", "Batería"],
    ["Hi-Hat 14\"", "Platillos"],
    ["Guitar stand", "Bases"],
    ["Keyboard stand doble", "Bases"],
    ["Pie de micrófono", "Bases"],
    ["Tapete", "Escenario"],
    // Una misma cosa con varios nombres: la alfombra de la batería…
    ["drum rug", "Batería"], ["DRUM CARPET", "Batería"], ["alfombra para batería", "Batería"], ["tapete de batería", "Batería"],
    ["1 RUG Drums", "Batería"], // en el bloque DRUMS (el texto lleva el grupo)
    // …la de la percusión, aunque esté en su bloque sin decirlo…
    ["percussion rug", "Percusión"], ["alfombra para percusión", "Percusión"], ["tapete de percusión", "Percusión"],
    ["1 RUG Percussion (Meinl Professional Series)", "Percusión"],
    // …y suelta, o un ventilador: Escenario (en los reels, Extras).
    ["black carpet 2x2", "Escenario"], ["floor fan", "Escenario"], ["ventilador de piso", "Escenario"],
    // Atriles, sillas y bancos de músicos son bases; los pedales de efectos son de la guitarra (o del bajo).
    ["2 atriles con lámpara", "Bases"], ["Silla sin brazos para llamador", "Bases"], ["Bancos altura regulable", "Bases"],
    ["pedal de efectos", "Guitarra"], ["pedalboard", "Guitarra"], ["Boss tuner pedal", "Guitarra"], ["2 pedales de efectos para bajo", "Bajo"],
    ["kick pedal", "Batería"], ["sustain pedal", "Teclado"],
    // Parches por su marca o modelo.
    ["Remo Coated Ambassador", "Batería"], ["DRUM HEAD NEW EVANS G2", "Batería"],
    // Repuestos y accesorios que sí son backline.
    ["2 pares de baquetas Vic Firth 5A", "Batería"], ["escobillas", "Batería"], ["mallets", "Batería"],
    ["afinador de clip", "Guitarra"], ["2 juegos de cuerdas 10-46", "Guitarra"], ["1 bajo de repuesto", "Bajo"],
  ])("%s → %s", (texto, cat) => expect(categorizar(texto)).toBe(cat));
});

describe("referenciaDe", () => {
  it("agrupa la misma pieza escrita en español o inglés", () => {
    expect(referenciaDe("Base de redoblante")).toBe(referenciaDe("Snare stand"));
    expect(referenciaDe("Silla de batería")).toBe("Drum throne");
    expect(referenciaDe("Bar stool")).toBe(referenciaDe("Music stool"));
  });
  it("no confunde el tall snare stand con el snare stand", () => {
    expect(referenciaDe("Tall snare stand")).not.toBe(referenciaDe("Snare stand"));
  });
  it("sin alias usa la descripción limpia con mayúscula", () => {
    expect(referenciaDe("pedal wah (propio)")).toBe("Pedal wah");
  });
});

describe("propietarioDe", () => {
  it("CN es propio, lo demás es tercero", () => {
    expect(propietarioDe("CN")).toEqual({ tipo: "propio" });
    expect(propietarioDe("OML")).toEqual({ tipo: "tercero", nombre: "OML" });
    expect(propietarioDe("OML/CN/DIEGO REYES")).toEqual({ tipo: "tercero", nombre: "OML" });
    expect(propietarioDe("")).toEqual({ tipo: "sin-definir" });
  });
});

describe("lista pegada", () => {
  it("separa cantidades sin confundir medidas", () => {
    expect(separarCantidad("2 Snare stand")).toEqual({ cantidad: 2, descripcion: "Snare stand" });
    expect(separarCantidad("Boom stand x3")).toEqual({ cantidad: 3, descripcion: "Boom stand" });
    expect(separarCantidad("14\" Floor tom")).toEqual({ cantidad: 1, descripcion: "14\" Floor tom" });
  });
  it("respeta 'Categoría: detalle', adivina el resto e ignora el encabezado", () => {
    const r = parsearLista("Rapha:\n- Platillos: 1 ride\n1 HotRod Deville\n\n3 bases de instrumento", "Rapha");
    expect(r).toEqual([
      { categoria: "Platillos", descripcion: "ride", cantidad: 1 },
      { categoria: "Ampli guitarra", descripcion: "HotRod Deville", cantidad: 1 },
      { categoria: "Bases", descripcion: "bases de instrumento", cantidad: 3 },
    ]);
  });
});
