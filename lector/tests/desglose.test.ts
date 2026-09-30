import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cargarEvento } from "../src/datos/eventos";
import { separarCantidad } from "../src/dominio/lista";
import { buscarMedidas, claveZona, emparejar, integrar, interpretar, interpretarEtiquetas, leerDesglose, lineasDeTexto, musicosDesdeCanales, risersDesde, type Documento } from "../src/lectura";

const fixture = (f: string) => new Uint8Array(readFileSync(`tests/fixtures/${f}`));
const texto = (t: string, extra: Partial<Documento> = {}): Documento => ({ nombre: "rider", tipo: "texto", lineas: lineasDeTexto(t), avisos: [], ...extra });

describe("medidas", () => {
  it.each([
    ["Drum Riser - 2.40x2.40x.60", [2.4, 2.4, 0.6]],
    ["Sobre tarima de 9.60 mts (ANCHO) mts x 2.44 (FONDO) x 1.50 mts (ALTO)", [9.6, 2.44, 1.5]],
    ["Negro de 2.44 x 2.44 m. X 60 cm de altura", [2.44, 2.44, 0.6]],
    ["8ft x 8ft x 23in", [2.44, 2.44, 0.58]],
    ["10 × 3 × 0,50 m", [10, 3, 0.5]],
  ])("%s", (t, [a, f, h]) => {
    const m = buscarMedidas(t)!;
    expect(m).not.toBeNull();
    expect([m.ancho, m.fondo, m.alto ?? null].map(x => x === null ? null : Math.round(x * 100) / 100)).toEqual([a, f, h]);
  });
  it("no ve medidas donde solo hay pulgadas de un tambor", () => {
    expect(separarCantidad('Floor Tom 14" x 14')).toEqual({ cantidad: 1, descripcion: 'Floor Tom 14" x 14' });
    expect(separarCantidad("Snare stand x2")).toEqual({ cantidad: 2, descripcion: "Snare stand" });
    expect(separarCantidad("X1 Amplificador de bajo")).toEqual({ cantidad: 1, descripcion: "Amplificador de bajo" });
    expect(separarCantidad("(02) Twin Reverb")).toEqual({ cantidad: 2, descripcion: "Twin Reverb" });
  });
});

describe("nombres de artistas", () => {
  const registrados = ["Grupo Niche", "Ed Maverick", "Tan Bionica", "Kany García", "Sean Paul"];
  it.each([
    ["NICHE", "Grupo Niche"],
    ["ED MAVEWRICK", "Ed Maverick"],
    ["TAN BIOTICA", "Tan Bionica"],
    ["Kany Garcia", "Kany García"],
    ["Los Estrambóticos", null],
  ])("%s → %s", (n, esperado) => expect(emparejar(n, registrados)).toBe(esperado));
});

describe("risers desde texto", () => {
  it("una zona por riser con nombre, medidas y cantidad", () => {
    const z = risersDesde(`Rolling Risers
Drum Riser - 2.40x2.40x.60
Keyboard Riser - 2.40x2.40x.40
String Quartet Platform - 1.20x2.40x.40
Todos los risers deberán estar nivelados.`, "Ed Maverick");
    expect(z.map(x => [x.nombre, x.ancho, x.fondo, x.alto, x.cantidad, x.ruedas])).toEqual([
      ["Drum Riser", 2.4, 2.4, 0.6, 1, true],
      ["Keyboard Riser", 2.4, 2.4, 0.4, 1, true],
      ["String Quartet Platform", 1.2, 2.4, 0.4, 1, true],
    ]);
  });
  it("RISER C Y D son dos zonas iguales; las escaleras no son risers", () => {
    const z = risersDesde(`• ROLLING RISER A - X1 Sobre tarima de 9.60 mts (ANCHO) mts x 2.44 (FONDO) x 1.50 mts (ALTO)
• ROLLING RISER C Y D – X2 Sobre tarimas de 2.44 (ANCHO) x 2.44 (FONDO) x 1mts (ALTO)
• X2 Escalera de 1.50 mts de alto. (RISER A)`, "Grupo Niche");
    expect(z.map(x => `${x.nombre} ${x.ancho}x${x.fondo}x${x.alto} x${x.cantidad}`)).toEqual([
      "Riser A 9.6x2.44x1.5 x1", "Riser C 2.44x2.44x1 x1", "Riser D 2.44x2.44x1 x1",
    ]);
    expect(z.every(x => !x.dudoso)).toBe(true);
  });
  it("los módulos en que se divide una tarima no son otra tarima", () => {
    const z = risersDesde(`• 1 Tarima con ruedas y con frenos de 10 × 3 × 0,50 m. Debe poder dividirse únicamente en módulos de
4 × 3 + 3 × 3 + 3 × 3.
• 2 Tarimas con ruedas de 2 mts x 2mts x la altura mas baja`, "Tan Bionica");
    expect(z.map(x => `${x.ancho}x${x.fondo} x${x.cantidad}`)).toEqual(["10x3 x1", "2x2 x2"]);
  });
  it("claveZona iguala nombres equivalentes", () => {
    expect(claveZona("Amplifier Riser")).toBe(claveZona("AMP RISER"));
    expect(claveZona("Keyboard Riser")).toBe(claveZona("keys riser"));
    expect(claveZona("Sobre tarima A")).toBe(claveZona("Riser A"));
  });
});

describe("rider en secciones (Ed Maverick)", () => {
  const e = interpretar([texto(`BATERÍA
Opción Preferida
Ludwig Downbeat 1969 o equivalente profesional aprobado previamente.

Configuración:
Bombo 20" x 14"
Tarola 14" x 4"
Floor Tom 14" x 14

Hardware
1 Snare Stand
2 Bases de platillo con boom

BAJO (Omar)

Instrumento
1 Hofner Bass HI-CB-PE-TBK Ignition Club

Bajo spare
Opción 1 Hofner HI-CB-TBK Ignition
Opcion 2 Fender Precision American standard olympic white
Sustituciones sujetas a aprobación previa de Production Management.

GUITARRAS (ED MAVERICK)

Amplificación
1 Fender Twin Reverb

Sustituciones aceptables:
Fender  Deville 2x12

CUARTETO DE CUERDAS
4 Atriles negros profesionales
Nota: Los parches deben ser de marca REMO.

Bancos
4 Bancos altura regulable entre 56 y 86 cm.`)], { artista: "Ed Maverick" });
  const fila = (d: string) => e.items.find(i => i.descripcion.startsWith(d));

  it("las medidas en pulgadas no son cantidades", () => {
    expect(fila("Bombo")?.cantidad).toBe(1);
    expect(fila("Floor Tom")?.cantidad).toBe(1);
    expect(fila("Tarola")?.categoria).toBe("Batería");
  });
  it("los encabezados en mayúsculas son grupos, no ítems", () => {
    expect(e.items.map(i => i.descripcion)).not.toContain("BAJO (Omar)");
    expect(fila("Hofner Bass")?.grupo).toBe("Bajo (Omar)");
    expect(fila("Fender Twin")?.grupo).toBe("Guitarras (Ed Maverick)");
    expect(fila("Atriles")?.grupo).toBe("Cuarteto de Cuerdas");
  });
  it("las alternativas se marcan y no suman", () => {
    expect(fila("Fender Precision")).toMatchObject({ dudoso: true, nota: "alternativa aceptada (opción 2): no suma" });
    expect(fila("Fender  Deville")).toMatchObject({ dudoso: true, nota: "alternativa aceptada: no suma" });
    expect(fila("Fender Twin")).toMatchObject({ dudoso: false, nota: null });
    expect(e.items.map(i => i.descripcion)).not.toContain("Bajo spare");
  });
  it("las notas van a requisitos y '56 y 86 cm' no es una lista", () => {
    expect(e.requisitos).toEqual([{ artista: "Ed Maverick", tema: "otro", texto: "Los parches deben ser de marca REMO." }]);
    expect(fila("Bancos altura")).toMatchObject({ cantidad: 4, descripcion: "Bancos altura regulable entre 56 y 86 cm" });
    expect(e.items.some(i => i.descripcion === "cm")).toBe(false);
  });
});

describe("rider redactado (Nelda Piña)", () => {
  const e = interpretar([texto(`La agrupación lleva
• Tambora tradicional
• Gaita hembra
• Bajo eléctrico

El festival suministra
• Soporte profesional, firme y regulable para tambora. Alternativa aprobada: soporte de teclado doble X de alta resistencia.
• Planta de bajo profesional: cabezal mínimo 500 W y cabina 4x10; alternativa 2x10 + 1x15. Marcas sugeridas: Aguilar,
Ampeg, Markbass, Gallien-Krueger, Fender, Darkglass o equivalente.`)], { artista: "Nelda Piña" });
  it("lo que trae la banda queda como ARTISTA aunque no sea backline conocido", () => {
    expect(e.items.filter(i => i.proveedor === "ARTISTA").map(i => i.descripcion)).toEqual(["Tambora tradicional", "Gaita hembra", "Bajo eléctrico"]);
    expect(e.items.map(i => i.descripcion)).not.toContain("La agrupación lleva");
  });
  it("de una frase se toma la primera oración y se marca para revisar", () => {
    expect(e.items.find(i => i.descripcion.startsWith("Soporte"))).toMatchObject({ descripcion: "Soporte profesional, firme y regulable para tambora", proveedor: null, dudoso: true });
    expect(e.items.map(i => i.descripcion)).not.toContain("Ampeg, Markbass, Gallien-Krueger, Fender, Darkglass o equivalente");
  });
});

describe("etiquetas de un plano", () => {
  const et = (texto: string, x: number, y: number, confianza = 90) => ({ texto, confianza, x, y });
  const musicos = musicosDesdeCanales([{ instrumento: "BASS OMAR" }, { instrumento: "KICK IN" }, { instrumento: "VOX 1 ALEX" }]);
  it("saca puestos, zonas, corriente y monitor con su posición", () => {
    const r = interpretarEtiquetas([
      et("AMP RISER", 0.5, 0.15), et("OMAR", 0.3, 0.4), et("110V AC", 0.32, 0.45), et("MIX 3", 0.34, 0.47),
      et("DRUMS", 0.5, 0.3), et("VIOLIN 1", 0.7, 0.25), et("1. KICK IN B91", 0.9, 0.9), et("22 BONGOS SM47", 0.9, 0.95),
      et("8ft x 8ft x 23in", 0.5, 0.2), et("GUITAR WORLD", 0.85, 0.6), et("ruido", 0.1, 0.1, 30),
    ], { artista: "Ed Maverick", musicos, risers: [{ ancho: 2.4, fondo: 2.4 }] });
    expect(r.zonas.map(z => [z.nombre, z.tipo, z.lado, z.profundidad])).toEqual([["Amp riser", "riser", "centro", "us"], ["Guitar World", "area", "sl", "centro"]]);
    expect(r.puestos.map(p => [p.nombre, p.rol])).toEqual([["Omar", "bajo"], ["Drums", "bateria"], ["Violin 1", "cuerdas"]]);
    expect(r.puestos[0]).toMatchObject({ corriente: "110 V", monitor: "MIX 3", x: 0.3, y: 0.4, dudoso: true });
    expect(r.avisos).toEqual([]);
  });
  it("avisa cuando el riser dibujado no está en la hoja", () => {
    const r = interpretarEtiquetas([et("12.2 x 4.88 x 1.5 mts", 0.5, 0.2)], { artista: "Kany García", risers: [{ ancho: 14.44, fondo: 4.88 }] });
    expect(r.avisos[0]).toMatch(/12\.2 x 4\.88 x 1\.5 mts.*no está en la hoja/);
  });
  it("musicosDesdeCanales asocia nombres a roles", () => {
    expect(musicos.get("omar")).toBe("bajo");
    expect(musicos.get("alex")).toBe("voz");
    expect(musicos.has("kick")).toBe(false);
  });
});

describe("desglose de producción (.xlsx)", () => {
  const base = cargarEvento("cordillera-2026")!;
  it("lee días, artistas, riders, risers, IO list y planos sin OCR", async () => {
    const { extraccion: e, imagenes } = await leerDesglose(fixture("desglose-cordillera-2026.xlsx"), "desglose.xlsx", { base });
    expect(e.dias.map(d => d.fecha)).toEqual(base.dias.filter(d => d.tipo === "show").map(d => d.fecha).slice(0, 2));
    expect(e.artistas).toContain("Grupo Niche");
    expect(e.artistas).toContain("Ed Maverick");
    expect(e.artistas).not.toContain("Niche");

    const niche = e.items.filter(i => i.artista === "Grupo Niche");
    expect(niche.find(i => /Amplificador de bajo/.test(i.descripcion))).toMatchObject({ cantidad: 1, grupo: "Bass Asi", categoria: "Ampli bajo" });
    expect(niche.find(i => /Mesas de percusi/.test(i.descripcion))?.cantidad).toBe(4);
    expect(niche.some(i => /^Nota/i.test(i.descripcion))).toBe(false);
    expect(e.requisitos.filter(r => r.artista === "Grupo Niche" && r.tema === "otro").length).toBeGreaterThanOrEqual(2);

    expect(e.zonas.filter(z => z.artista === "Grupo Niche").map(z => z.nombre)).toEqual(["Riser A", "Riser B", "Riser C", "Riser D"]);
    expect(e.zonas.filter(z => z.artista === "Ed Maverick").map(z => z.nombre)).toEqual(["Drum Riser", "Keyboard Riser", "Amplifier Riser", "String Quartet Platform"]);

    const canales = e.canales.filter(c => c.artista === "Grupo Niche" && c.tipo === "entrada");
    expect(canales[0]).toMatchObject({ numero: "1", instrumento: "TUMBADORA", microfono: "ARTIST SUPPLIES", base: "BOOM", ubicacion: "RISER A" });
    expect(e.canales.some(c => c.tipo === "salida")).toBe(true);

    expect(e.planos.length).toBe(8);
    expect(imagenes.map(i => i.archivo)).toContain("stage-plots/cordillera-2026/grupo-niche.png");
    expect(e.puestos).toEqual([]); // sin lectores no hay OCR
    expect(e.avisos.some(a => /Tan Bionica: backline del Día 2 está por confirmar/.test(a))).toBe(true);
  }, 30000);

  it("se integra al evento con ids estables y cruces", async () => {
    const { extraccion } = await leerDesglose(fixture("desglose-cordillera-2026.xlsx"), "desglose.xlsx", { base });
    const { paquete, resumen } = integrar(extraccion, base, "desglose.xlsx");
    const niche = paquete.artistas.find(a => a.nombre === "Grupo Niche")!;
    const zonas = paquete.zonas.filter(z => z.artistaId === niche.id);
    expect(zonas.map(z => z.nombre)).toEqual(["Riser A", "Riser B", "Riser C", "Riser D"]);
    const canalesA = paquete.canales.filter(c => c.artistaId === niche.id && c.zonaId === zonas[0]!.id);
    expect(canalesA.length).toBeGreaterThan(0);
    expect(resumen.zonas.nuevos).toBeGreaterThan(0);
    expect(resumen.canales.nuevos).toBeGreaterThan(500);
    expect(paquete.stagePlots.some(p => p.artistaId === niche.id)).toBe(true);
  }, 30000);
});
