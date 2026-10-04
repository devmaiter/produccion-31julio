/* Lee un stage plot (imagen) con OCR y propone qué hay y dónde:
 *   - zonas: "RISER A", "DRUM RISER", "AMP RISER", "GUITAR WORLD", "DRUM TECH"…
 *   - puestos: "BASS", "CONGA", "PIANO", "TRUMP 1", "VIOLIN", "DJ"…, y nombres
 *     de músicos que el IO List asocia a un rol ("BASS OMAR" → Omar es el bajista)
 *   - tomas de corriente: "110v AC", "120V", "230 V"
 *   - mezclas y IEM: "MIX 9 Y 10", "IEM 13-14"
 *   - medidas de risers dibujadas: "8ft x 8ft x 23in", "2445mm"
 * Todo sale con su posición (0–1) sobre la imagen y marcado como dudoso:
 * el OCR propone, una persona confirma o corrige en el plano.
 */
import type { RolPuesto } from "../dominio/entidades";
import type { PuestoExtraido, ZonaExtraida } from "./esquema";
import type { Lectores } from "./leer";
import { buscarMedidas, type Medidas } from "./medidas";

export interface TomaCorriente { voltaje: string; x: number; y: number }
export interface MonitorPlano { texto: string; x: number; y: number }
export interface MedidaPlano extends Medidas { x: number; y: number; texto: string }

export interface LecturaPlano {
  zonas: ZonaExtraida[];
  puestos: PuestoExtraido[];
  tomas: TomaCorriente[];
  monitores: MonitorPlano[];
  medidas: MedidaPlano[];
  /** Todo lo que el OCR leyó con su posición, por si hay que revisar. */
  etiquetas: Array<{ texto: string; confianza: number; x: number; y: number }>;
  avisos: string[];
}

const ROLES: Array<[RegExp, RolPuesto]> = [
  [/\b(drums?|drummer|brummer|bater[ií]a|kick|drum ?kit)\b/i, "bateria"],
  [/\b(congas?|bongo|bongos|timbal(es)?|perc(usi[oó]n|ussion)?|tumba|caj[oó]n|tambora|alegre|llamador|surdo)\b/i, "percusion"],
  [/\b(bass|bajo|bajista)\b/i, "bajo"],
  [/\b(piano|keys?|keyboards?|teclados?|nord|wurli(tzer)?|synth|rhodes|organ|[oó]rgano|jc-?120)\b/i, "teclados"],
  [/\b(trb|trombone?|tromb[oó]n|trump(et)?|trompeta|sax(o|of[oó]n)?|brass|metales|vientos|horns?|ewi|flauta|clarinete)\b/i, "metales"],
  [/\b(violin|viol[ií]n|viola|cello|chelo|strings?|cuerdas)\b/i, "cuerdas"],
  [/\b(guitars?|gtr|guitarra|acoustic|ac gtr|egtr)\b/i, "guitarra"],
  [/\b(dj|cdj|turntables?|tornamesa)\b/i, "dj"],
  [/\b(vox|vocals?|voz|voces|singer|lead|cantante|mc)\b/i, "voz"],
  [/\b(playback|tracks?|seq|secuencias|laptop|ableton)\b/i, "playback"],
  [/\b(tech|t[eé]cnico|crew)\b/i, "tecnico"],
];
const ZONA_AREA = /^(drum ?tech|guitar ?world|monitor ?world|mon ?world|backline ?area ?\d*|playback( ?station)?|dj ?(table|booth)|keys? ?world|bass ?world|sidefill ?[lr-]*|side ?fill ?[lr-]*|front ?vox|escalera)$/i;
const ZONA_RISER = /^(?:rolling ?)?(?:riser|sobre ?tarima|tarima|platform)\s*([a-d]|\d)?$|^(drum|amp|keyboard|keys|dj|bass|string|percussion|brass) ?riser$/i;
const VOLTAJE = /\b(1[012]0|1[12]7|2[23]0)\s*v(?:olts?|ac)?\b|\b(1[012]0|1[12]7|2[23]0)\s*v\s*ac\b/i;
const MONITOR = /^(mix|iem|wedge|cu[ñn]a)\b/i;
const DESCARTAR = /^(the|and|con|de|del|para|por|sin|stage|escenario|plano|plot|riser:|downstage|upstage|audience|p[uú]blico)$/i;

const MICROFONO = /\b(sm\s?\d{2,3}[a-z]?|beta\s?\d{2,3}[a-z]?|ksm\s?\d{2,3}|md\s?\d{3}|e\s?\d{3}|c\s?\d{3}|km\s?\d{3}|akg|shure|senn(heiser)?|audix|dpa|neumann|beyer|b\s?9[18][a-z]?|d\s?112|d\s?6|i5|\bdi\b|xlr|wl|wireless)\b/i;

const CONFIANZA_MINIMA = 55;

export interface ContextoPlano {
  artista: string;
  /** Nombres de músicos con su rol, sacados del IO List ("BASS OMAR" → Omar: bajo). */
  musicos?: Map<string, RolPuesto>;
  /** Medidas de los risers según la hoja Risers, para cotejar con las del plano. */
  risers?: Array<{ ancho: number; fondo: number }>;
}

export async function leerPlano(bytes: Uint8Array, extension: string, ctx: ContextoPlano, lectores: Lectores): Promise<LecturaPlano | null> {
  if (!lectores.ocr || !lectores.ampliarImagen) return null;
  const grande = await lectores.ampliarImagen(bytes, extension, 3);
  const ocr = await lectores.ocr();
  const lineas = await ocr.etiquetas(grande.bytes);
  return interpretarEtiquetas(lineas.map(l => ({
    texto: l.texto, confianza: l.confianza,
    x: (l.x + l.ancho / 2) / grande.ancho, y: (l.y + l.alto / 2) / grande.alto,
  })), ctx);
}

/** Separado del OCR para poder probarlo con etiquetas conocidas. */
export function interpretarEtiquetas(etiquetas: LecturaPlano["etiquetas"], ctx: ContextoPlano): LecturaPlano {
  const r: LecturaPlano = { zonas: [], puestos: [], tomas: [], monitores: [], medidas: [], etiquetas, avisos: [] };
  const vistos = new Map<string, number>();
  const nombrar = (base: string) => {
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return n === 1 ? base : `${base} ${n}`;
  };
  const dudoso = (c: number) => c < 80;
  const rc = (n: number) => Math.round(n * 1000) / 1000;

  for (const e of etiquetas) {
    if (e.confianza < CONFIANZA_MINIMA) continue;
    const t = e.texto.replace(/[|_]+/g, " ").replace(/\s+/g, " ").trim();
    if (!t || DESCARTAR.test(t)) continue;
    if (/^\d{1,2}[.)]\s*\p{L}/u.test(t)) continue; // "1. KICK IN B91": lista de canales dibujada en el plano
    if (/^\d{1,2}\s+\p{L}/u.test(t) && (MICROFONO.test(t) || t.split(" ").length >= 3)) continue; // "22 BONGOS SM47": ídem, sin punto
    const x = rc(e.x), y = rc(e.y);

    const m = buscarMedidas(t);
    if (m && /\b(mm|cm|ft|in|mts?|m)\b|['"`´]/.test(t)) { r.medidas.push({ ...m, x, y, texto: t }); continue; }
    if (/^\d{3,5}\s*mm$/i.test(t)) continue; // cotas sueltas ("4880mm")

    const v = t.match(VOLTAJE);
    if (v) { r.tomas.push({ voltaje: `${v[1] ?? v[2]} V`, x, y }); continue; }
    if (MONITOR.test(t)) { r.monitores.push({ texto: t, x, y }); continue; }

    const riser = t.match(ZONA_RISER);
    if (riser) {
      const nombre = riser[1] ? `Riser ${riser[1].toUpperCase()}` : riser[2] ? `${capitalizar(riser[2])} riser` : nombrar("Riser");
      r.zonas.push({ artista: ctx.artista, nombre, tipo: "riser", ancho: null, fondo: null, alto: null, cantidad: 1, ruedas: null, lado: lado(x), profundidad: profundidad(y), x, y, dudoso: dudoso(e.confianza), nota: `leído del plano: "${t}"` });
      continue;
    }
    if (ZONA_AREA.test(t)) {
      r.zonas.push({ artista: ctx.artista, nombre: capitalizar(t), tipo: "area", ancho: null, fondo: null, alto: null, cantidad: 1, ruedas: null, lado: lado(x), profundidad: profundidad(y), x, y, dudoso: dudoso(e.confianza), nota: `leído del plano: "${t}"` });
      continue;
    }

    // Un nombre de músico que el IO List ya asocia a un rol.
    const clave = t.toLowerCase().replace(/[^a-záéíóúñ]/g, "");
    const rolMusico = clave.length >= 3 ? ctx.musicos?.get(clave) : undefined;
    if (rolMusico) {
      r.puestos.push(puesto(ctx.artista, capitalizar(t), rolMusico, x, y, e.confianza, `en el plano dice "${t}"; el IO List lo asocia a ${rolMusico}`));
      continue;
    }
    const rol = ROLES.find(([re]) => re.test(t))?.[1];
    if (rol && letras(t) <= 24 && t.split(" ").length <= 3) {
      r.puestos.push(puesto(ctx.artista, nombrar(capitalizar(t)), rol, x, y, e.confianza, `leído del plano: "${t}"`));
    }
  }

  // Corriente y monitor: se le atribuyen al puesto más cercano (a menos de un 12 % del plano).
  for (const toma of r.tomas) {
    const p = masCercano(r.puestos, toma.x, toma.y, 0.12);
    if (p && !p.corriente) p.corriente = toma.voltaje;
  }
  for (const mon of r.monitores) {
    const p = masCercano(r.puestos, mon.x, mon.y, 0.12);
    if (p) p.monitor = p.monitor ? `${p.monitor} · ${mon.texto}` : mon.texto;
  }

  // Cotejo con la hoja Risers: medidas dibujadas que no aparecen en la hoja.
  if (ctx.risers?.length) {
    for (const m of r.medidas) {
      const hay = ctx.risers.some(z => cerca(z.ancho, m.ancho) && cerca(z.fondo, m.fondo) || cerca(z.ancho, m.fondo) && cerca(z.fondo, m.ancho));
      if (!hay) r.avisos.push(`${ctx.artista}: el plano dibuja un riser de ${m.texto} que no está en la hoja de risers.`);
    }
  }
  if (!r.puestos.length && !r.zonas.length) r.avisos.push(`${ctx.artista}: el plano no tiene texto legible; los puestos hay que marcarlos a mano.`);
  return r;
}

function puesto(artista: string, nombre: string, rol: RolPuesto, x: number, y: number, confianza: number, nota: string): PuestoExtraido {
  return { artista, nombre, rol, zona: null, x, y, corriente: null, monitor: null, dudoso: true, nota: `${nota} (${confianza}%)` };
}

/** Sobre un plano visto desde arriba con el público abajo: la izquierda de la imagen es SR (la derecha del músico). */
function lado(x: number): "sr" | "centro" | "sl" {
  return x < 0.38 ? "sr" : x > 0.62 ? "sl" : "centro";
}
function profundidad(y: number): "us" | "centro" | "ds" {
  return y < 0.38 ? "us" : y > 0.62 ? "ds" : "centro";
}

function masCercano<T extends { x: number | null; y: number | null }>(lista: T[], x: number, y: number, maximo: number): T | null {
  let mejor: T | null = null, d0 = maximo;
  for (const p of lista) {
    if (p.x === null || p.y === null) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < d0) { d0 = d; mejor = p; }
  }
  return mejor;
}

const cerca = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.15, a * 0.08);
const letras = (s: string) => (s.match(/\p{L}/gu) ?? []).length;
function capitalizar(s: string): string {
  return s.replace(/[\s/+,;:.\-–]+$/, "").replace(/^[\s/+,;:.\-–]+/, "").toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, e, c) => e + c.toUpperCase()).replace(/\b(Sr|Sl|Dj|Iem|Us|Ds)\b/g, m => m.toUpperCase());
}

/** Extrae de los nombres del IO List quién toca qué: "BASS OMAR" → omar: bajo, "VOX 1 ALEX" → alex: voz. */
export function musicosDesdeCanales(canales: Array<{ instrumento: string }>): Map<string, RolPuesto> {
  const out = new Map<string, RolPuesto>();
  for (const c of canales) {
    const rol = ROLES.find(([re]) => re.test(c.instrumento))?.[1];
    if (!rol) continue;
    for (const palabra of c.instrumento.split(/[\s/]+/)) {
      const p = palabra.toLowerCase().replace(/[^a-záéíóúñ]/g, "");
      if (p.length < 3 || ROLES.some(([re]) => re.test(p)) || /^(main|spare|top|bottom|in|out|left|right|amp|line|mic|di|wireless|dry|tune|tb|world|riser|rack|mon|foh|sub|snare|kick|tom|toms|hat|ride|crash|oh|cue|director|guest|invitado|and|con|para|del|the|para|solo)$/.test(p)) continue;
      if (!out.has(p)) out.set(p, rol);
    }
  }
  return out;
}
