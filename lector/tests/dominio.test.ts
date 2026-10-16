import { describe, expect, it } from "vitest";
import { categorizar, noEsBackline, parsearLista, propietarioDe, referenciaDe, separarCantidad } from "../src/dominio";

describe("no es backline", () => {
  it.each([
    ["Drum riser 2x2", null, true],
    ["Pedestal", null, true],
    ["Mic stand", null, true],
    ["Jirafa", null, true],
    ["Caja directa", null, true],
    ["DI activa", null, true],
    ["Cable de instrumento", null, true],
    ["Extensión eléctrica", null, true],
    ["Pedestal para platillo", null, false],
    ["Pedestales", "Drums", false],
    ["Extensión para pedal de bombo", null, false],
    ["Di la vuelta a la tarima", null, false],
    ["Fender Twin Reverb", null, false],
    // Lo que el usuario dijo que no es backline (2026-10-16): es de sonido.
    ["Audífonos in ear Shure SE215", null, true], ["2 Shure SE535", null, true],
    ["Mezclador personal Behringer P16", null, true], ["Allen & Heath ME-1", null, true],
    ["Inalámbrico para guitarra Shure GLXD16", null, true], ["Line 6 Relay G10", null, true],
    ["Laptop para secuencias", null, true], ["Interfaz de audio Focusrite", null, true],
    // …y lo que sí: la base para el laptop, la mesa del DJ y la caja de extensión de un ampli.
    ["Base para laptop", null, false], ["Laptop stand", null, false], ["Mesa para DJ", null, false],
    ["Caja de extensión 4x10", null, false],
  ])("%s (%s) → %s", (texto, grupo, esperado) => {
    expect(noEsBackline(texto, grupo)).toBe(esperado);
  });
});

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
    // Otros bajos: van en Bajo. "Double bass pedal" sigue siendo de la batería.
    ["1 Contrabajo", "Bajo"], ["Baby bass", "Bajo"], ["Bajo sexto", "Bajo"], ["Upright bass", "Bajo"],
    ["Double bass pedal", "Batería"], ["Baby Bass Ampeg", "Bajo"], ["Bajo quinto", "Bajo"], ["Ampli de contrabajo", "Ampli bajo"],
    // Amplis y accesorios de bajo que faltaban.
    ["Darkglass Microtubes 900", "Ampli bajo"], ["Fender Bassman 800", "Ampli bajo"], ["Combo de bajo", "Ampli bajo"],
    ["Bass amp", "Ampli bajo"], ["Amplificador para bajo", "Ampli bajo"], ["Caja de extensión 4x10", "Ampli bajo"],
    ["Pedalera de bajo", "Bajo"], ["Afinador de bajo", "Bajo"], ["Cuerdas de bajo 45-105", "Bajo"], ["Pedalera", "Guitarra"],
    // Cuerdas típicas con las guitarras; órgano y Leslie con los teclados.
    ["Tiple", "Guitarra"], ["Requinto", "Guitarra"], ["Cuatro venezolano", "Guitarra"], ["Charango", "Guitarra"],
    ["Hammond B3 con Leslie 122", "Teclado"], ["Leslie 122", "Teclado"], ["Órgano Nord C2D", "Teclado"], ["Fender Rhodes", "Teclado"],
    // Percusión latina y colombiana.
    ["Set de tumbadoras", "Percusión"], ["Bongó LP", "Percusión"], ["Campana de timbal", "Percusión"], ["Djembe", "Percusión"],
    ["Caja vallenata", "Percusión"], ["Güira", "Percusión"], ["Pandereta", "Percusión"],
    // El acrílico y las baterías electrónicas son batería.
    ["Drum shield", "Batería"], ["Acrílico para batería", "Batería"], ["Plexiglass 5 paneles", "Batería"],
    ["Roland TD-27", "Batería"], ["Batería electrónica Yamaha DTX", "Batería"],
    ["Máquina de hi-hat", "Batería"], ["Pedal de expresión", "Teclado"], ["Pailas 14 y 15", "Percusión"], ["Djembé", "Percusión"],
    ["Congas w/ stands", "Percusión"], ["2x12 cab", "Ampli guitarra"], ["1x12 Roland Blues Cube", "Ampli guitarra"],
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
