/* Extractor de backline: la página recibe documentos y el lector (../lector)
 * los convierte en la Extraccion que ve el usuario como listado. Todo corre
 * en el navegador: pdfjs para PDF, Tesseract para fotos y planos, exceljs
 * para el desglose. Sin internet ni servicios pagos. */
import pdfWorker from "../../lector/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PaqueteEvento } from "../../lector/src/dominio/entidades";
import { extraccionVacia, integrar, interpretar, leerArchivo, leerDesglose, unirExtracciones, type Extraccion, type ImagenPlano, type Resumen } from "../../lector/src/lectura";
import { lectoresNavegador } from "../../lector/src/lectura/navegador";
import { lineasDeTexto } from "../../lector/src/lectura/documento";
import { render, type Estado, type Pestana } from "./vista";

const EVENTOS: Array<{ id: string; nombre: string }> = [
  { id: "cordillera-2026", nombre: "Cordillera 2026" },
  { id: "simon-bolivar-2026", nombre: "Simón Bolívar 2026" },
  { id: "vallenato-al-parque-2026", nombre: "Vallenato al Parque 2026" },
];

const lectores = lectoresNavegador({ pdfWorker, ocr: "ocr/" });
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const estado: Estado = {
  extraccion: extraccionVacia(),
  parciales: [],
  planos: new Map(),
  archivos: [],
  base: null,
  pestana: "backline",
  buscar: "",
  artista: "",
  soloDudosos: false,
  integracion: null,
};

/* ---- Evento base ---------------------------------------------------- */
const selEvento = $<HTMLSelectElement>("evento");
for (const e of EVENTOS) selEvento.append(new Option(e.nombre, e.id));
selEvento.addEventListener("change", () => void cargarEvento(selEvento.value));

async function cargarEvento(id: string): Promise<void> {
  if (!id) { estado.base = null; pintar(); return; }
  try {
    const r = await fetch(`data/${id}.json`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    estado.base = PaqueteEvento.parse(await r.json());
  } catch (err) {
    estado.base = null;
    selEvento.value = "";
    avisar(`No pude cargar el evento ${id}: ${mensaje(err)}`);
  }
  pintar();
}

/* ---- Entrada de archivos --------------------------------------------- */
const zona = $("zona"), input = $<HTMLInputElement>("archivos");
$("elegir").addEventListener("click", () => input.click());
zona.addEventListener("click", ev => { if (ev.target === zona || (ev.target as HTMLElement).tagName === "P") input.click(); });
input.addEventListener("change", () => { void leerArchivos([...(input.files ?? [])]); input.value = ""; });
for (const ev of ["dragenter", "dragover"]) zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add("encima"); });
for (const ev of ["dragleave", "drop"]) zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove("encima"); });
zona.addEventListener("drop", e => void leerArchivos([...(e.dataTransfer?.files ?? [])]));
document.addEventListener("paste", e => {
  const archivos = [...(e.clipboardData?.files ?? [])];
  if (archivos.length) { e.preventDefault(); void leerArchivos(archivos); }
});

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-muestra]")) {
  b.addEventListener("click", async () => {
    const evento = b.dataset.evento;
    if (evento && selEvento.value !== evento) { selEvento.value = evento; await cargarEvento(evento); }
    const ruta = b.dataset.muestra!;
    const r = await fetch(ruta);
    if (!r.ok) { avisar(`No encontré la muestra ${ruta}.`); return; }
    const nombre = ruta.split("/").pop()!;
    await leerArchivos([new File([await r.blob()], nombre)]);
  });
}

$("pegar").addEventListener("click", () => { const p = $("pegado"); p.hidden = !p.hidden; if (!p.hidden) $("texto").focus(); });
$("leer-texto").addEventListener("click", () => {
  const t = $<HTMLTextAreaElement>("texto").value.trim();
  if (!t) return;
  const artista = $<HTMLInputElement>("texto-artista").value.trim() || undefined;
  const nombre = `texto pegado ${estado.archivos.length + 1}`;
  const a = registrarArchivo(nombre);
  const e = interpretar([{ nombre, tipo: "texto", lineas: lineasDeTexto(t), avisos: [] }], { base: estado.base, artista });
  agregar(e, a, `${e.items.length} ítem(s)`);
  $<HTMLTextAreaElement>("texto").value = "";
});

async function leerArchivos(archivos: File[]): Promise<void> {
  for (const f of archivos) {
    const a = registrarArchivo(f.name);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (/\.xlsx$/i.test(f.name)) {
        a.estado = "leyendo hojas, planos con OCR…"; pintar();
        const d = await leerDesglose(bytes, f.name, { base: estado.base, lectores });
        for (const im of d.imagenes) estado.planos.set(im.archivo, im);
        agregar(d.extraccion, a, `${d.extraccion.items.length} ítems · ${d.extraccion.zonas.length} zonas · ${d.extraccion.canales.length} canales · ${d.extraccion.planos.length} planos`);
      } else {
        a.estado = /\.(jpe?g|png|webp)$/i.test(f.name) ? "leyendo con OCR (la primera vez carga el motor)…" : "leyendo…"; pintar();
        const docs = await leerArchivo(f.name, bytes, f.type, lectores);
        const e = interpretar(docs, { base: estado.base });
        agregar(e, a, `${e.items.length} ítem(s) · ${e.bloques.length} bloque(s) de horario`);
      }
    } catch (err) {
      a.estado = `error: ${mensaje(err)}`; a.clase = "error"; pintar();
    }
  }
}

function registrarArchivo(nombre: string) {
  const a = { nombre, estado: "en cola", clase: "" };
  estado.archivos.push(a);
  pintar();
  return a;
}

function agregar(e: Extraccion, a: Estado["archivos"][number], resumen: string): void {
  estado.parciales.push(e);
  estado.extraccion = unirExtracciones(estado.parciales);
  estado.integracion = null;
  a.estado = resumen; a.clase = "listo";
  pintar();
}

function avisar(texto: string): void {
  estado.extraccion.avisos.push(texto);
  pintar();
}

/* ---- Filtros, pestañas y acciones ------------------------------------ */
$<HTMLInputElement>("buscar").addEventListener("input", e => { estado.buscar = (e.target as HTMLInputElement).value; pintar(); });
$<HTMLSelectElement>("filtro-artista").addEventListener("change", e => { estado.artista = (e.target as HTMLSelectElement).value; pintar(); });
$<HTMLInputElement>("solo-dudosos").addEventListener("change", e => { estado.soloDudosos = (e.target as HTMLInputElement).checked; pintar(); });
$("pestanas").addEventListener("click", e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-pestana]");
  if (!b) return;
  estado.pestana = b.dataset.pestana as Pestana;
  pintar();
});
$("limpiar").addEventListener("click", () => {
  estado.parciales = []; estado.extraccion = extraccionVacia(); estado.planos.clear(); estado.archivos = []; estado.integracion = null;
  pintar();
});
$("descargar").addEventListener("click", () => {
  const datos = estado.integracion ? { extraccion: estado.extraccion, paquete: estado.integracion.paquete, resumen: estado.integracion.resumen } : estado.extraccion;
  const nombre = estado.integracion ? `${estado.integracion.paquete.evento.id}.json` : "extraccion.json";
  const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 1)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("integrar").addEventListener("click", () => {
  try {
    const origen = estado.archivos.map(a => a.nombre).join(", ");
    const { paquete, resumen } = integrar(estado.extraccion, estado.base, origen);
    estado.integracion = { paquete, resumen };
  } catch (err) {
    avisar(`No se pudo integrar: ${mensaje(err)}`);
  }
  pintar();
});

/* ---- Pintar ----------------------------------------------------------- */
function pintar(): void {
  render(estado, {
    editarItem(i, cambios) { Object.assign(estado.extraccion.items[i]!, cambios); estado.integracion = null; },
    borrarItem(i) { estado.extraccion.items.splice(i, 1); estado.integracion = null; pintar(); },
    urlPlano(archivo) {
      const im = estado.planos.get(archivo);
      if (im) return urlDe(im);
      return `data/${archivo}`; // plano de un evento ya guardado
    },
  });
}

const urls = new WeakMap<ImagenPlano, string>();
function urlDe(im: ImagenPlano): string {
  let u = urls.get(im);
  if (!u) { u = URL.createObjectURL(new Blob([im.bytes as BlobPart], { type: im.extension === "png" ? "image/png" : "image/jpeg" })); urls.set(im, u); }
  return u;
}

const mensaje = (err: unknown) => (err instanceof Error ? err.message : String(err));

export type { Resumen };
pintar();
