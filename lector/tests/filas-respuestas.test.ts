import { describe, expect, it } from "vitest";
import { lineasDeTexto } from "../src/lectura/documento";
import { medidaAlComienzo } from "../src/lectura/cortar";
import { hardwareCompleto, interpretar, tecladoYAccesorios, unirLeslie, type RenglonLeido } from "../src/lectura/interpretar";
import { filasDelRider } from "../src/lectura/planilla";

/* Cómo van las filas de teclados, órganos, hardware y percusión (lo respondió el usuario, 2026-10-16).
 * Las piezas que salen están en el entrenamiento; aquí, lo que el entrenamiento no mira: categorías,
 * notas, la traza y la planilla. Riders inventados. */
function leer(texto: string) {
  const traza: RenglonLeido[] = [];
  const e = interpretar([{ nombre: "r.pdf", tipo: "pdf", avisos: [], lineas: lineasDeTexto(`RIDER TÉCNICO\nLOS RAYOS\nBACKLINE\n${texto}`) }], { traza });
  return { e, traza, items: e.items.map(i => `${i.cantidad} ${i.descripcion} [${i.categoria}]`) };
}

describe("teclado con sus accesorios", () => {
  it("el teclado, la base y el pedal salen en filas aparte, cada uno con su categoría", () => {
    expect(leer("KEYS\n1 Nord Stage 88 con base tipo Z y pedal de expresión").items).toEqual([
      "1 Nord Stage 88 [Teclado]", "1 base tipo Z [Bases]", "1 pedal de expresión [Teclado]",
    ]);
  });
  it("el Leslie va con su órgano; lo que no es accesorio no se corta", () => {
    expect(tecladoYAccesorios("1 Hammond B3 con Leslie 122")).toBeNull();
    expect(tecladoYAccesorios("1 Hammond XK-5 + Leslie 3300 + pedal de expresión")).toEqual(["1 Hammond XK-5 + Leslie 3300", "1 pedal de expresión"]);
    expect(tecladoYAccesorios("1 Nord Electro 6D con funda")).toBeNull();
    expect(tecladoYAccesorios("1 Base para teclado con pedal")).toBeNull();
    expect(tecladoYAccesorios("1 Djembe con base")).toBeNull();
  });
  it("en una tabla, si la observación es solo la lista de accesorios, también van aparte; si no, queda con su teclado", () => {
    expect(tecladoYAccesorios("1   Teclado Nord Electro 6   Con pedal de sustain")).toEqual(["1 Teclado Nord Electro 6", "1 pedal de sustain"]);
    expect(tecladoYAccesorios("1   Nord Stage 3 88   Con base tipo Z y pedal de sustain")).toEqual(["1 Nord Stage 3 88", "1 base tipo Z", "1 pedal de sustain"]);
    expect(tecladoYAccesorios("1   Teclado Nord Electro 6   Con pedal de sustain, revisar teclas")).toBeNull();
    expect(tecladoYAccesorios("1   Teclado Nord Electro 6   Lo trae el músico")).toBeNull();
  });
});

describe("hardware completo", () => {
  it("reconoce el renglón del hardware completo y no el título ni las bases contadas", () => {
    expect(hardwareCompleto("Hardware DW 9000 completo")).toMatchObject({ sets: 1, marca: "DW 9000", bases: null });
    expect(hardwareCompleto("01 Set de Hardware completo")).toMatchObject({ sets: 1, marca: "", bases: null });
    expect(hardwareCompleto("Hardware completo con 2 soportes")).toMatchObject({ sets: 1, marca: "", bases: 2 });
    expect(hardwareCompleto("Full hardware")).toMatchObject({ sets: 1, marca: "", bases: null });
    expect(hardwareCompleto("HARDWARE")).toBeNull();
    expect(hardwareCompleto("HARDWARE SET")).toBeNull();
    expect(hardwareCompleto("Hardware:")).toBeNull();
    expect(hardwareCompleto("5 Bases (hardware completo DW, con una base extra)")).toBeNull();
  });
  it("las piezas son de la batería y la nota dice cuántas bases de platillo y por qué", () => {
    const { e, items } = leer("DRUMS\n1 Snare 14\"\nFull hardware");
    expect(items).toEqual([
      "1 Snare 14\" [Batería]", "1 Base de redoblante [Batería]", "1 Máquina de hi-hat [Batería]",
      "1 Pedal de bombo [Batería]", "2 Bases de platillo [Batería]",
    ]);
    expect(e.items.at(-1)!.nota).toMatch(/2, lo de siempre \(crash y ride\)/);
  });
  it("con platillos en el kit, una base por platillo sin el hi-hat", () => {
    const { e } = leer("BATERÍA\nHardware completo\n1 Hi-hat 14\"\n2 Crash 16\" y 18\"\n1 Ride 20\"");
    const bases = e.items.find(i => /platillo/i.test(i.descripcion))!;
    expect(bases.cantidad).toBe(3);
    expect(bases.nota).toMatch(/una por platillo del kit/);
  });
  it("si el rider ya pide cada pieza aparte, el renglón queda como una sola nota en la traza y en la planilla", () => {
    const { e, traza } = leer("DRUMS\n1 Bombo 22\"\nHARDWARE DW 9000\n1 Snare stand\n1 Hi-hat stand\n3 Boom stands\n1 Kick pedal");
    const delHardware = traza.filter(r => r.texto === "HARDWARE DW 9000");
    expect(delHardware).toHaveLength(1);
    expect(delHardware[0]).toMatchObject({ etiqueta: "nota", item: null });
    const filas = filasDelRider(e, traza).map(f => `${f.tipo} ${f.cantidad ?? ""} ${f.texto}`.replace(/\s+/g, " ").trim());
    expect(filas.filter(f => /hardware/i.test(f))).toEqual(["nota HARDWARE DW 9000"]);
    // Cada ítem de la traza sigue apuntando a su pieza.
    for (const r of traza.filter(x => x.item !== null)) expect(r.texto).toContain(e.items[r.item!]!.descripcion);
  });
});

describe("set de congas", () => {
  it("sin decir cuántas: una fila, cantidad 1, y la nota dice que son conga y tumba", () => {
    const { e } = leer("PERCUSIÓN\n1 Set de congas LP\nTumbadoras con sus bases\n3 Tumbadoras LP\n1 Set de congas LP (quinto, conga y tumba)");
    expect(e.items.map(i => [i.cantidad, i.descripcion, i.nota])).toEqual([
      [1, "Set de congas LP", "set de 2 tambores: conga y tumba (el rider no dice cuántos)"],
      [1, "Tumbadoras con sus bases", "set de 2 tambores: conga y tumba (el rider no dice cuántos)"],
      [3, "Tumbadoras LP", null],
      [1, "Set de congas LP (quinto, conga y tumba)", null],
    ]);
  });
});

/* Lo que encontró la revisión (2026-10-16): formas comunes que se escapaban. Las piezas están en el entrenamiento;
 * aquí, quién las pone, las categorías y las notas. Riders inventados. */
describe("revisión: quién pone cada pieza", () => {
  const conProveedor = (texto: string) => leer(texto).e.items.map(i => `${i.cantidad} ${i.descripcion} [${i.proveedor ?? "-"}]`);
  it("el hardware completo que trae la banda se abre y cada pieza va marcada", () => {
    expect(conProveedor("DRUMS\nHardware completo: lo trae la banda")).toEqual([
      "1 Base de redoblante [ARTISTA]", "1 Máquina de hi-hat [ARTISTA]", "1 Pedal de bombo [ARTISTA]", "2 Bases de platillo [ARTISTA]",
    ]);
  });
  it("lo que el hardware excluye porque lo trae el baterista queda marcado; lo demás lo pone la producción", () => {
    expect(conProveedor("DRUMS\nFull hardware (except kick pedal, drummer brings his own)")).toEqual([
      "1 Base de redoblante [-]", "1 Máquina de hi-hat [-]", "1 Pedal de bombo [ARTISTA]", "2 Bases de platillo [-]",
    ]);
  });
  it("«(lo trae la banda)» al final del teclado vale para sus tres filas", () => {
    expect(conProveedor("KEYS\n1 Nord Stage 3 88 con base y pedal de sustain (lo trae la banda)")).toEqual([
      "1 Nord Stage 3 88 [ARTISTA]", "1 base [ARTISTA]", "1 pedal de sustain [ARTISTA]",
    ]);
    expect(conProveedor("KEYS\n1 Nord Stage 3 88 con base y pedal de sustain - lo trae la banda")).toEqual([
      "1 Nord Stage 3 88 [ARTISTA]", "1 base [ARTISTA]", "1 pedal de sustain [ARTISTA]",
    ]);
  });
});

describe("revisión: categorías y notas", () => {
  it("los accesorios del teclado en inglés: las bases en Bases y los pedales en Teclado", () => {
    expect(leer("KEYS\n1 Korg Kronos 2 88 with double X stand and sustain pedal\n1 Digital piano Kawai MP11SE with bench and triple pedal").items).toEqual([
      "1 Korg Kronos 2 88 [Teclado]", "1 double X stand [Bases]", "1 sustain pedal [Teclado]",
      "1 Digital piano Kawai MP11SE [Teclado]", "1 bench [Bases]", "1 triple pedal [Teclado]",
    ]);
  });
  it("las pailas y el djembé con tilde son percusión", () => {
    expect(leer("PERCUSIÓN\nPailas 14\" y 15\" con su base\nTimbales 14\" y 15\", djembé 12\"").items).toEqual([
      "1 Pailas 14\" y 15\" con su base [Percusión]", "1 Timbales 14\" y 15\" [Percusión]", "1 djembé 12\" [Percusión]",
    ]);
  });
  it("«set of congas» y «set de tumbas» llevan la nota de los 2 tambores", () => {
    const { e } = leer("PERCUSSION\n1 set of congas (LP Matador) with stands\nSet de tumbas LP con sus bases\nCongas: quinto, conga y tumba");
    expect(e.items.map(i => i.nota)).toEqual([
      "set de 2 tambores: conga y tumba (el rider no dice cuántos)", "set de 2 tambores: conga y tumba (el rider no dice cuántos)", null,
    ]);
  });
  it("lo que el hardware dice y no es pieza ni marca queda de nota en cada pieza", () => {
    const { e } = leer("DRUMS\nHardware completo en buen estado");
    expect(e.items.map(i => i.descripcion)).toEqual(["Base de redoblante", "Máquina de hi-hat", "Pedal de bombo", "Bases de platillo"]);
    for (const i of e.items) expect(i.nota).toMatch(/en buen estado/);
  });
  it("la silla y la alfombra del hardware salen en la traza como lo que pide junto al hardware", () => {
    const { e, traza } = leer("DRUMS\nHardware completo, silla y alfombra");
    const delRenglon = traza.filter(r => r.texto === "Hardware completo, silla y alfombra");
    expect(delRenglon.map(r => r.motivo)).toEqual([
      ...Array(4).fill("hardware completo: se abre pieza por pieza"), "lo pide junto al hardware completo", "lo pide junto al hardware completo",
    ]);
    expect(delRenglon.map(r => e.items[r.item!]!.descripcion)).toEqual(["Base de redoblante", "Máquina de hi-hat", "Pedal de bombo", "Bases de platillo", "silla", "alfombra"]);
  });
});

describe("revisión: hardwareCompleto lee el renglón por partes", () => {
  it("sets, bases, exclusiones, lo que trae la banda y lo que pide además", () => {
    expect(hardwareCompleto("Hardware completo, silla y alfombra")).toMatchObject({ sets: 1, marca: "", extras: ["silla", "alfombra"], notas: [] });
    expect(hardwareCompleto("Hardware completo DW, sin pedal de bombo")).toMatchObject({ marca: "DW", sin: ["pedal de bombo"], traeSin: false });
    expect(hardwareCompleto("Full hardware (except kick pedal, drummer brings his own)")).toMatchObject({ sin: ["pedal de bombo"], traeSin: true, trae: false });
    expect(hardwareCompleto("Full hardware incl. 4 boom stands")).toMatchObject({ bases: 4, marca: "" });
    expect(hardwareCompleto("Hardware completo with 3 boom stands")).toMatchObject({ bases: 3, marca: "", notas: [] });
    expect(hardwareCompleto("Hardware completo x2")).toMatchObject({ sets: 2 });
    expect(hardwareCompleto("Hardware completo para 2 baterías")).toMatchObject({ sets: 2 });
    expect(hardwareCompleto("Hardware completo (2 sets)")).toMatchObject({ sets: 2 });
    expect(hardwareCompleto("2 x Full hardware DW 5000")).toMatchObject({ sets: 2, marca: "DW 5000" });
    expect(hardwareCompleto("Hardware Pearl completo (2 boom stands)")).toMatchObject({ marca: "Pearl", bases: 2 });
    expect(hardwareCompleto("1 Full hardware set Tama Iron Cobra")).toMatchObject({ marca: "Tama Iron Cobra" });
    expect(hardwareCompleto("Hardware completo: lo trae la banda")).toMatchObject({ trae: true, marca: "", notas: [] });
    expect(hardwareCompleto("3. Hardware completo Tama")).toMatchObject({ sets: 1, marca: "Tama" });
    expect(hardwareCompleto("Herrajes completos DW")).toMatchObject({ marca: "DW" });
    expect(hardwareCompleto("Full drum hardware")).toMatchObject({ sets: 1, marca: "" });
  });
  it("lo que no es un hardware completo sigue sin serlo", () => {
    expect(hardwareCompleto("HERRAJES")).toBeNull();
    expect(hardwareCompleto("Hardware: 2x soportes de caja, 1x soporte charles")).toBeNull();
  });
});

describe("revisión: medidas y cantidades", () => {
  it("una caja de parlantes o el tamaño de un tambor adelante no son una cantidad; 2x16 Crash sí", () => {
    expect(medidaAlComienzo("8x10 Ampeg SVT-810E")).toBe(true);
    expect(medidaAlComienzo("1x12 Roland Blues Cube")).toBe(true);
    expect(medidaAlComienzo("14x6.5 Ludwig Supraphonic snare")).toBe(true);
    expect(medidaAlComienzo("14 x 5,5 Snare")).toBe(true);
    expect(medidaAlComienzo("22x18 Kick DW")).toBe(true);
    expect(medidaAlComienzo("2x16 Crash")).toBe(false);
    expect(medidaAlComienzo("2x10 Tom")).toBe(false);
    expect(medidaAlComienzo("2 x 14\" crash")).toBe(false);
  });
  it("el número del Leslie no lo vuelve otra fila", () => {
    expect(unirLeslie("1 Hammond XK-5 + 1 Leslie 3300")).toBe("1 Hammond XK-5 + Leslie 3300");
    expect(unirLeslie("1 Hammond B3 and 1 Leslie 122")).toBe("1 Hammond B3 and Leslie 122");
    expect(unirLeslie("1 Hammond B3 y 2 Bases")).toBe("1 Hammond B3 y 2 Bases");
  });
});
