import { describe, expect, it } from "vitest";
import {
  ItemBackline, avance, categorizar, estadoDe, parsearLista, propietarioDe,
  referenciaDe, separarCantidad, totalesPorReferencia, type ItemBacklineEntrada,
} from "../src/dominio";

const item = (p: Partial<ItemBacklineEntrada> & { id: string }): ItemBackline => ItemBackline.parse({
  eventoId: "ev", diaId: "d1", artistaId: "a", descripcion: "Snare stand", cantidad: 1,
  categoria: "Bases", referencia: "Snare stand", propietario: { tipo: "propio" }, ...p,
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

describe("verificación en cancha", () => {
  const it1 = item({ id: "i1", cantidad: 2 });
  it("estado según el conteo", () => {
    expect(estadoDe(it1)).toBe("pendiente");
    expect(estadoDe(it1, { itemId: "i1", contado: null, listo: true })).toBe("ok");
    expect(estadoDe(it1, { itemId: "i1", contado: 2, listo: false })).toBe("ok");
    expect(estadoDe(it1, { itemId: "i1", contado: 1, listo: false })).toBe("falta");
    expect(estadoDe(it1, { itemId: "i1", contado: 3, listo: false })).toBe("sobra");
  });
  it("la cantidad corregida reemplaza la de la hoja", () => {
    expect(estadoDe(it1, { itemId: "i1", contado: 3, listo: false, cantidadCorregida: 3 })).toBe("ok");
  });
  it("avance del conjunto", () => {
    const items = [it1, item({ id: "i2" })];
    const a = avance(items, new Map([["i1", { itemId: "i1", contado: 2, listo: false }]]));
    expect(a).toMatchObject({ total: 2, ok: 1, pendiente: 1, porcentaje: 50 });
  });
});

describe("totales por referencia", () => {
  it("suma dentro del día y toma el máximo entre días", () => {
    const items = [
      item({ id: "a", diaId: "sab", artistaId: "x", cantidad: 2 }),
      item({ id: "b", diaId: "sab", artistaId: "y", cantidad: 1, propietario: { tipo: "tercero", nombre: "OML" } }),
      item({ id: "c", diaId: "dom", artistaId: "z", cantidad: 2 }),
    ];
    const [t] = totalesPorReferencia(items);
    expect(t).toMatchObject({ referencia: "Snare stand", porDia: { sab: 3, dom: 2 }, aTener: 3, deTerceros: 1, artistas: ["x", "y", "z"] });
  });
});
