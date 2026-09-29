import { Verificacion } from "../dominio";

/** Dónde se guarda lo que se verifica en cancha. La interfaz es la misma
 *  para memoria (pruebas), el navegador (sin conexión) y, más adelante,
 *  Firestore (sincronización entre celulares). */
export interface RepositorioVerificaciones {
  todas(eventoId: string): Promise<Map<string, Verificacion>>;
  guardar(eventoId: string, v: Verificacion): Promise<void>;
  borrar(eventoId: string, itemId: string): Promise<void>;
}

export class RepositorioEnMemoria implements RepositorioVerificaciones {
  private datos = new Map<string, Map<string, Verificacion>>();

  async todas(eventoId: string): Promise<Map<string, Verificacion>> {
    return new Map(this.datos.get(eventoId) ?? []);
  }
  async guardar(eventoId: string, v: Verificacion): Promise<void> {
    const ok = Verificacion.parse({ ...v, actualizado: new Date().toISOString() });
    if (!this.datos.has(eventoId)) this.datos.set(eventoId, new Map());
    this.datos.get(eventoId)!.set(ok.itemId, ok);
  }
  async borrar(eventoId: string, itemId: string): Promise<void> {
    this.datos.get(eventoId)?.delete(itemId);
  }
}

/** Guarda en el almacenamiento del navegador. Lo que no pase la validación
 *  (datos viejos o corruptos) se descarta en vez de romper la app. */
export class RepositorioLocal implements RepositorioVerificaciones {
  constructor(private almacen: Pick<Storage, "getItem" | "setItem">, private prefijo = "backline:v1:") {}

  private leer(eventoId: string): Map<string, Verificacion> {
    const out = new Map<string, Verificacion>();
    try {
      const crudo = JSON.parse(this.almacen.getItem(this.prefijo + eventoId) ?? "[]");
      for (const x of Array.isArray(crudo) ? crudo : []) {
        const r = Verificacion.safeParse(x);
        if (r.success) out.set(r.data.itemId, r.data);
      }
    } catch { /* almacenamiento vacío o ilegible */ }
    return out;
  }
  private escribir(eventoId: string, m: Map<string, Verificacion>): void {
    try { this.almacen.setItem(this.prefijo + eventoId, JSON.stringify([...m.values()])); } catch { /* sin espacio / modo privado */ }
  }

  async todas(eventoId: string): Promise<Map<string, Verificacion>> {
    return this.leer(eventoId);
  }
  async guardar(eventoId: string, v: Verificacion): Promise<void> {
    const m = this.leer(eventoId);
    const ok = Verificacion.parse({ ...v, actualizado: new Date().toISOString() });
    m.set(ok.itemId, ok);
    this.escribir(eventoId, m);
  }
  async borrar(eventoId: string, itemId: string): Promise<void> {
    const m = this.leer(eventoId);
    m.delete(itemId);
    this.escribir(eventoId, m);
  }
}
