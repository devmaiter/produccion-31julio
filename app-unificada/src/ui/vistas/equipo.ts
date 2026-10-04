/* Equipo y modo evento: nombre de quien usa este celular, estado de la
 * sincronización con el portátil y respaldos en archivo. */
import type { Ui } from "../contexto";
import { descargar, esc } from "../util";

export function pintarEquipo(ui: Ui): string {
  const s = ui.sync;
  const estado = {
    "conectado": `Conectado al portátil del evento${s.ultimaSync ? ` (última sincronización ${new Date(s.ultimaSync).toLocaleTimeString("es-CO")})` : ""}.`,
    "sin-conexion": "Sin conexión con el portátil. Todo se guarda en este celular y se envía al volver a la red.",
    "sin-servidor": "Esta copia de la app no está servida por el portátil del evento: los cambios quedan solo en este dispositivo. Usa los respaldos para pasarlos.",
    "buscando": "Buscando el portátil del evento…",
  }[s.estado];
  return `<h3>Quién usa este celular</h3>
  <p><label>Tu nombre <input id="autor" value="${esc(ui.tienda.autor)}" placeholder="Ej. Julián" maxlength="60"></label>
  <br><small>Aparece junto a cada conteo o cambio que hagas.</small></p>
  <h3>Modo evento</h3>
  <p>${estado}</p>
  <p><small>${s.pendientes ? `${s.pendientes} cambio(s) por enviar · ` : ""}${ui.tienda.cantidadOps()} cambio(s) guardados en este dispositivo · id ${esc(ui.tienda.dispositivo)}</small></p>
  <p><button data-accion="sincronizar">Sincronizar ahora</button></p>
  <details><summary>Cómo montar el modo evento sin internet</summary>
    <ol>
      <li>En el portátil: <code>npm run evento</code>. Muestra una dirección y un código QR.</li>
      <li>Conecta los celulares a la misma red: el punto de acceso Wi-Fi del portátil o un router en tarima. No hace falta internet.</li>
      <li>Abre la dirección (o escanea el QR) en cada celular y escribe tu nombre aquí.</li>
      <li>Cada celular trabaja aunque se aleje de la red; al volver, envía lo pendiente. Mantén la pestaña abierta durante el evento.</li>
    </ol>
  </details>
  <h3>Respaldo</h3>
  <p><button data-accion="exportar">Descargar respaldo</button>
  <label class="boton">Cargar respaldo<input type="file" accept=".json,application/json" data-accion="importar-respaldo" hidden></label></p>
  <p><small>Un respaldo trae todos los cambios de este dispositivo. Cargarlo en otro los suma sin duplicar.</small></p>`;
}

export function conectarEquipo(ui: Ui, raiz: HTMLElement): void {
  raiz.addEventListener("change", async ev => {
    if (ui.vista !== "equipo") return;
    const t = ev.target as HTMLInputElement;
    if (t.id === "autor") { await ui.tienda.cambiarAutor(t.value); ui.aviso("Nombre guardado."); }
    if (t.dataset.accion === "importar-respaldo" && t.files?.[0]) {
      try {
        const datos = JSON.parse(await t.files[0].text());
        const n = await ui.tienda.recibir(Array.isArray(datos?.ops) ? datos.ops : []);
        ui.aviso(`${n} cambio(s) nuevos cargados del respaldo.`);
        void ui.sync.ciclo();
      } catch { ui.aviso("El archivo no es un respaldo válido."); }
      t.value = "";
    }
  });
  raiz.addEventListener("click", async ev => {
    if (ui.vista !== "equipo") return;
    const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-accion]");
    if (b?.dataset.accion === "sincronizar") { await ui.sync.ciclo(); ui.repintar(); }
    if (b?.dataset.accion === "exportar") {
      const ops = await ui.tienda.todasLasOps();
      descargar(`backline-respaldo-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`, JSON.stringify({ app: "backline", version: 1, ops }));
    }
  });
}
