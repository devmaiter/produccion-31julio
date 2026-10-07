import { describe, expect, it } from "vitest";
import { compararBaterias, medidasDe, piezaDeBateria, piezasDeFila } from "../src/dominio/bateria";

/* Una batería son siempre las mismas piezas, se escriba como se escriba (ejemplos inventados). */
describe("qué lleva una batería", () => {
  it("reconoce la pieza en español o en inglés", () => {
    const casos: Array<[string, string]> = [
      ["KD 22”", "bombo"], ["1 22\" Bass drum", "bombo"], ["Bombo 22x18", "bombo"],
      ["Snare 14” x 6.5", "redoblante"], ["Tarola 14 Maple", "redoblante"], ["Piccolo 13”", "redoblante"],
      ["Rack Toms 10”", "tom"], ["Tom aéreo 12”", "tom"], ["Floor tom 16”", "tom de piso"], ["Tom de piso 14”", "tom de piso"],
      ["Hi-hat stand de 3 patas", "máquina de hi-hat"], ["Máquina de Hi-Hat", "máquina de hi-hat"], ["Base para Hihat", "máquina de hi-hat"],
      ["Snare stand", "base de redoblante"], ["Bases para Snare", "base de redoblante"], ["Stands for snare drums", "base de redoblante"],
      ["Cymbal boom stands", "base de platillo"], ["Bases de platillo con Boom", "base de platillo"], ["Soportes de platos", "base de platillo"],
      ["Kick pedal DW 9000", "pedal de bombo"], ["Doble pedal DW 5000", "pedal de bombo"], ["Pedal de bombo", "pedal de bombo"],
      ["Drum throne", "silla"], ["Banqueta pro", "silla"], ["Sillín para batería", "silla"],
      ["Drum rug 2 x 2", "alfombra"], ["Tapete antideslizante", "alfombra"],
      ["Hi-Hat 14”", "hi-hat"], ["Crash 18” thin", "crash"], ["Ride 21”", "ride"], ["China 16”", "china"], ["Splash 10”", "splash"],
    ];
    for (const [texto, pieza] of casos) expect(piezaDeBateria(texto), texto).toBe(pieza);
    expect(piezaDeBateria("Fender Twin Reverb")).toBeNull();
  });

  it("las medidas: la profundidad no es otra pieza, y una lista son varias", () => {
    expect(medidasDe("Bombo 22” x 18”")).toEqual([22]);
    expect(medidasDe("Snare 14\" x 6.5")).toEqual([14]);
    expect(medidasDe("Rack Toms 8” - 10”- 12”")).toEqual([8, 10, 12]);
    expect(medidasDe("Toms 10/12/16")).toEqual([10, 12, 16]);
    expect(medidasDe("Toms: 10’’ 12’’ 16’’")).toEqual([10, 12, 16]);
  });

  it("'03 x Toms 10/12/16' en una fila es la misma batería que un tom por fila", () => {
    const unaFila = piezasDeFila(3, "Toms: 10” / 12” / 16”");
    const tres = [...piezasDeFila(1, "Tom 10”"), ...piezasDeFila(1, "Rack tom 12”"), ...piezasDeFila(1, "Tom 16”")];
    const r = compararBaterias(unaFila, tres);
    expect(r).toMatchObject({ coinciden: 3, total: 3, soloA: [], soloB: [] });
  });

  it("dice lo que falta y lo que sobra", () => {
    const a = [...piezasDeFila(1, "Bombo 22”"), ...piezasDeFila(2, "Crash 18”"), ...piezasDeFila(1, "Drum throne")];
    const b = [...piezasDeFila(1, "Kick 22"), ...piezasDeFila(1, "Crash 18”"), ...piezasDeFila(1, "Ride 20”"), ...piezasDeFila(1, "Banqueta")];
    const r = compararBaterias(a, b);
    expect(r.coinciden).toBe(3);
    expect(r.soloA).toEqual(["1 crash 18”"]);
    expect(r.soloB).toEqual(["1 ride 20”"]);
  });
});

describe("casos de la forma de los riders reales", () => {
  it("profundidad primero, opción sin comillas, marca en medio y parches", () => {
    expect(medidasDe("Redoblante de 5.5x14”")).toEqual([14]);
    expect(medidasDe("Tom piso 14 o 16 x 14”")[0]).toBe(14);
    expect(piezaDeBateria("STAND DW 5000 HI-HAT O SIMILAR w/2 legs")).toBe("máquina de hi-hat");
    expect(piezaDeBateria("KICK DRUM: EVANS POWER STROKE")).toBeNull();
    expect(piezasDeFila(1, "TAPETE 2.40 X 2.40")).toEqual([{ pieza: "alfombra", medida: null, cantidad: 1 }]);
  });
});

it("un ventilador de piso no es un tom de piso; 'Stand Boom Platillos' es base de platillo", () => {
  expect(piezaDeBateria("FLOOR FAN")).toBeNull();
  expect(piezaDeBateria("Stand Boom Platillos")).toBe("base de platillo");
});

it("un error de dedo y dos piezas en una fila", () => {
  expect(piezaDeBateria("Kcik 22”")).toBe("bombo");
  expect(piezaDeBateria("Snrae 14”")).toBe("redoblante");
  expect(piezaDeBateria("Rack")).toBeNull();
  expect(piezasDeFila(1, "Floor Tom 16”, Redoblante 14”x6”").map(p => `${p.pieza} ${p.medida}`)).toEqual(["tom de piso 16", "redoblante 14"]);
});
