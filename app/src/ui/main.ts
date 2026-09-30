/* Arranque de la app: tienda (datos en el dispositivo), sincronización con el
 * portátil del evento, service worker (sin conexión) y navegación. */
import { EVENTOS } from "../datos/eventos";
import { avance } from "../dominio";
import { AlmacenIndexedDB, AlmacenMemoria, type Almacen } from "../sync/almacen";
import { Sincronizador } from "../sync/sincronizador";
import { Tienda } from "../sync/tienda";
import type { Ui, Vista } from "./contexto";
import { $, esc, pref } from "./util";
import { conectarBackline, pintarBackline } from "./vistas/backline";
import { conectarEquipo, pintarEquipo } from "./vistas/equipo";
import { pintarHorario } from "./vistas/horario";
import { conectarImportar, pintarImportar } from "./vistas/importar";
import { pintarTotales } from "./vistas/totales";

const VISTAS: Array<[Vista, string]> = [["backline", "Backline"], ["totales", "Totales"], ["horario", "Horario"], ["importar", "Importar"], ["equipo", "Equipo"]];
const CON_DIAS = new Set<Vista>(["backline", "horario"]);

async function abrirAlmacen(): Promise<Almacen> {
  try {
    const a = new AlmacenIndexedDB();
    await a.leerMeta("prueba");
    return a;
  } catch {
    return new AlmacenMemoria(); // navegador sin IndexedDB (p. ej. modo privado estricto)
  }
}

async function iniciar() {
  const almacen = await abrirAlmacen();
  const tienda = new Tienda(EVENTOS, almacen);
  await tienda.iniciar();
  const sync = new Sincronizador(tienda, almacen);

  let pintarDespues = false;
  let avisoTimer: ReturnType<typeof setTimeout>;
  const ui: Ui = {
    tienda, sync,
    eventoId: pref.leer("evento") ?? "",
    diaId: pref.leer("dia") ?? "",
    vista: (pref.leer("vista") as Vista) ?? "backline",
    abiertos: new Set(),
    editando: null,
    repintar: () => pintar(),
    irA(eventoId, vista) { ui.eventoId = eventoId; ui.diaId = ""; if (vista) ui.vista = vista; pintar(); },
    aviso(texto) {
      const el = $("#aviso");
      el.textContent = texto;
      el.hidden = false;
      clearTimeout(avisoTimer);
      avisoTimer = setTimeout(() => (el.hidden = true), 3500);
    },
  };

  function pintar() {
    // Si alguien está escribiendo, no se le borra lo que escribe: se repinta al salir del campo.
    const foco = document.activeElement as HTMLElement | null;
    if (foco && $("#contenido").contains(foco) && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName) && (foco as HTMLInputElement).type !== "checkbox" && (foco as HTMLInputElement).type !== "file") {
      pintarDespues = true;
      pintarEstado();
      return;
    }
    pintarDespues = false;
    const eventos = tienda.eventos();
    if (!eventos.some(e => e.evento.id === ui.eventoId)) ui.eventoId = eventos[0]?.evento.id ?? "";
    const e = tienda.estado(ui.eventoId);
    const dias = e?.paquete.dias ?? [];
    if (!dias.some(d => d.id === ui.diaId)) {
      ui.diaId = (dias.find(d => e!.paquete.items.some(i => i.diaId === d.id)) ?? dias[0])?.id ?? "";
    }
    pref.guardar("evento", ui.eventoId); pref.guardar("dia", ui.diaId); pref.guardar("vista", ui.vista);

    $("#evento").innerHTML = eventos.map(p => `<option value="${p.evento.id}" ${p.evento.id === ui.eventoId ? "selected" : ""}>${esc(p.evento.nombre)}</option>`).join("");
    $("#vistas").innerHTML = VISTAS.map(([v, t]) => `<button data-vista="${v}" aria-pressed="${v === ui.vista}">${t}</button>`).join("");
    $("#dias").innerHTML = CON_DIAS.has(ui.vista) ? dias.map(d => `<button data-dia="${d.id}" aria-pressed="${d.id === ui.diaId}">${esc(d.nombre)}</button>`).join("") : "";
    if (e) {
      const a = avance(e.paquete.items, e.verificaciones);
      $("#resumen").textContent = `${e.paquete.evento.lugar} · ${a.total} ítems · verificado ${a.ok}/${a.total} (${a.porcentaje}%)` + (a.falta + a.sobra ? ` · ${a.falta + a.sobra} con diferencia` : "");
    }
    const c = $("#contenido");
    c.innerHTML = { backline: pintarBackline, totales: pintarTotales, horario: pintarHorario, importar: pintarImportar, equipo: pintarEquipo }[ui.vista](ui);
    pintarEstado();
  }

  function pintarEstado() {
    const s = sync;
    const [clase, texto] = {
      "conectado": ["ok", "● Conectado al portátil"],
      "sin-conexion": ["falta", "○ Sin conexión: guardando en este celular"],
      "sin-servidor": ["", "Solo este dispositivo"],
      "buscando": ["", "Buscando portátil…"],
    }[s.estado] as [string, string];
    $("#estado").className = `estado ${clase}`;
    $("#estado").textContent = texto + (s.pendientes ? ` · ${s.pendientes} por enviar` : "") + (tienda.autor ? ` · ${tienda.autor}` : "");
  }

  const contenido = $("#contenido");
  conectarBackline(ui, contenido);
  conectarImportar(ui, contenido);
  conectarEquipo(ui, contenido);
  contenido.addEventListener("focusout", () => setTimeout(() => { if (pintarDespues) pintar(); }, 0));
  $("#evento").addEventListener("change", ev => ui.irA((ev.target as HTMLSelectElement).value));
  $("#vistas").addEventListener("click", ev => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-vista]");
    if (b) { ui.vista = b.dataset.vista as Vista; ui.editando = null; pintar(); }
  });
  $("#dias").addEventListener("click", ev => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-dia]");
    if (b) { ui.diaId = b.dataset.dia!; ui.editando = null; pintar(); }
  });
  $("#estado").addEventListener("click", () => { ui.vista = "equipo"; pintar(); });

  tienda.suscribir(() => pintar());
  pintar();
  sync.iniciar();

  // Sin conexión: el service worker guarda la app completa. Los navegadores
  // solo lo permiten en https o en localhost (el portátil del evento).
  if ("serviceWorker" in navigator && isSecureContext && import.meta.env.PROD) {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* sin caché sin conexión, la app sigue */ });
  }
  if (!tienda.autor) ui.aviso("Escribe tu nombre en Equipo para que tus conteos queden firmados.");
}

void iniciar();
