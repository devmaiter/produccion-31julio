/* Backline por día: una ficha por artista con su lista, el conteo en cancha,
 * la edición de ítems, las fotos del montaje y el stage plot. */
import {
  CATEGORIAS, ItemBackline, avance, cantidadEsperada, estadoDe, etiquetaPropietario,
  parsearLista, propietarioDe, referenciaDe, type Categoria, type Verificacion,
} from "../../dominio";
import { fichasDelDia } from "../../datos/consultas";
import { slug } from "../../datos/slug";
import { aleatorio } from "../../sync/tienda";
import type { Ui } from "../contexto";
import { $, esc, minutos, reducirFoto } from "../util";

export function pintarBackline(ui: Ui): string {
  const e = ui.tienda.estado(ui.eventoId);
  if (!e) return "";
  const todas = fichasDelDia(e.paquete, ui.diaId);
  const fotosDe = (artistaId: string) => e.fotos.filter(f => f.artistaId === artistaId && (!f.diaId || f.diaId === ui.diaId));
  const fichas = todas.filter(f => f.itemsPorDia.has(ui.diaId) || f.stagePlot || fotosDe(f.artistaId).length || ui.abiertos.has(f.artistaId));
  const sin = todas.filter(f => !fichas.includes(f));
  if (!todas.length) return `<p>Sin artistas este día. Carga su rider en <b>Importar</b>.</p>`;

  const html = fichas.map(f => {
    const items = f.itemsPorDia.get(ui.diaId) ?? [];
    const bloques = f.bloques.filter(b => b.diaId === ui.diaId).sort((x, y) => minutos(x.inicio) - minutos(y.inicio))
      .map(b => `${b.inicio}–${b.fin} ${esc(b.titulo)}`).join(" · ");
    const a = avance(items, e.verificaciones);
    const fotos = fotosDe(f.artistaId);
    return `<details data-artista="${f.artistaId}" ${ui.abiertos.has(f.artistaId) ? "open" : ""}>
      <summary>${esc(f.nombre)} <small>${bloques}</small> <span class="chip ${a.falta + a.sobra ? "falta" : a.ok === a.total && a.total ? "ok" : ""}">${items.length ? `${a.ok}/${a.total}` : "sin backline"}</span></summary>
      ${items.length ? `<div class="tabla-scroll"><table class="items"><thead><tr><th>Ítem</th><th class="n">Pide</th><th class="n">Hay</th><th class="n">Listo</th><th></th></tr></thead>
        <tbody>${items.map(it => ui.editando === it.id ? filaEdicion(it) : fila(it, e.verificaciones.get(it.id), e.ultimoCambio.get(it.id))).join("")}</tbody></table></div>` : ""}
      <p class="acciones">
        <button data-accion="agregar" data-artista="${f.artistaId}">+ Agregar ítems</button>
        <label class="boton">📷 Foto<input type="file" accept="image/*" capture="environment" data-accion="foto" data-artista="${f.artistaId}" hidden></label>
      </p>
      <div class="agregar" data-para="${f.artistaId}" hidden>
        <textarea placeholder="Un ítem por línea: 2 Snare stand · Platillos: 1 ride · Ampeg SVT Classic"></textarea>
        <button data-accion="agregar-guardar" data-artista="${f.artistaId}">Agregar</button>
      </div>
      ${fotos.length ? `<div class="galeria">${fotos.map(ft => `<button class="miniatura" data-accion="ver-foto" data-foto="${ft.id}"><img src="${ft.dataUrl}" alt="Foto de ${esc(f.nombre)}" loading="lazy"></button>`).join("")}</div>` : ""}
      ${f.stagePlot ? `<p><img class="plot" loading="lazy" src="${esc(f.stagePlot)}" alt="Stage plot de ${esc(f.nombre)}"></p>` : ""}
    </details>`;
  }).join("");
  const nota = sin.length ? `<p><small>Sin backline cargado este día: ${sin.map(f => `<button class="enlace" data-accion="abrir" data-artista="${f.artistaId}">${esc(f.nombre)}</button>`).join(", ")}.</small></p>` : "";
  return html + nota + `<dialog id="visor"><img alt=""><p><button data-accion="borrar-foto">Borrar foto</button> <button data-accion="cerrar-visor">Cerrar</button></p></dialog>`;
}

function fila(it: ItemBackline, v: Verificacion | undefined, cambio?: { quien: string; ts: number }): string {
  const estado = estadoDe(it, v);
  const hace = cambio ? ` · ${esc(cambio.quien)} ${new Date(cambio.ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}` : "";
  return `<tr class="${estado}" data-item="${it.id}">
    <td>${esc(it.descripcion)}${it.porConfirmar ? ` <span class="aviso">confirmar</span>` : ""}${it.chuleadoEnHoja ? ` <span class="chip">✓ hoja</span>` : ""}
      <br><small>${esc(it.categoria)} · ${esc(etiquetaPropietario(it.propietario))}${hace}</small></td>
    <td class="n">${cantidadEsperada(it, v)}</td>
    <td class="n"><input type="number" min="0" inputmode="numeric" value="${v?.contado ?? ""}" data-contado aria-label="Cantidad contada"></td>
    <td class="n"><input type="checkbox" ${v?.listo ? "checked" : ""} data-listo aria-label="Listo"></td>
    <td class="n"><button data-accion="editar" data-item="${it.id}" aria-label="Editar">✎</button></td>
  </tr>`;
}

function filaEdicion(it: ItemBackline): string {
  const prov = it.propietario.tipo === "propio" ? "CN" : it.propietario.tipo === "tercero" ? it.propietario.nombre : "";
  return `<tr class="edicion" data-item="${it.id}"><td colspan="5">
    <label>Descripción <input data-campo="descripcion" value="${esc(it.descripcion)}"></label>
    <label>Cantidad <input data-campo="cantidad" type="number" min="0" inputmode="numeric" value="${it.cantidad}"></label>
    <label>Categoría <select data-campo="categoria">${CATEGORIAS.map(c => `<option ${c === it.categoria ? "selected" : ""}>${c}</option>`).join("")}</select></label>
    <label>Proveedor <input data-campo="proveedor" value="${esc(prov)}" placeholder="CN, OML…"></label>
    <label><input type="checkbox" data-campo="porConfirmar" ${it.porConfirmar ? "checked" : ""}> Confirmar cantidad</label>
    <p><button data-accion="guardar-item" data-item="${it.id}">Guardar</button> <button data-accion="cancelar">Cancelar</button> <button data-accion="borrar-item" data-item="${it.id}" class="peligro">Borrar</button></p>
  </td></tr>`;
}

/** Eventos de la vista (delegados desde #contenido). */
export function conectarBackline(ui: Ui, raiz: HTMLElement): void {
  const estado = () => ui.tienda.estado(ui.eventoId)!;
  const item = (id: string) => estado().paquete.items.find(i => i.id === id);

  raiz.addEventListener("toggle", ev => {
    const d = ev.target as HTMLDetailsElement;
    if (d.tagName !== "DETAILS" || !d.dataset.artista) return;
    if (d.open) ui.abiertos.add(d.dataset.artista); else ui.abiertos.delete(d.dataset.artista);
  }, true);

  raiz.addEventListener("change", async ev => {
    if (ui.vista !== "backline") return;
    const t = ev.target as HTMLInputElement;
    if (t.dataset.accion === "foto" && t.files?.[0]) {
      const archivo = t.files[0];
      t.value = "";
      ui.aviso("Guardando foto…");
      try {
        const dataUrl = await reducirFoto(archivo);
        await ui.tienda.aplicar({ tipo: "foto.agregar", eventoId: ui.eventoId, datos: { id: `f-${aleatorio(12)}`, artistaId: t.dataset.artista!, diaId: ui.diaId, dataUrl, autor: ui.tienda.autor || undefined } });
        ui.aviso("Foto guardada.");
      } catch { ui.aviso("No se pudo leer la foto."); }
      return;
    }
    const tr = t.closest<HTMLTableRowElement>("tr[data-item]");
    if (!tr || tr.classList.contains("edicion")) return;
    const previa = estado().verificaciones.get(tr.dataset.item!);
    const n = $<HTMLInputElement>("[data-contado]", tr).value;
    await ui.tienda.aplicar({ tipo: "verificacion", eventoId: ui.eventoId, datos: {
      ...previa, itemId: tr.dataset.item!, contado: n === "" ? null : Math.max(0, Math.trunc(Number(n))), listo: $<HTMLInputElement>("[data-listo]", tr).checked,
    } });
  });

  raiz.addEventListener("click", async ev => {
    if (ui.vista !== "backline") return;
    const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-accion]");
    if (!b || b.tagName === "INPUT") return;
    const accion = b.dataset.accion;
    if (accion === "editar") { ui.editando = b.dataset.item!; ui.repintar(); }
    if (accion === "cancelar") { ui.editando = null; ui.repintar(); }
    if (accion === "abrir") { ui.abiertos.add(b.dataset.artista!); ui.repintar(); }
    if (accion === "guardar-item") {
      const it = item(b.dataset.item!); if (!it) return;
      const tr = b.closest("tr")!;
      const campo = (c: string) => $<HTMLInputElement>(`[data-campo="${c}"]`, tr);
      const descripcion = campo("descripcion").value.trim();
      if (!descripcion) { ui.aviso("La descripción no puede quedar vacía."); return; }
      const nuevo = ItemBackline.parse({
        ...it, descripcion, referencia: referenciaDe(descripcion),
        cantidad: Math.max(0, Math.trunc(Number(campo("cantidad").value) || 0)),
        categoria: campo("categoria").value as Categoria,
        propietario: propietarioDe(campo("proveedor").value),
        porConfirmar: campo("porConfirmar").checked,
      });
      ui.editando = null;
      await ui.tienda.aplicar({ tipo: "item.guardar", eventoId: ui.eventoId, datos: nuevo });
    }
    if (accion === "borrar-item" && confirm("¿Borrar este ítem?")) {
      ui.editando = null;
      await ui.tienda.aplicar({ tipo: "item.borrar", eventoId: ui.eventoId, datos: { itemId: b.dataset.item! } });
    }
    if (accion === "agregar") {
      const caja = $<HTMLElement>(`.agregar[data-para="${b.dataset.artista}"]`, raiz);
      caja.hidden = !caja.hidden;
      if (!caja.hidden) $<HTMLTextAreaElement>("textarea", caja).focus();
    }
    if (accion === "agregar-guardar") {
      const artistaId = b.dataset.artista!;
      const caja = $<HTMLElement>(`.agregar[data-para="${artistaId}"]`, raiz);
      const nombre = estado().paquete.artistas.find(a => a.id === artistaId)?.nombre ?? "";
      const lineas = parsearLista($<HTMLTextAreaElement>("textarea", caja).value, nombre);
      if (!lineas.length) { ui.aviso("No hay ítems para agregar."); return; }
      await ui.tienda.aplicar(lineas.map(l => ({
        tipo: "item.guardar" as const, eventoId: ui.eventoId,
        datos: ItemBackline.parse({
          id: `${ui.diaId}-${artistaId}-${slug(referenciaDe(l.descripcion)).slice(0, 30)}-${aleatorio(4)}`,
          eventoId: ui.eventoId, diaId: ui.diaId, artistaId, descripcion: l.descripcion, cantidad: l.cantidad,
          categoria: l.categoria, referencia: referenciaDe(l.descripcion), propietario: { tipo: "sin-definir" },
          origen: `agregado a mano${ui.tienda.autor ? ` por ${ui.tienda.autor}` : ""}`,
        }),
      })));
      ui.aviso(`${lineas.length} ítem(s) agregados.`);
    }
    if (accion === "ver-foto") {
      const f = estado().fotos.find(x => x.id === b.dataset.foto);
      const visor = $<HTMLDialogElement>("#visor", raiz);
      if (!f) return;
      $<HTMLImageElement>("img", visor).src = f.dataUrl;
      visor.dataset.foto = f.id;
      visor.showModal();
    }
    if (accion === "cerrar-visor") $<HTMLDialogElement>("#visor", raiz).close();
    if (accion === "borrar-foto" && confirm("¿Borrar esta foto para todo el equipo?")) {
      const visor = $<HTMLDialogElement>("#visor", raiz);
      visor.close();
      await ui.tienda.aplicar({ tipo: "foto.borrar", eventoId: ui.eventoId, datos: { fotoId: visor.dataset.foto! } });
    }
  });
}
