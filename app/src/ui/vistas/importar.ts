/* Importar: correo, PDF, foto o texto → revisión editable → guardar.
 * Todo se lee en el dispositivo (sin internet ni servicios pagos). */
import { CATEGORIAS, type Categoria } from "../../dominio";
import { Extraccion, integrar, interpretar, leerArchivo, type Documento } from "../../lectura";
import { lectoresNavegador } from "../../lectura/navegador";
import { opsDeImportacion } from "../../sync/importacion";
import type { Ui } from "../contexto";
import { $, $$, esc } from "../util";

interface Lectura { ext: Extraccion; destino: string; origen: string; lineas: number }
let lectura: Lectura | null = null;
let resultado: string | null = null;
/** Evento destino elegido en esta pantalla ("" = evento nuevo); null = el evento abierto. */
let destinoElegido: string | null = null;

export function pintarImportar(ui: Ui): string {
  const eventos = ui.tienda.eventos();
  const destino = lectura?.destino ?? destinoElegido ?? ui.eventoId;
  const base = ui.tienda.estado(destino)?.paquete;
  return `<p>Sube lo que llegó de producción: correos (.eml, con sus adjuntos), riders en PDF, fotos de las hojas de backline u horarios, o texto. Se lee en este dispositivo, sin internet. Revisa y corrige antes de guardar.</p>
  <div class="formulario">
    <label>Evento <select id="imp-evento"><option value="">Evento nuevo (según los archivos)</option>${eventos.map(p => `<option value="${p.evento.id}" ${p.evento.id === destino ? "selected" : ""}>${esc(p.evento.nombre)}</option>`).join("")}</select></label>
    <label>Artista <input id="imp-artista" list="imp-artistas" placeholder="Si todo es de una sola banda"><datalist id="imp-artistas">${(base?.artistas ?? []).map(a => `<option value="${esc(a.nombre)}">`).join("")}</datalist></label>
    <label>Día <input id="imp-fecha" type="date"></label>
    <label>Archivos <input type="file" id="imp-archivos" multiple accept=".eml,.pdf,.txt,.csv,image/*,message/rfc822,application/pdf,text/plain"></label>
    <label><small>o pega el texto</small><textarea id="imp-texto" placeholder="Pega aquí el cuerpo del correo o el rider"></textarea></label>
  </div>
  <p><button id="imp-leer">Leer</button> <span id="imp-estado" role="status"></span></p>
  ${resultado ? `<p class="exito">${resultado}</p>` : ""}
  <div id="imp-revision">${lectura ? revision(ui, lectura) : ""}</div>`;
}

function revision(ui: Ui, l: Lectura): string {
  const e = l.ext;
  const opcionesCat = (c: Categoria) => CATEGORIAS.map(x => `<option ${x === c ? "selected" : ""}>${x}</option>`).join("");
  const nuevo = !l.destino;
  return `<h3>Revisión</h3>
  <p><small>${l.lineas} línea(s) leídas de ${esc(l.origen)}. Corrige lo que haga falta y desmarca lo que no se debe cargar.</small></p>
  ${e.avisos.length ? `<ul>${e.avisos.map(a => `<li class="aviso">${esc(a)}</li>`).join("")}</ul>` : ""}
  ${nuevo ? `<div class="formulario">
    <label>Nombre del evento <input id="rev-evento" value="${esc(e.evento?.nombre ?? "")}" placeholder="Ej. Festival Sol de Noche 2026"></label>
    <label>Lugar <input id="rev-lugar" value="${esc(e.evento?.lugar ?? "")}"></label>
    <label>Ciudad <input id="rev-ciudad" value="${esc(e.evento?.ciudad ?? "Bogotá")}"></label>
  </div>` : ""}
  ${e.bloques.length ? `<h4>Horario (${e.bloques.length})</h4><div class="tabla-scroll"><table class="revision"><thead><tr><th></th><th>Día</th><th>Hora</th><th>Artista / título</th><th>Tipo</th></tr></thead><tbody>
    ${e.bloques.map((b, i) => `<tr data-bloque="${i}"><td><input type="checkbox" data-incluir checked aria-label="Incluir"></td><td>${b.fecha}</td><td>${b.inicio}${b.fin ? `–${b.fin}` : ""}</td><td><input data-campo="nombre" value="${esc(b.artista ?? b.titulo)}"></td><td>${b.tipo}</td></tr>`).join("")}
  </tbody></table></div>` : ""}
  ${e.items.length ? `<h4>Backline (${e.items.length})</h4><div class="tabla-scroll"><table class="revision"><thead><tr><th></th><th>Artista</th><th class="n">Cant.</th><th>Ítem</th><th>Categoría</th><th>Proveedor</th><th>Confirmar</th></tr></thead><tbody>
    ${e.items.map((it, i) => `<tr data-item-rev="${i}" class="${it.dudoso ? "dudoso" : ""}"><td><input type="checkbox" data-incluir checked aria-label="Incluir"></td>
      <td><input data-campo="artista" value="${esc(it.artista)}" list="imp-artistas"></td>
      <td class="n"><input data-campo="cantidad" type="number" min="0" inputmode="numeric" value="${it.cantidad}"></td>
      <td><input data-campo="descripcion" value="${esc(it.descripcion)}">${it.nota ? `<br><small class="aviso">${esc(it.nota)}</small>` : ""}</td>
      <td><select data-campo="categoria">${opcionesCat(it.categoria)}</select></td>
      <td><input data-campo="proveedor" value="${esc(it.proveedor ?? "")}" size="8"></td>
      <td class="n"><input type="checkbox" data-campo="dudoso" ${it.dudoso ? "checked" : ""}></td></tr>`).join("")}
  </tbody></table></div>` : ""}
  ${e.items.length || e.bloques.length ? `<p><button id="imp-guardar">Guardar</button> <button id="imp-descartar">Descartar</button></p>` : `<p>No se encontró horario ni backline. Si es el rider de una sola banda, escribe el artista arriba y vuelve a leer.</p>`}`;
}

export function conectarImportar(ui: Ui, raiz: HTMLElement): void {
  raiz.addEventListener("click", async ev => {
    if (ui.vista !== "importar") return;
    const id = (ev.target as HTMLElement).id;
    if (id === "imp-leer") await leer(ui);
    if (id === "imp-descartar") { lectura = null; ui.repintar(); }
    if (id === "imp-guardar") await guardar(ui);
  });
  raiz.addEventListener("change", ev => {
    if (ui.vista === "importar" && (ev.target as HTMLElement).id === "imp-evento") {
      lectura = null; resultado = null;
      destinoElegido = (ev.target as HTMLSelectElement).value;
      ui.repintar();
    }
  });
}

async function leer(ui: Ui): Promise<void> {
  const estado = $("#imp-estado");
  const boton = $<HTMLButtonElement>("#imp-leer");
  const archivos = [...($<HTMLInputElement>("#imp-archivos").files ?? [])];
  const texto = $<HTMLTextAreaElement>("#imp-texto").value;
  if (!archivos.length && !texto.trim()) { estado.textContent = "Elige archivos o pega un texto."; return; }
  const destino = $<HTMLSelectElement>("#imp-evento").value;
  const artista = $<HTMLInputElement>("#imp-artista").value.trim() || undefined;
  const fecha = $<HTMLInputElement>("#imp-fecha").value || undefined;
  boton.disabled = true;
  resultado = null;
  try {
    const lectores = lectoresNavegador();
    const docs: Documento[] = [];
    for (const [i, f] of archivos.entries()) {
      const pesado = f.type.startsWith("image/") ? " (reconociendo texto de la foto, puede tardar)" : "";
      estado.textContent = `Leyendo ${i + 1}/${archivos.length}: ${f.name}${pesado}…`;
      docs.push(...await leerArchivo(f.name, new Uint8Array(await f.arrayBuffer()), f.type, lectores));
    }
    if (texto.trim()) docs.push({ nombre: "texto pegado", tipo: "texto", lineas: texto.split(/\r?\n/).map(t => ({ texto: t })), avisos: [] });
    const base = destino ? ui.tienda.estado(destino)?.paquete ?? null : null;
    lectura = {
      ext: interpretar(docs, { base, artista, fecha }),
      destino, origen: [...archivos.map(f => f.name), ...(texto.trim() ? ["texto pegado"] : [])].join(", "),
      lineas: docs.reduce((n, d) => n + d.lineas.filter(l => l.texto.trim()).length, 0),
    };
    estado.textContent = "";
  } catch (err) {
    estado.textContent = `No se pudo leer: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    boton.disabled = false;
  }
  ui.repintar();
}

async function guardar(ui: Ui): Promise<void> {
  if (!lectura) return;
  const e = structuredClone(lectura.ext);
  const valor = (tr: HTMLElement, c: string) => $<HTMLInputElement>(`[data-campo="${c}"]`, tr);

  // Lo que se corrigió en pantalla.
  const bloques = $$("tr[data-bloque]").flatMap(tr => {
    if (!$<HTMLInputElement>("[data-incluir]", tr).checked) return [];
    const b = e.bloques[+tr.dataset.bloque!]!;
    const nombre = valor(tr, "nombre").value.trim();
    return [b.artista ? { ...b, artista: nombre || b.artista } : { ...b, titulo: nombre || b.titulo }];
  });
  const items = $$("tr[data-item-rev]").flatMap(tr => {
    if (!$<HTMLInputElement>("[data-incluir]", tr).checked) return [];
    const it = e.items[+tr.dataset.itemRev!]!;
    const descripcion = valor(tr, "descripcion").value.trim();
    const artista = valor(tr, "artista").value.trim();
    if (!descripcion || !artista) return [];
    return [{ ...it, artista, descripcion, cantidad: Math.max(0, Math.trunc(Number(valor(tr, "cantidad").value) || 0)),
      categoria: $<HTMLSelectElement>('[data-campo="categoria"]', tr).value as Categoria,
      proveedor: valor(tr, "proveedor").value.trim() || null, dudoso: valor(tr, "dudoso").checked }];
  });
  const artistas = [...new Set([...items.map(i => i.artista), ...bloques.flatMap(b => (b.artista ? [b.artista] : []))])];
  const ext = Extraccion.parse({ ...e, bloques, items, artistas });

  const base = lectura.destino ? ui.tienda.estado(lectura.destino)?.paquete ?? null : null;
  if (!base) {
    const nombre = $<HTMLInputElement>("#rev-evento").value.trim();
    if (!nombre) { $("#imp-estado").textContent = "Escribe el nombre del evento."; return; }
    ext.evento = { nombre, lugar: $<HTMLInputElement>("#rev-lugar").value.trim() || null, ciudad: $<HTMLInputElement>("#rev-ciudad").value.trim() || null, desde: ext.evento?.desde ?? null, hasta: ext.evento?.hasta ?? null };
  }
  try {
    const { paquete, resumen } = integrar(ext, base, lectura.origen);
    if (!base && ui.tienda.estado(paquete.evento.id)) throw new Error(`Ya existe el evento "${paquete.evento.nombre}". Elígelo en la lista de eventos.`);
    await ui.tienda.aplicar(opsDeImportacion(base, paquete, resumen.itemsTocados));
    const r = resumen;
    resultado = `Guardado en ${esc(paquete.evento.nombre)}: ${r.items.nuevos} ítem(s) nuevos, ${r.items.actualizados} actualizados, ${r.bloques.nuevos} bloque(s) de horario, ${r.artistas.nuevos} artista(s) nuevos.`
      + (r.avisos.length > e.avisos.length ? ` Revisa: ${esc(r.avisos.slice(e.avisos.length).join(" · "))}` : "");
    lectura = null;
    destinoElegido = paquete.evento.id;
    ui.irA(paquete.evento.id, "importar");
  } catch (err) {
    $("#imp-estado").textContent = err instanceof Error ? err.message : String(err);
  }
}
