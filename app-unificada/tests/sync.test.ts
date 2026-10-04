import "fake-indexeddb/auto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVENTOS } from "../src/datos/eventos";
import { AlmacenIndexedDB, AlmacenMemoria } from "../src/sync/almacen";
import { opsDeImportacion } from "../src/sync/importacion";
import { reducir, type Op } from "../src/sync/ops";
import { RegistroOps } from "../src/sync/registro";
import { Sincronizador } from "../src/sync/sincronizador";
import { Tienda } from "../src/sync/tienda";
import { Extraccion, integrar } from "../src/lectura";
import rider from "./fixtures/extraccion-rider.json";

const cordillera = EVENTOS.find(e => e.evento.id === "cordillera-2026")!;
const item0 = cordillera.items[0]!;

/** Un "celular": su almacén, su tienda y un sincronizador que habla con el registro por un fetch falso. */
async function celular(registro: () => RegistroOps | null, nombre: string) {
  const almacen = new AlmacenMemoria();
  const tienda = new Tienda(EVENTOS, almacen);
  await tienda.iniciar();
  await tienda.cambiarAutor(nombre);
  const pedir = (async (_url: string, init: { body: string }) => {
    const r = registro();
    if (!r) throw new TypeError("sin red");
    const cuerpo = JSON.stringify(r.sincronizar(JSON.parse(init.body)));
    return new Response(cuerpo, { headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  const sync = new Sincronizador(tienda, almacen, "api/sync", pedir);
  return { tienda, sync, almacen };
}

const contar = (itemId: string, contado: number) => ({ tipo: "verificacion" as const, eventoId: "cordillera-2026", datos: { itemId, contado, listo: false } });

describe("operaciones", () => {
  it("el estado no depende del orden en que llegan", () => {
    const ops: Op[] = [
      { id: "a-00000001", eventoId: "cordillera-2026", ts: 1, dispositivo: "a", tipo: "verificacion", datos: { itemId: item0.id, contado: 1, listo: false } },
      { id: "b-00000001", eventoId: "cordillera-2026", ts: 2, dispositivo: "b", tipo: "verificacion", datos: { itemId: item0.id, contado: 5, listo: false } },
      { id: "a-00000002", eventoId: "cordillera-2026", ts: 3, dispositivo: "a", tipo: "item.borrar", datos: { itemId: cordillera.items[1]!.id } },
    ];
    const uno = reducir(EVENTOS, ops).get("cordillera-2026")!;
    const otro = reducir(EVENTOS, [...ops].reverse()).get("cordillera-2026")!;
    expect(uno.verificaciones.get(item0.id)?.contado).toBe(5); // gana el más reciente
    expect(otro.verificaciones.get(item0.id)?.contado).toBe(5);
    expect(uno.paquete.items).toHaveLength(cordillera.items.length - 1);
    expect(JSON.stringify(uno.paquete)).toBe(JSON.stringify(otro.paquete));
  });
  it("no modifica las bases", () => {
    reducir(EVENTOS, [{ id: "a-00000009", eventoId: "cordillera-2026", ts: 1, dispositivo: "a", tipo: "item.borrar", datos: { itemId: item0.id } }]);
    expect(cordillera.items[0]).toBe(item0);
  });
  it("una importación crea un evento nuevo en todos los dispositivos", () => {
    const { paquete, resumen } = integrar(Extraccion.parse(rider), null, "rider.pdf");
    const ops = opsDeImportacion(null, paquete, resumen.itemsTocados)
      .map((o, i) => ({ ...o, id: `x-0000000${i}`, ts: 10 + i, dispositivo: "x" }) as Op);
    expect(ops.map(o => o.tipo)).toEqual(["estructura", "item.guardar", "item.guardar", "item.guardar", "item.guardar"]);
    const e = reducir(EVENTOS, ops).get(paquete.evento.id)!;
    expect(e.paquete).toEqual(paquete);
  });
  it("reimportar lo mismo no genera operaciones", () => {
    const { paquete } = integrar(Extraccion.parse(rider), null, "rider.pdf");
    const otra = integrar(Extraccion.parse(rider), paquete, "rider.pdf");
    expect(opsDeImportacion(paquete, otra.paquete, otra.resumen.itemsTocados)).toEqual([]);
  });
});

describe("modo evento: celulares + portátil", () => {
  it("dos celulares ven lo mismo a través del portátil", async () => {
    const registro = new RegistroOps(null);
    const a = await celular(() => registro, "Julián");
    const b = await celular(() => registro, "Erika");
    await a.tienda.aplicar(contar(item0.id, 1));
    await b.tienda.aplicar(contar(cordillera.items[1]!.id, 2));
    await a.sync.ciclo(); await b.sync.ciclo(); await a.sync.ciclo();
    for (const c of [a, b]) {
      const e = c.tienda.estado("cordillera-2026")!;
      expect(e.verificaciones.get(item0.id)?.contado).toBe(1);
      expect(e.verificaciones.get(cordillera.items[1]!.id)?.contado).toBe(2);
      expect(e.ultimoCambio.get(item0.id)?.quien).toBe("Julián");
    }
    expect(a.sync.estado).toBe("conectado");
    expect(registro.total).toBe(2);
  });

  it("sin red guarda todo y lo envía al volver", async () => {
    let hayRed = false;
    const registro = new RegistroOps(null);
    const a = await celular(() => (hayRed ? registro : null), "Julián");
    await a.tienda.aplicar(contar(item0.id, 3));
    await a.sync.ciclo();
    expect(a.sync.estado).toBe("sin-conexion");
    expect(a.sync.pendientes).toBe(1);
    expect(a.tienda.estado("cordillera-2026")!.verificaciones.get(item0.id)?.contado).toBe(3); // se ve aunque no haya red
    hayRed = true;
    await a.sync.ciclo();
    expect(a.sync.pendientes).toBe(0);
    expect(registro.total).toBe(1);
  });

  it("si cambian de portátil, los celulares le reenvían todo", async () => {
    let registro = new RegistroOps(null);
    const a = await celular(() => registro, "Julián");
    const b = await celular(() => registro, "Erika");
    await a.tienda.aplicar(contar(item0.id, 1));
    await a.sync.ciclo(); await b.sync.ciclo();
    registro = new RegistroOps(null); // portátil nuevo, vacío
    await b.sync.ciclo();
    expect(registro.total).toBe(1); // Erika le pasó lo que tenía de Julián
    const c = await celular(() => registro, "Nuevo");
    await c.sync.ciclo();
    expect(c.tienda.estado("cordillera-2026")!.verificaciones.get(item0.id)?.contado).toBe(1);
  });

  it("sin servidor (copia estática) trabaja solo en el dispositivo", async () => {
    const almacen = new AlmacenMemoria();
    const tienda = new Tienda(EVENTOS, almacen);
    await tienda.iniciar();
    const sync = new Sincronizador(tienda, almacen, "api/sync", (async () => new Response("<html>", { status: 404, headers: { "content-type": "text/html" } })) as unknown as typeof fetch);
    await sync.ciclo();
    expect(sync.estado).toBe("sin-servidor");
  });

  it("el portátil guarda en disco y rechaza operaciones inválidas", () => {
    const dir = mkdtempSync(join(tmpdir(), "backline-"));
    try {
      const archivo = join(dir, "ops.jsonl");
      const r1 = new RegistroOps(archivo);
      const valida = { id: "d-000000001", eventoId: "cordillera-2026", ts: 5, dispositivo: "d", tipo: "verificacion", datos: { itemId: item0.id, contado: 1, listo: true } };
      const res = r1.sincronizar({ dispositivo: "d", cursor: 0, ops: [valida, { tipo: "hackeo" }, valida] });
      expect(res).toMatchObject({ rechazadas: 1, ops: [] });
      const r2 = new RegistroOps(archivo); // reinicio del portátil
      expect(r2.total).toBe(1);
      expect(r2.instancia).toBe(r1.instancia);
    } finally { rmSync(dir, { recursive: true }); }
  });
});

describe("almacén IndexedDB", () => {
  it("guarda, deduplica y lleva los pendientes", async () => {
    const a = new AlmacenIndexedDB(indexedDB, `prueba-${Math.random()}`);
    const op: Op = { id: "d-000000001", eventoId: "cordillera-2026", ts: 5, dispositivo: "d", tipo: "verificacion", datos: { itemId: item0.id, contado: 1, listo: true } };
    expect(await a.agregar([op, op], true)).toHaveLength(1);
    expect(await a.agregar([op], false)).toHaveLength(0);
    expect((await a.pendientes()).map(o => o.id)).toEqual([op.id]);
    await a.marcarEnviadas([op.id]);
    expect(await a.pendientes()).toEqual([]);
    await a.marcarTodasPendientes();
    expect(await a.pendientes()).toHaveLength(1);
    await a.escribirMeta("autor", "Julián");
    expect(await a.leerMeta("autor")).toBe("Julián");
    expect(await a.todas()).toEqual([op]);
  });
});
