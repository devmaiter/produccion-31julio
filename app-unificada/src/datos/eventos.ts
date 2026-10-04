import { PaqueteEvento } from "../dominio";

/* Todos los eventos de data/, validados al cargar. Un evento nuevo guardado
   desde "Importar" aparece aquí sin tocar código. Más recientes primero. */
const archivos = import.meta.glob<{ default: unknown }>("../../data/*.json", { eager: true });

export const EVENTOS: PaqueteEvento[] = Object.values(archivos)
  .map(m => PaqueteEvento.parse(m.default))
  .sort((a, b) => b.evento.desde.localeCompare(a.evento.desde));
