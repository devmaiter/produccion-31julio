/* Sincroniza las operaciones de este dispositivo con el portátil del evento.
 *
 * Cada pocos segundos envía lo pendiente y recibe lo nuevo de los demás.
 * Sin red sigue funcionando: todo queda guardado y se envía al volver.
 * Si la app no la sirve el portátil (p. ej. una copia estática), trabaja
 * en modo "solo este dispositivo". */
import type { Almacen } from "./almacen";
import type { Tienda } from "./tienda";

export type EstadoSync = "buscando" | "conectado" | "sin-conexion" | "sin-servidor";

export interface RespuestaSync { servidor: string; cursor: number; ops: unknown[]; ahora: number; mas: boolean; rechazadas: number }

const MAX_LOTE_BYTES = 4_000_000;

export class Sincronizador {
  estado: EstadoSync = "buscando";
  pendientes = 0;
  ultimaSync: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private corriendo = false;

  constructor(
    private tienda: Tienda,
    private almacen: Almacen,
    private url = "api/sync",
    private pedir: typeof fetch = (...a) => fetch(...a),
  ) {}

  iniciar(): void {
    const ya = () => void this.ciclo();
    globalThis.addEventListener?.("online", ya);
    globalThis.document?.addEventListener?.("visibilitychange", () => { if (document.visibilityState === "visible") ya(); });
    void this.ciclo();
  }

  /** Un intercambio completo con el servidor (repite mientras haya más por enviar o recibir). */
  async ciclo(): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;
    if (this.timer) clearTimeout(this.timer);
    try {
      for (let vueltas = 0; vueltas < 50; vueltas++) {
        const pendientes = await this.almacen.pendientes();
        const lote = loteAcotado(pendientes);
        const cursor = Number(await this.almacen.leerMeta("cursor")) || 0;
        const servidor = await this.almacen.leerMeta("servidor");
        const t0 = Date.now();
        let res: Response;
        try {
          res = await this.pedir(this.url, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dispositivo: this.tienda.dispositivo, servidor, cursor, ops: lote }),
          });
        } catch {
          this.cambiar("sin-conexion", pendientes.length);
          return;
        }
        if (res.status === 404 || res.status === 405 || !(res.headers.get("content-type") ?? "").includes("json")) {
          this.cambiar("sin-servidor", pendientes.length);
          return;
        }
        if (!res.ok) { this.cambiar("sin-conexion", pendientes.length); return; }
        const r = (await res.json()) as RespuestaSync;
        await this.tienda.ajustarReloj(r.ahora, Date.now() - t0);
        await this.tienda.recibir(r.ops);
        await this.almacen.marcarEnviadas(lote.map(o => o.id));
        await this.almacen.escribirMeta("cursor", String(r.cursor));
        if (r.servidor !== servidor) {
          // Portátil nuevo o registro reiniciado: se le reenvía todo lo que este dispositivo tiene.
          await this.almacen.escribirMeta("servidor", r.servidor);
          if (servidor !== undefined) { await this.almacen.marcarTodasPendientes(); continue; }
        }
        this.ultimaSync = Date.now();
        const quedan = pendientes.length - lote.length;
        this.cambiar("conectado", quedan);
        if (!r.mas && quedan === 0) return;
      }
    } finally {
      this.corriendo = false;
      this.programar();
    }
  }

  private programar(): void {
    const espera = this.estado === "conectado" ? 3000 : this.estado === "sin-servidor" ? 60000 : 8000;
    this.timer = setTimeout(() => void this.ciclo(), espera);
  }
  private cambiar(estado: EstadoSync, pendientes: number): void {
    const cambio = estado !== this.estado || pendientes !== this.pendientes;
    this.estado = estado;
    this.pendientes = pendientes;
    if (cambio) this.tienda.avisar();
  }
}

function loteAcotado<T>(ops: T[]): T[] {
  const lote: T[] = [];
  let bytes = 0;
  for (const o of ops) {
    const n = JSON.stringify(o).length;
    if (lote.length && bytes + n > MAX_LOTE_BYTES) break;
    lote.push(o);
    bytes += n;
  }
  return lote;
}
