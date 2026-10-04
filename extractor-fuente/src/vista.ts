/* Pinta el estado como listado. Sin framework: strings de HTML y delegación
 * de eventos. Lo editable (cantidad, descripción) escribe directo en la
 * Extraccion, que es lo que se descarga o se integra. */
import type { PaqueteEvento } from "../../lector/src/dominio/entidades";
import type { Extraccion, ImagenPlano, Resumen } from "../../lector/src/lectura";

export type Pestana = "backline" | "tarima" | "canales" | "horario" | "requisitos" | "avisos";

export interface Estado {
  extraccion: Extraccion;
  parciales: Extraccion[];
  planos: Map<string, ImagenPlano>;
  archivos: Array<{ nombre: string; estado: string; clase: string }>;
  base: PaqueteEvento | null;
  pestana: Pestana;
  buscar: string;
  artista: string;
  soloDudosos: boolean;
  integracion: { paquete: PaqueteEvento; resumen: Resumen } | null;
}

export interface Acciones {
  editarItem(indice: number, cambios: Partial<Extraccion["items"][number]>): void;
  borrarItem(indice: number): void;
  urlPlano(archivo: string): string;
}

const h = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ROL: Record<string, string> = { bateria: "batería", percusion: "percusión", bajo: "bajo", guitarra: "guitarra", teclados: "teclados", metales: "metales", cuerdas: "cuerdas", dj: "DJ", voz: "voz", playback: "playback", tecnico: "técnico", otro: "otro" };
const LADO: Record<string, string> = { sr: "SR (der. del músico)", sl: "SL (izq. del músico)", centro: "centro", us: "fondo", ds: "frente" };

let acciones: Acciones | null = null;
let eventosListos = false;

export function render(e: Estado, a: Acciones): void {
  acciones = a;
  if (!eventosListos) { conectar(); eventosListos = true; }

  const progreso = $("progreso");
  progreso.hidden = !e.archivos.length;
  progreso.innerHTML = e.archivos.map(f => `<div class="archivo ${f.clase}"><span>${h(f.nombre)}</span><span class="estado">${h(f.estado)}</span></div>`).join("");

  const hay = e.parciales.length > 0 || e.extraccion.avisos.length > 0;
  $("resumen").hidden = !hay;
  if (!hay) return;

  const x = e.extraccion;
  const dudosos = x.items.filter(i => i.dudoso).length;
  $("contadores").innerHTML = [
    ["Artistas", x.artistas.length, ""],
    ["Ítems de backline", x.items.length, ""],
    ["Por revisar", dudosos, dudosos ? "alerta" : ""],
    ["Zonas", x.zonas.length, ""],
    ["Puestos", x.puestos.length, ""],
    ["Canales", x.canales.length, ""],
    ["Avisos", x.avisos.length, x.avisos.length ? "alerta" : ""],
  ].map(([n, v, c]) => `<div class="contador ${c}"><b>${v}</b><span>${n}</span></div>`).join("");

  const sel = $<HTMLSelectElement>("filtro-artista");
  const opciones = ["", ...x.artistas];
  if (sel.options.length !== opciones.length || [...sel.options].some((o, i) => o.value !== opciones[i])) {
    sel.innerHTML = opciones.map(n => `<option value="${h(n)}">${n ? h(n) : "Todos los artistas"}</option>`).join("");
    sel.value = e.artista;
  }
  $<HTMLButtonElement>("integrar").disabled = !x.items.length && !x.zonas.length && !x.canales.length;
  $<HTMLButtonElement>("integrar").textContent = e.base ? `Integrar a ${e.base.evento.nombre}` : "Integrar como evento nuevo";

  const conteos: Record<Pestana, number> = { backline: x.items.length, tarima: x.zonas.length + x.puestos.length, canales: x.canales.length, horario: x.bloques.length, requisitos: x.requisitos.length, avisos: x.avisos.length };
  for (const b of $("pestanas").querySelectorAll<HTMLButtonElement>("[data-pestana]")) {
    const p = b.dataset.pestana as Pestana;
    b.classList.toggle("activa", p === e.pestana);
    b.innerHTML = `${p[0]!.toUpperCase()}${p.slice(1)}<small>${conteos[p]}</small>`;
  }

  const contenido = $("contenido");
  contenido.innerHTML = (e.integracion ? integracion(e.integracion) : "") + ({
    backline: () => backline(e),
    tarima: () => tarima(e),
    canales: () => canales(e),
    horario: () => horario(e),
    requisitos: () => requisitos(e),
    avisos: () => avisos(e),
  })[e.pestana]();
}

/* ---- Filtro común -------------------------------------------------------- */
function pasa(e: Estado, artista: string, ...textos: Array<string | null | undefined>): boolean {
  if (e.artista && artista !== e.artista) return false;
  if (!e.buscar) return true;
  const q = e.buscar.toLowerCase();
  return [artista, ...textos].some(t => (t ?? "").toLowerCase().includes(q));
}

/* ---- Backline ------------------------------------------------------------ */
function backline(e: Estado): string {
  const filas = e.extraccion.items.map((it, i) => ({ it, i })).filter(({ it }) => pasa(e, it.artista, it.descripcion, it.grupo, it.categoria, it.proveedor, it.nota) && (!e.soloDudosos || it.dudoso));
  if (!filas.length) return `<p class="vacio">${e.extraccion.items.length ? "Nada coincide con el filtro." : "Todavía no hay backline: suelta un rider, un correo o el desglose."}</p>`;
  const porArtista = agrupar(filas, f => f.it.artista);
  let html = "";
  for (const [artista, suyas] of porArtista) {
    const total = suyas.filter(f => !f.it.dudoso).reduce((s, f) => s + f.it.cantidad, 0);
    html += `<h2>${h(artista)} <small class="grupo">${suyas.length} ítems · ${total} unidades firmes</small></h2>`;
    html += `<table><thead><tr><th>Cant.</th><th>Ítem</th><th>Grupo</th><th>Categoría</th><th>Quién lo pone</th><th></th></tr></thead><tbody>`;
    for (const { it, i } of suyas) {
      const alternativa = /alternativa/.test(it.nota ?? "");
      html += `<tr class="${it.dudoso ? "dudoso" : ""} ${alternativa ? "alternativa" : ""}" data-i="${i}">
        <td class="num"><input type="number" min="0" value="${it.cantidad}" data-campo="cantidad" data-i="${i}"></td>
        <td><span contenteditable="true" spellcheck="false" data-campo="descripcion" data-i="${i}">${h(it.descripcion)}</span>${it.dudoso ? `<span class="etiqueta duda">revisar</span>` : ""}${it.nota ? `<span class="nota">${h(it.nota)}</span>` : ""}</td>
        <td class="grupo">${h(it.grupo ?? "")}</td>
        <td>${h(it.categoria)}</td>
        <td>${it.proveedor === "ARTISTA" ? `<span class="etiqueta artista">lo trae la banda</span>` : h(it.proveedor ?? "producción")}</td>
        <td><button class="borrar" title="Quitar" data-borrar="${i}">×</button></td>
      </tr>`;
    }
    html += "</tbody></table>";
  }
  return html;
}

/* ---- Tarima -------------------------------------------------------------- */
function tarima(e: Estado): string {
  const x = e.extraccion;
  const artistas = x.artistas.filter(a => !e.artista || a === e.artista).filter(a => x.zonas.some(z => z.artista === a) || x.puestos.some(p => p.artista === a) || x.planos.some(p => p.artista === a));
  if (!artistas.length) return `<p class="vacio">Sin tarima todavía. El desglose de producción trae risers, IO list y planos; de ahí salen las zonas y los puestos.</p>`;
  let html = "";
  for (const a of artistas) {
    const zonas = x.zonas.filter(z => z.artista === a), puestos = x.puestos.filter(p => p.artista === a), planos = x.planos.filter(p => p.artista === a);
    if (!pasa(e, a, ...zonas.map(z => z.nombre), ...puestos.map(p => p.nombre))) continue;
    html += `<h2>${h(a)}</h2>`;
    for (const p of planos) {
      html += `<div class="plano"><img src="${h(acciones!.urlPlano(p.archivo))}" alt="Stage plot de ${h(a)}">`;
      for (const z of zonas.filter(z => z.x !== null && z.y !== null)) html += `<span class="marca zona" style="left:${z.x! * 100}%;top:${z.y! * 100}%">${h(z.nombre)}</span>`;
      for (const q of puestos.filter(q => q.x !== null && q.y !== null)) html += `<span class="marca ${q.dudoso ? "duda" : ""}" style="left:${q.x! * 100}%;top:${q.y! * 100}%" title="${h(q.nota ?? "")}">${h(q.nombre)}</span>`;
      html += `</div><p class="mini">Los marcadores los propuso el OCR del plano; en la app se arrastran y confirman a mano.</p>`;
    }
    if (zonas.length) {
      html += `<h3>Zonas (risers y áreas)</h3><table><thead><tr><th>Zona</th><th>Tipo</th><th>Medidas (m)</th><th>Cant.</th><th>Ruedas</th><th>Dónde</th><th>Nota</th></tr></thead><tbody>`;
      for (const z of zonas) {
        const med = z.ancho !== null ? `${z.ancho} × ${z.fondo ?? "?"}${z.alto !== null ? ` × ${z.alto} alto` : ""}` : "";
        html += `<tr class="${z.dudoso ? "dudoso" : ""}"><td>${h(z.nombre)}</td><td>${z.tipo}</td><td>${med}</td><td class="num">${z.cantidad}</td><td>${z.ruedas === null ? "" : z.ruedas ? "sí" : "no"}</td><td>${[z.lado, z.profundidad].filter(Boolean).map(l => LADO[l!] ?? l).join(", ")}</td><td class="grupo">${h(z.nota ?? "")}</td></tr>`;
      }
      html += "</tbody></table>";
    }
    if (puestos.length) {
      html += `<h3>Puestos (quién está dónde)</h3><table><thead><tr><th>Puesto</th><th>Rol</th><th>Corriente</th><th>Monitor</th><th>Canales que lo captan</th><th>Nota</th></tr></thead><tbody>`;
      for (const p of puestos) {
        const canales = x.canales.filter(c => c.artista === a && c.tipo === "entrada" && cazaRol(c.instrumento, p.rol)).slice(0, 8).map(c => c.numero).join(", ");
        html += `<tr class="${p.dudoso ? "dudoso" : ""}"><td>${h(p.nombre)}</td><td>${ROL[p.rol] ?? p.rol}</td><td>${h(p.corriente ?? "")}</td><td>${h(p.monitor ?? "")}</td><td class="grupo">${canales}</td><td class="grupo">${h(p.nota ?? "")}</td></tr>`;
      }
      html += "</tbody></table>";
    }
  }
  return html || `<p class="vacio">Nada coincide con el filtro.</p>`;
}

const PISTAS_ROL: Record<string, RegExp> = {
  bateria: /kick|snare|sn\b|tom|hh|hi ?hat|oh|ride|drum|bombo|redoblante/i,
  percusion: /conga|bongo|timbal|tumba|perc|cajon|shaker|guiro|campana|bell|toys|tambor/i,
  bajo: /bass|bajo/i, guitarra: /gtr|guit|acoustic/i, teclados: /key|piano|nord|synth|wurli|rhodes|organ/i,
  metales: /trump|trb|tromb|sax|horn|flauta|clarinet/i, cuerdas: /violin|viola|cello|strings/i, dj: /dj|cdj|track/i,
  voz: /vox|voz|voc|lead|coro|bgv/i, playback: /playback|track|pb|laptop|seq/i, tecnico: /talk|tb|tech/i, otro: /$^/,
};
const cazaRol = (instrumento: string, rol: string) => PISTAS_ROL[rol]?.test(instrumento) ?? false;

/* ---- Canales ------------------------------------------------------------- */
function canales(e: Estado): string {
  const lista = e.extraccion.canales.filter(c => pasa(e, c.artista, c.instrumento, c.microfono, c.ubicacion, c.snake, c.numero));
  if (!lista.length) return `<p class="vacio">${e.extraccion.canales.length ? "Nada coincide con el filtro." : "Sin canales: vienen del IO List del desglose."}</p>`;
  let html = "";
  for (const [artista, suyos] of agrupar(lista, c => c.artista)) {
    const entradas = suyos.filter(c => c.tipo === "entrada"), salidas = suyos.filter(c => c.tipo === "salida");
    html += `<h2>${h(artista)} <small class="grupo">${entradas.length} entradas · ${salidas.length} salidas</small></h2>`;
    html += `<table><thead><tr><th>Ch</th><th>Instrumento</th><th>Micrófono / tipo</th><th>Base</th><th>Ubicación</th><th>Snake</th><th>Nota</th></tr></thead><tbody>`;
    for (const c of suyos) html += `<tr><td class="num">${c.tipo === "salida" ? "out " : ""}${h(c.numero)}</td><td>${h(c.instrumento)}</td><td>${h(c.microfono ?? "")}</td><td>${h(c.base ?? "")}</td><td>${h(c.ubicacion ?? "")}</td><td class="grupo">${h(c.snake ?? "")}</td><td class="grupo">${h(c.nota ?? "")}</td></tr>`;
    html += "</tbody></table>";
  }
  return html;
}

/* ---- Horario ------------------------------------------------------------- */
function horario(e: Estado): string {
  const x = e.extraccion;
  const bloques = x.bloques.filter(b => pasa(e, b.artista ?? "", b.titulo, b.escenario, b.fecha));
  if (!x.dias.length && !bloques.length) return `<p class="vacio">Sin horario: sale de los correos y PDF de programación.</p>`;
  let html = x.evento ? `<p><b>${h(x.evento.nombre)}</b>${x.evento.desde ? ` · ${x.evento.desde}${x.evento.hasta && x.evento.hasta !== x.evento.desde ? ` a ${x.evento.hasta}` : ""}` : ""}${x.escenarios.length ? ` · ${x.escenarios.map(h).join(", ")}` : ""}</p>` : "";
  for (const d of x.dias) {
    const del = bloques.filter(b => b.fecha === d.fecha).sort((a, b) => a.inicio.localeCompare(b.inicio));
    html += `<h2>${h(d.nombre)} <small class="grupo">${d.fecha} · ${d.tipo}</small></h2>`;
    if (!del.length) { html += `<p class="mini">Sin bloques de horario ese día.</p>`; continue; }
    html += `<table><thead><tr><th>Hora</th><th>Qué</th><th>Artista</th><th>Escenario</th></tr></thead><tbody>`;
    for (const b of del) html += `<tr><td class="num">${b.inicio}${b.fin ? `–${b.fin}` : ""}</td><td>${h(b.titulo)}</td><td>${h(b.artista ?? "")}</td><td class="grupo">${h(b.escenario ?? "")}</td></tr>`;
    html += "</tbody></table>";
  }
  return html;
}

/* ---- Requisitos y avisos ------------------------------------------------- */
function requisitos(e: Estado): string {
  const lista = e.extraccion.requisitos.filter(r => pasa(e, r.artista, r.texto, r.tema));
  if (!lista.length) return `<p class="vacio">Sin requisitos: power, crew y notas del rider aparecen aquí.</p>`;
  let html = `<div class="tarjetas">`;
  for (const r of lista) html += `<div class="tarjeta"><h3>${h(r.artista)} <span class="etiqueta">${h(r.tema)}</span></h3><div style="white-space:pre-wrap;font-size:.9rem">${h(r.texto)}</div></div>`;
  return html + "</div>";
}

function avisos(e: Estado): string {
  const lista = e.extraccion.avisos.filter(a => !e.buscar || a.toLowerCase().includes(e.buscar.toLowerCase())).filter(a => !e.artista || a.includes(e.artista));
  if (!lista.length) return `<p class="vacio">Sin avisos: todo lo leído se entendió.</p>`;
  return `<p class="mini">Lo que el lector no entendió o que no cuadra entre fuentes. No se inventa nada: esto lo confirma una persona.</p><ul class="avisos">${lista.map(a => `<li>${h(a)}</li>`).join("")}</ul>`;
}

function integracion({ paquete, resumen }: { paquete: PaqueteEvento; resumen: Resumen }): string {
  const c = (n: string, k: { nuevos: number; actualizados: number; iguales: number }) => k.nuevos + k.actualizados + k.iguales ? `<li><b>${n}</b>: ${k.nuevos} nuevos, ${k.actualizados} actualizados, ${k.iguales} ya estaban</li>` : "";
  return `<div class="integracion"><b>Integrado en ${h(paquete.evento.nombre)}</b> (${resumen.evento.nuevo ? "evento nuevo" : "evento existente"}). El JSON descargable ahora trae el evento completo con ids.
    <ul class="avisos">${c("Artistas", resumen.artistas)}${c("Ítems", resumen.items)}${c("Zonas", resumen.zonas)}${c("Puestos", resumen.puestos)}${c("Canales", resumen.canales)}${c("Requisitos", resumen.requisitos)}${c("Horario", resumen.bloques)}</ul></div>`;
}

/* ---- Utilidades ---------------------------------------------------------- */
function agrupar<T>(lista: T[], clave: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of lista) { const k = clave(t); (m.get(k) ?? m.set(k, []).get(k)!).push(t); }
  return m;
}

function conectar(): void {
  const contenido = $("contenido");
  contenido.addEventListener("change", ev => {
    const el = ev.target as HTMLInputElement;
    if (el.dataset.campo === "cantidad") acciones?.editarItem(Number(el.dataset.i), { cantidad: Math.max(0, Math.round(Number(el.value) || 0)) });
  });
  contenido.addEventListener("input", ev => {
    const el = ev.target as HTMLElement;
    if (el.dataset.campo === "descripcion") acciones?.editarItem(Number(el.dataset.i), { descripcion: el.textContent?.trim() ?? "" });
  });
  contenido.addEventListener("keydown", ev => {
    if ((ev.target as HTMLElement).dataset.campo === "descripcion" && ev.key === "Enter") { ev.preventDefault(); (ev.target as HTMLElement).blur(); }
  });
  contenido.addEventListener("click", ev => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-borrar]");
    if (b) acciones?.borrarItem(Number(b.dataset.borrar));
  });
}
