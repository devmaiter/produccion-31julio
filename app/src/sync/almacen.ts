/* Dónde guarda cada dispositivo sus operaciones. En el navegador es
 * IndexedDB (sobrevive a recargas y a quedarse sin señal); en pruebas, memoria. */
import type { Op } from "./ops";

export interface Almacen {
  todas(): Promise<Op[]>;
  /** Guarda operaciones (ignora las que ya tiene). `propias` = creadas aquí y aún sin enviar. */
  agregar(ops: Op[], propias: boolean): Promise<Op[]>;
  pendientes(): Promise<Op[]>;
  marcarEnviadas(ids: string[]): Promise<void>;
  marcarTodasPendientes(): Promise<void>;
  leerMeta(clave: string): Promise<string | undefined>;
  escribirMeta(clave: string, valor: string): Promise<void>;
}

export class AlmacenMemoria implements Almacen {
  private ops = new Map<string, Op>();
  private sinEnviar = new Set<string>();
  private meta = new Map<string, string>();
  async todas() { return [...this.ops.values()]; }
  async agregar(ops: Op[], propias: boolean) {
    const nuevas = ops.filter(o => !this.ops.has(o.id));
    for (const o of nuevas) { this.ops.set(o.id, o); if (propias) this.sinEnviar.add(o.id); }
    return nuevas;
  }
  async pendientes() { return [...this.sinEnviar].map(id => this.ops.get(id)!); }
  async marcarEnviadas(ids: string[]) { ids.forEach(id => this.sinEnviar.delete(id)); }
  async marcarTodasPendientes() { this.ops.forEach((_, id) => this.sinEnviar.add(id)); }
  async leerMeta(k: string) { return this.meta.get(k); }
  async escribirMeta(k: string, v: string) { this.meta.set(k, v); }
}

export class AlmacenIndexedDB implements Almacen {
  private db: Promise<IDBDatabase>;
  constructor(fabrica: IDBFactory = indexedDB, nombre = "backline") {
    this.db = new Promise((ok, mal) => {
      const r = fabrica.open(nombre, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("ops", { keyPath: "op.id" }).createIndex("pendiente", "pendiente");
        r.result.createObjectStore("meta");
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
  }
  private async tx<T>(tiendas: string[], modo: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
    const db = await this.db;
    return new Promise((ok, mal) => {
      const t = db.transaction(tiendas, modo);
      const r = fn(t);
      t.oncomplete = () => ok(r ? r.result : (undefined as T));
      t.onerror = () => mal(t.error ?? new Error("Error guardando en el dispositivo"));
      t.onabort = () => mal(t.error ?? new Error("Transacción cancelada: ¿sin espacio en el dispositivo?"));
    });
  }
  async todas(): Promise<Op[]> {
    const filas = await this.tx<Array<{ op: Op }>>(["ops"], "readonly", t => t.objectStore("ops").getAll());
    return filas.map(f => f.op);
  }
  async agregar(ops: Op[], propias: boolean): Promise<Op[]> {
    const nuevas: Op[] = [];
    const unicas = [...new Map(ops.map(o => [o.id, o])).values()]; // un lote puede repetir una operación
    await this.tx(["ops"], "readwrite", t => {
      const s = t.objectStore("ops");
      for (const op of unicas) {
        const r = s.getKey(op.id);
        r.onsuccess = () => { if (r.result === undefined) { s.add({ op, pendiente: propias ? 1 : 0 }); nuevas.push(op); } };
      }
    });
    return nuevas;
  }
  async pendientes(): Promise<Op[]> {
    const filas = await this.tx<Array<{ op: Op }>>(["ops"], "readonly", t => t.objectStore("ops").index("pendiente").getAll(1));
    return filas.map(f => f.op);
  }
  async marcarEnviadas(ids: string[]): Promise<void> {
    await this.tx(["ops"], "readwrite", t => {
      const s = t.objectStore("ops");
      for (const id of ids) {
        const r = s.get(id);
        r.onsuccess = () => { if (r.result) s.put({ ...r.result, pendiente: 0 }); };
      }
    });
  }
  async marcarTodasPendientes(): Promise<void> {
    await this.tx(["ops"], "readwrite", t => {
      const r = t.objectStore("ops").openCursor();
      r.onsuccess = () => { const c = r.result; if (c) { c.update({ ...c.value, pendiente: 1 }); c.continue(); } };
    });
  }
  async leerMeta(k: string) { return this.tx<string | undefined>(["meta"], "readonly", t => t.objectStore("meta").get(k)); }
  async escribirMeta(k: string, v: string) { await this.tx(["meta"], "readwrite", t => { t.objectStore("meta").put(v, k); }); }
}
