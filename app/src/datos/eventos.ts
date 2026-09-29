import { PaqueteEvento } from "../dominio";
import cordillera from "../../data/cordillera-2026.json";
import simonBolivar from "../../data/simon-bolivar-2026.json";
import vallenato from "../../data/vallenato-al-parque-2026.json";

/** Eventos disponibles, validados al cargar. Más recientes primero. */
export const EVENTOS: PaqueteEvento[] = [cordillera, vallenato, simonBolivar]
  .map(p => PaqueteEvento.parse(p))
  .sort((a, b) => b.evento.desde.localeCompare(a.evento.desde));
