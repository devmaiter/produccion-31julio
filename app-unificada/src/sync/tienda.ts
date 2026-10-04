/* La tienda es la única puerta para leer y cambiar datos en la app:
 * junta las bases, las operaciones guardadas en el dispositivo y las que
 * llegan del portátil, y avisa a la interfaz cuando algo cambia. */
import type { PaqueteEvento } from "../dominio/entidades";
import type { Almacen } from "./almacen";
import { Op, reducir, type EstadoEvento, type OpNueva } from "./ops";

type Oyente = () => void;

export class Tienda {
  private ops: Op[] = [];
  private estados = new Map<string, EstadoEvento>();
  private oyentes = new Set<Oyente>();
  private ultimoTs = 0;
  dispositivo = "";
  autor = "";
  /** Diferencia con el reloj del portátil, para que el orden no dependa de la hora de cada celular. */
  desfaseReloj = 0;

  constructor(private bases: readonly PaqueteEvento[], private almacen: Almacen) {}

  async iniciar(): Promise<void> {
    this.dispositivo = (await this.almacen.leerMeta("dispositivo")) ?? "";
    if (!this.dispositivo) {
      this.dispositivo = `d-${aleatorio(10)}`;
      await this.almacen.escribirMeta("dispositivo", this.dispositivo);
    }
    this.autor = (await this.almacen.leerMeta("autor")) ?? "";
    this.desfaseReloj = Number(await this.almacen.leerMeta("desfase")) || 0;
    this.ops = await this.almacen.todas();
    this.recalcular();
  }

  eventos(): PaqueteEvento[] {
    return [...this.estados.values()].map(e => e.paquete).sort((a, b) => b.evento.desde.localeCompare(a.evento.desde));
  }
  estado(eventoId: string): EstadoEvento | undefined {
    return this.estados.get(eventoId);
  }
  cantidadOps(): number { return this.ops.length; }
  async todasLasOps() { return this.almacen.todas(); }

  /** Registra cambios hechos en este dispositivo. */
  async aplicar(nuevas: OpNueva | OpNueva[]): Promise<void> {
    const lista = (Array.isArray(nuevas) ? nuevas : [nuevas]).map(o => Op.parse({
      ...o, id: `${this.dispositivo}-${aleatorio(12)}`, ts: this.ahora(), dispositivo: this.dispositivo, autor: this.autor || undefined,
    }));
    await this.almacen.agregar(lista, true);
    this.ops.push(...lista);
    this.recalcular();
  }

  /** Operaciones que llegan de otros dispositivos. Descarta las inválidas. */
  async recibir(entrantes: unknown[]): Promise<number> {
    const validas = entrantes.flatMap(o => { const r = Op.safeParse(o); return r.success ? [r.data] : []; });
    const nuevas = await this.almacen.agregar(validas, false);
    if (nuevas.length) { this.ops.push(...nuevas); this.recalcular(); }
    return nuevas.length;
  }

  async cambiarAutor(nombre: string): Promise<void> {
    this.autor = nombre.trim().slice(0, 60);
    await this.almacen.escribirMeta("autor", this.autor);
    this.avisar();
  }
  async ajustarReloj(horaServidor: number, idaYVuelta: number): Promise<void> {
    this.desfaseReloj = Math.round(horaServidor + idaYVuelta / 2 - Date.now());
    await this.almacen.escribirMeta("desfase", String(this.desfaseReloj));
  }

  suscribir(fn: Oyente): () => void { this.oyentes.add(fn); return () => this.oyentes.delete(fn); }
  avisar(): void { this.oyentes.forEach(f => f()); }

  private ahora(): number {
    this.ultimoTs = Math.max(Date.now() + this.desfaseReloj, this.ultimoTs + 1);
    return this.ultimoTs;
  }
  private recalcular(): void {
    this.estados = reducir(this.bases, this.ops);
    this.avisar();
  }
}

export function aleatorio(n: number): string {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map(b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}
