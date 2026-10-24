import { describe, expect, it } from "vitest";
import { interpretar } from "../src/lectura/interpretar";

const doc = (texto: string) => ({ nombre: "lista.txt", lineas: texto.split("\n").map(t => ({ texto: t })), avisos: [] }) as never;

describe("lista «tal cual»", () => {
  it("cada renglón con cantidad es una pieza escrita como está, agrupada por el título de arriba", () => {
    const e = interpretar([doc(`#TAL CUAL
RIDER TÉCNICO LOS RAYOS
BATERÍA 5 PIEZAS
1 KICK
1 TOM 16
SET DE PLATILLOS ZILDJIAN
1 CRASH 18
TECLADO
1 PIANO YAMAHA MOTIF 8 O MONTAGE
MICROFONERÍA
3 CAJAS DIRECTAS RADIAL
4 DPA 4099 PARA: 2 CONGAS, ALEGRE, BONGO
IN EARS
12 IN EARS SHURE PSM1000`)]);
    expect(e.artistas).toEqual(["Los Rayos"]);
    expect(e.items.map(i => `${i.cantidad} ${i.descripcion} | ${i.grupo} | ${i.categoria}`)).toEqual([
      "1 KICK | Batería 5 Piezas | Batería",
      "1 TOM 16 | Batería 5 Piezas | Batería",
      "1 CRASH 18 | Set de Platillos Zildjian | Platillos",
      "1 PIANO YAMAHA MOTIF 8 O MONTAGE | Teclado | Teclado",
      "3 CAJAS DIRECTAS RADIAL | Microfonería | Otro",
      "4 DPA 4099 PARA: 2 CONGAS, ALEGRE, BONGO | Microfonería | Otro",
      "12 IN EARS SHURE PSM1000 | In Ears | In ears",
    ]);
  });
  it("sin «#TAL CUAL» al comienzo se lee como siempre", () => {
    const e = interpretar([doc(`RIDER TÉCNICO LOS RAYOS
MICROFONERIA:
3 CAJAS DIRECTAS RADIAL`)]);
    expect(e.items).toEqual([]);
  });
});
