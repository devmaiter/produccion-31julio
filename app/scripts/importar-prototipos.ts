/* Importa los datos de los dos prototipos al modelo nuevo (data/*.json).
 *
 *   npm run importar -- [ruta/index.html] [ruta/backline-esc2.html]
 *
 * Por defecto lee la hoja de producción de este repo (../index.html) y la
 * lista de Cordillera desde un clon hermano de devmaiter/cordillera.
 * Cada paquete se valida con zod antes de escribirse: si un dato no cumple
 * el modelo, el import falla y dice cuál.
 *
 * Los prototipos guardan sus datos como constantes JS dentro del HTML; aquí
 * se recorta ese bloque y se evalúa en un contexto aislado (node:vm).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import {
  PaqueteEvento, categorizar, propietarioDe, referenciaDe,
  type Artista, type Bloque, type Dia, type Escenario, type ItemBacklineEntrada, type StagePlot,
} from "../src/dominio";
import { slug } from "../src/datos/slug";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUTA_PRODUCCION = resolve(process.argv[2] ?? join(RAIZ, "..", "index.html"));
const RUTA_CORDILLERA = resolve(process.argv[3] ?? join(RAIZ, "..", "..", "cordillera", "backline-esc2.html"));

type Legado = any;

function evaluar(html: string, desde: string, hasta: string, nombres: string[]): Record<string, Legado> {
  const i = html.indexOf(desde), j = html.indexOf(hasta, i);
  if (i < 0 || j < 0) throw new Error(`No se encontró el bloque de datos (${desde} … ${hasta})`);
  const codigo = `${html.slice(i, j)}\n;({${nombres.join(",")}})`;
  return vm.runInNewContext(codigo, {}, { timeout: 5000 });
}

function guardarImagen(dataUri: string, relativa: string): string {
  const m = dataUri.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
  if (!m) throw new Error(`Imagen no reconocida para ${relativa}`);
  const archivo = `${relativa}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
  const destino = join(RAIZ, "public", archivo);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, Buffer.from(m[2]!, "base64"));
  return archivo;
}

function escribir(paquete: PaqueteEvento): void {
  const ok = PaqueteEvento.parse(paquete);
  const ruta = join(RAIZ, "data", `${ok.evento.id}.json`);
  writeFileSync(ruta, JSON.stringify(ok, null, 1) + "\n");
  console.log(`✓ ${ok.evento.nombre}: ${ok.dias.length} días, ${ok.artistas.length} artistas, ${ok.bloques.length} bloques, ${ok.items.length} ítems, ${ok.stagePlots.length} stage plots`);
}

/** "9:00 – 9:45" → ["09:00", "09:45"]. Sin fin → el mismo inicio. */
function rango(texto: string): [string, string] {
  const [a, b] = texto.split(/\s*[–-]\s*/).map(h => h.trim().padStart(5, "0"));
  return [a!, b ?? a!];
}

function registrarArtista(mapa: Map<string, Artista>, nombre: string): string {
  const id = slug(nombre);
  if (!mapa.has(id)) mapa.set(id, { id, nombre });
  return id;
}

/* ------------------------------------------------------------------------ */
/* Cordillera 2026 · lista de chequeo del ESC 2                              */
/* ------------------------------------------------------------------------ */
function importarCordillera(): void {
  const html = readFileSync(RUTA_CORDILLERA, "utf8");
  const { DAYS, PLOTS, STAGES, SHOWS, PROD } = evaluar(html, "const DAYS = [", "// ---------- REFERENCIAS", ["DAYS", "PLOTS", "STAGES", "SHOWS", "PROD"]);
  const eventoId = "cordillera-2026";

  const escenarios: Escenario[] = (STAGES as Legado[]).map(s => ({ id: slug(s.short), eventoId, nombre: s.name }));
  const escenarioDe = new Map<string, string>((STAGES as Legado[]).map(s => [s.id, slug(s.short)]));

  const dias: Dia[] = [
    { id: "cordillera-vie-11", eventoId, fecha: "2026-09-11", nombre: "Viernes 11 · Pruebas", tipo: "pruebas" },
    { id: "cordillera-sab-12", eventoId, fecha: "2026-09-12", nombre: "Sábado 12", tipo: "show" },
    { id: "cordillera-dom-13", eventoId, fecha: "2026-09-13", nombre: "Domingo 13", tipo: "show" },
  ];
  const diaPorFecha = new Map(dias.map(d => [d.fecha, d.id]));
  const diaDeLista: Record<string, string> = { d1: "cordillera-sab-12", d2: "cordillera-dom-13" };

  const artistas = new Map<string, Artista>();
  const items: ItemBacklineEntrada[] = [];
  const stagePlots: StagePlot[] = [];
  const idLegado = new Map<string, string>();

  for (const d of DAYS as Legado[]) {
    const diaId = diaDeLista[d.id];
    if (!diaId) throw new Error(`Día desconocido en Cordillera: ${d.id}`);
    for (const a of d.artists as Legado[]) {
      const artistaId = registrarArtista(artistas, a.name);
      idLegado.set(a.id, artistaId);
      let grupo: string | undefined;
      (a.rows as Legado[]).forEach((row, r) => {
        if (row[0] === "g") { grupo = row[1]; return; }
        const [, descripcion, cantidad, obs, flags = {}] = row;
        const porDesc = categorizar(descripcion);
        items.push({
          id: `${diaId}-${artistaId}-${r}`,
          eventoId, diaId, artistaId, grupo, descripcion, cantidad,
          categoria: porDesc !== "Otro" || !grupo ? porDesc : categorizar(grupo),
          referencia: referenciaDe(descripcion),
          propietario: propietarioDe(obs),
          observacion: [obs, flags.n].filter(Boolean).join(" · ") || undefined,
          porConfirmar: !!flags.v,
          chuleadoEnHoja: !!flags.c,
        });
      });
    }
  }

  for (const [legado, plot] of Object.entries(PLOTS as Record<string, Legado>)) {
    const artistaId = idLegado.get(legado);
    if (!artistaId) throw new Error(`Stage plot sin artista: ${legado}`);
    stagePlots.push({ artistaId, eventoId, archivo: guardarImagen(plot.src, `stage-plots/${eventoId}/${artistaId}`) });
  }

  const bloques: Bloque[] = [];
  for (const sh of SHOWS as Legado[]) {
    const diaId = diaPorFecha.get(sh.date)!;
    for (const s of sh.slots as Legado[]) {
      const artistaId = registrarArtista(artistas, s.name);
      bloques.push({ id: `${diaId}-${artistaId}-show`, diaId, escenarioId: escenarioDe.get(s.st)!, artistaId, titulo: "Show", tipo: "show", inicio: s.s, fin: s.e });
    }
  }
  const tipoProd = (e: Legado): Bloque["tipo"] => {
    if (e.k === "mark") return "marca";
    if (e.k === "turn") return "cambio";
    if (e.k === "show") return "show";
    const t = String(e.t).toLowerCase();
    if (t.includes("linecheck")) return "linecheck";
    if (t.includes("soundcheck")) return "soundcheck";
    if (t.includes("load in")) return "load-in";
    return "montaje";
  };
  for (const d of PROD as Legado[]) {
    const diaId = diaPorFecha.get(d.date)!;
    (d.ev as Legado[]).forEach((e, n) => {
      const tipo = tipoProd(e);
      // El show ya viene del cartel; la hoja de producción lo repite.
      if (tipo === "show" && bloques.some(b => b.diaId === diaId && b.tipo === "show" && b.artistaId === slug(e.name) && b.inicio === e.s)) return;
      const sinArtista = tipo === "marca" || (tipo === "cambio" && /changeover|cambio/i.test(e.name));
      const artistaId = sinArtista ? undefined : registrarArtista(artistas, e.name);
      bloques.push({
        id: `${diaId}-p${n}`, diaId, escenarioId: escenarioDe.get(e.st)!, artistaId,
        titulo: (sinArtista ? e.name : `${e.t || e.name}${e.side === "off" ? " (off stage)" : ""}`) || tipo,
        tipo, inicio: e.s, fin: e.e,
      });
    });
  }

  escribir(PaqueteEvento.parse({
    evento: { id: eventoId, nombre: "Cordillera 2026", lugar: "Parque Simón Bolívar", ciudad: "Bogotá", desde: "2026-09-11", hasta: "2026-09-13" },
    escenarios, dias, artistas: [...artistas.values()], bloques, items, stagePlots,
  }));
}

/* ------------------------------------------------------------------------ */
/* Hoja de producción · Simón Bolívar (jul–ago) y Vallenato al Parque (ago)  */
/* ------------------------------------------------------------------------ */

/* El backline de estas bandas vive en Firestore (se edita en vivo). Lo único
   que quedó escrito en el HTML es la lista de One 4 All de la versión estática
   del 31 de julio, antes de pasar a Firestore. */
const ITEMS_ESTATICOS: Record<string, Array<[string, string]>> = {
  "one-4-all": [
    ["Batería", "Batería Yamaha"],
    ["Platillos", "Set de platillos: 1 ride, 2 crash, 1 splash y hi-hat"],
    ["Bases", "4 bases de platillo (ride, 2 crash, splash)"],
    ["Teclado", "Yamaha Montage 8"],
    ["Bases", "2 bases de teclado"],
    ["Ampli bajo", "Amplificador de bajo"],
    ["Percusión", "Congas con base y timbal"],
  ],
};

function importarProduccion(): void {
  const html = readFileSync(RUTA_PRODUCCION, "utf8");
  const { DAYS } = evaluar(html, "const BANDS = [", "const $ = ", ["DAYS"]);

  const eventos = [
    { evento: { id: "simon-bolivar-2026", nombre: "Parque Simón Bolívar · julio–agosto 2026", lugar: "Parque Simón Bolívar", ciudad: "Bogotá", desde: "2026-07-31", hasta: "2026-08-02" },
      dias: { "viernes-31": ["2026-07-31", "show"], "sabado-1": ["2026-08-01", "show"], "domingo-2": ["2026-08-02", "show"] } },
    { evento: { id: "vallenato-al-parque-2026", nombre: "Vallenato al Parque 2026", lugar: "Parque Simón Bolívar", ciudad: "Bogotá", desde: "2026-08-21", hasta: "2026-08-23" },
      dias: { "vallenato-21": ["2026-08-21", "pruebas"], "vallenato-22": ["2026-08-22", "show"], "vallenato-23": ["2026-08-23", "show"] } },
  ] as const;

  for (const { evento, dias: mapaDias } of eventos) {
    const eventoId = evento.id;
    const escenarioId = "principal";
    const artistas = new Map<string, Artista>();
    const dias: Dia[] = [];
    const bloques: Bloque[] = [];
    const items: ItemBacklineEntrada[] = [];
    const stagePlots: StagePlot[] = [];

    for (const d of DAYS as Legado[]) {
      const entrada = (mapaDias as Record<string, readonly [string, "show" | "pruebas"]>)[d.id];
      if (!entrada) continue;
      const [fecha, tipoDia] = entrada;
      const diaId = d.id;
      dias.push({ id: diaId, eventoId, fecha, nombre: String(d.tab), tipo: tipoDia });

      // Artistas: por nombre, para que el mismo artista en dos días sea uno solo.
      const porIdLegado = new Map<string, string>();
      for (const b of d.bands as Legado[]) {
        const nombre = String(b.name).replace(/^Aviva Band · /, "");
        const artistaId = registrarArtista(artistas, nombre);
        porIdLegado.set(b.id, artistaId);
        if (b.plot && !stagePlots.some(p => p.artistaId === artistaId)) {
          stagePlots.push({ artistaId, eventoId, archivo: guardarImagen(b.plot, `stage-plots/${eventoId}/${artistaId}`), descripcion: b.plotAlt });
        }
      }

      let enPruebas = tipoDia === "pruebas";
      (d.sched as Legado[]).forEach((s, n) => {
        if (s.t === "section") { enPruebas = /prueba/i.test(s.name); return; }
        const [inicio, fin] = rango(s.time);
        const id = `${diaId}-b${n}`;
        if (s.t === "band") {
          const artistaId = (s.id && porIdLegado.get(s.id)) || registrarArtista(artistas, String(s.name).replace(/^Aviva Band · /, ""));
          bloques.push({ id, diaId, escenarioId, artistaId, titulo: enPruebas ? "Prueba de sonido" : "Show", tipo: enPruebas ? "soundcheck" : "show", inicio, fin });
        } else {
          bloques.push({ id, diaId, escenarioId, titulo: s.name, tipo: s.t === "pause" ? "cambio" : "marca", inicio, fin });
        }
      });
    }

    for (const [artistaId, lista] of Object.entries(ITEMS_ESTATICOS)) {
      if (!artistas.has(artistaId)) continue;
      const diaId = dias[0]!.id;
      lista.forEach(([categoria, descripcion], r) => items.push({
        id: `${diaId}-${artistaId}-${r}`, eventoId, diaId, artistaId, descripcion, cantidad: 1,
        categoria: categoria as ItemBacklineEntrada["categoria"], referencia: referenciaDe(descripcion), propietario: { tipo: "sin-definir" },
      }));
    }

    escribir(PaqueteEvento.parse({
      evento, escenarios: [{ id: escenarioId, eventoId, nombre: "Tarima principal" }],
      dias, artistas: [...artistas.values()], bloques, items, stagePlots,
    }));
  }
}

importarCordillera();
importarProduccion();
