/* Estado de la interfaz compartido entre vistas. */
import type { Sincronizador } from "../sync/sincronizador";
import type { Tienda } from "../sync/tienda";

export type Vista = "backline" | "totales" | "horario" | "importar" | "equipo";

export interface Ui {
  tienda: Tienda;
  sync: Sincronizador;
  eventoId: string;
  diaId: string;
  vista: Vista;
  /** Artistas con la ficha abierta (se conserva entre repintadas). */
  abiertos: Set<string>;
  /** Ítem en edición. */
  editando: string | null;
  repintar(): void;
  irA(eventoId: string, vista?: Vista): void;
  aviso(texto: string): void;
}
