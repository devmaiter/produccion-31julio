/* Convierte una Extraccion (nombres sueltos, tal como los leyó el modelo) en
 * entidades del dominio y la fusiona con el evento que ya tenemos.
 *
 * Todo aquí es determinista y probado: ids estables, referencias, categorías,
 * propietario, días y horas normalizados, y nada se duplica si el mismo
 * correo se procesa dos veces. Lo que no cuadra no se descarta en silencio:
 * queda en `avisos` para que una persona lo revise.
 */
import {
  PaqueteEvento, categorizar, propietarioDe, referenciaDe,
  type Bloque, type Canal, type Dia, type Escenario, type ItemBackline, type ItemBacklineEntrada,
  type Puesto, type Requisito, type StagePlot, type Zona,
} from "../dominio";
import { slug } from "../datos/slug";
import { clave } from "./nombres";
import type { Extraccion } from "./esquema";

export interface Conteo { nuevos: number; actualizados: number; iguales: number }

export interface Resumen {
  evento: { id: string; nuevo: boolean };
  escenarios: Conteo;
  dias: Conteo;
  artistas: Conteo;
  bloques: Conteo;
  items: Conteo;
  zonas: Conteo;
  puestos: Conteo;
  canales: Conteo;
  requisitos: Conteo;
  /** Del modelo (lo que no pudo leer) y de la integración (lo que no cuadró). */
  avisos: string[];
  /** Ids de los ítems de backline nuevos o actualizados en esta importación. */
  itemsTocados: string[];
}

const conteo = (): Conteo => ({ nuevos: 0, actualizados: 0, iguales: 0 });

function hora(h: string | null | undefined): string | null {
  const m = h?.trim().match(/^(\d{1,2})[:.h](\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  return hh < 24 && mm < 60 ? `${String(hh).padStart(2, "0")}:${m[2]}` : null;
}
const fechaValida = (f: string | null | undefined): f is string => !!f && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f));

export function integrar(ext: Extraccion, base: PaqueteEvento | null, origen: string): { paquete: PaqueteEvento; resumen: Resumen } {
  base = base ? structuredClone(base) : null; // nunca modificar el evento que nos pasan
  const avisos = [...ext.avisos];
  const itemsTocados: string[] = [];
  const resumen: Omit<Resumen, "evento"> = { escenarios: conteo(), dias: conteo(), artistas: conteo(), bloques: conteo(), items: conteo(), zonas: conteo(), puestos: conteo(), canales: conteo(), requisitos: conteo(), avisos, itemsTocados };

  /* --- Evento --------------------------------------------------------- */
  const fechas = [...ext.dias.map(d => d.fecha), ext.evento?.desde, ext.evento?.hasta].filter(fechaValida).sort();
  let evento = base?.evento;
  if (!evento) {
    if (!ext.evento?.nombre) throw new Error("Los archivos no identifican el evento. Indica a qué evento pertenecen.");
    if (!fechas.length) throw new Error(`No encontré fechas para "${ext.evento.nombre}". Indica a qué evento pertenecen.`);
    evento = {
      id: slug(`${ext.evento.nombre} ${/\b20\d\d\b/.test(ext.evento.nombre) ? "" : fechas[0]!.slice(0, 4)}`),
      nombre: ext.evento.nombre,
      lugar: ext.evento.lugar || "Por definir",
      ciudad: ext.evento.ciudad || "Por definir",
      desde: fechas[0]!,
      hasta: fechas.at(-1)!,
    };
  } else if (ext.evento?.nombre && clave(ext.evento.nombre) !== clave(evento.nombre) && !clave(ext.evento.nombre).includes(clave(evento.nombre))) {
    avisos.push(`Los archivos hablan de "${ext.evento.nombre}" y se están cargando en "${evento.nombre}". Revisa que sea el evento correcto.`);
  }
  const eventoId = evento.id;

  const escenarios: Escenario[] = [...(base?.escenarios ?? [])];
  const dias: Dia[] = [...(base?.dias ?? [])];
  const artistas = [...(base?.artistas ?? [])];
  const bloques: Bloque[] = [...(base?.bloques ?? [])];
  const items: ItemBackline[] = [...(base?.items ?? [])];
  const zonas: Zona[] = [...(base?.zonas ?? [])];
  const puestos: Puesto[] = [...(base?.puestos ?? [])];
  const canales: Canal[] = [...(base?.canales ?? [])];
  const requisitos: Requisito[] = [...(base?.requisitos ?? [])];
  const stagePlots: StagePlot[] = [...(base?.stagePlots ?? [])];

  /* --- Escenarios ------------------------------------------------------ */
  function escenarioId(nombre: string | null): string {
    if (!nombre) {
      if (escenarios.length === 1) return escenarios[0]!.id;
      const p = escenarios.find(e => e.id === "principal");
      if (p) return p.id;
      escenarios.push({ id: "principal", eventoId, nombre: "Tarima principal" });
      resumen.escenarios.nuevos++;
      return "principal";
    }
    const k = clave(nombre);
    const hit = escenarios.find(e => clave(e.nombre) === k || clave(e.id) === k || clave(e.nombre).includes(k) || k.includes(clave(e.nombre)));
    if (hit) return hit.id;
    const id = slug(nombre) || `escenario-${escenarios.length + 1}`;
    escenarios.push({ id, eventoId, nombre });
    resumen.escenarios.nuevos++;
    return id;
  }
  for (const e of ext.escenarios) {
    const antes = escenarios.length;
    escenarioId(e);
    if (escenarios.length === antes) resumen.escenarios.iguales++;
  }

  /* --- Días ------------------------------------------------------------ */
  function diaId(fecha: string, nombre?: string, tipo: Dia["tipo"] = "show"): string {
    const hit = dias.find(d => d.fecha === fecha);
    if (hit) return hit.id;
    const id = `${eventoId}-${fecha}`;
    dias.push({ id, eventoId, fecha, nombre: nombre || fecha, tipo });
    dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
    resumen.dias.nuevos++;
    return id;
  }
  for (const d of ext.dias) {
    if (!fechaValida(d.fecha)) { avisos.push(`Día con fecha ilegible: "${d.fecha}" (${d.nombre}). No se cargó.`); continue; }
    const existe = dias.find(x => x.fecha === d.fecha);
    if (existe) {
      resumen.dias.iguales++;
      if (existe.tipo !== d.tipo) avisos.push(`${existe.nombre}: estaba como día de ${existe.tipo} y el archivo dice ${d.tipo}. Se dejó ${existe.tipo}.`);
    } else diaId(d.fecha, d.nombre, d.tipo);
  }

  /* --- Artistas -------------------------------------------------------- */
  const vistosArtistas = new Set<string>();
  function artistaId(nombre: string): string {
    const k = clave(nombre);
    let a = artistas.find(x => clave(x.nombre) === k || x.id.replace(/-/g, "") === k);
    if (!a) {
      a = { id: slug(nombre), nombre: nombre.trim() };
      artistas.push(a);
      resumen.artistas.nuevos++;
    } else if (!vistosArtistas.has(a.id)) resumen.artistas.iguales++;
    vistosArtistas.add(a.id);
    return a.id;
  }
  ext.artistas.forEach(artistaId);

  /* --- Bloques de horario --------------------------------------------- */
  for (const b of ext.bloques) {
    const inicio = hora(b.inicio);
    if (!fechaValida(b.fecha) || !inicio) {
      avisos.push(`Horario ilegible: ${b.artista ?? b.titulo} ${b.fecha} ${b.inicio}. No se cargó.`);
      continue;
    }
    const fin = hora(b.fin) ?? inicio;
    const nuevo: Bloque = {
      id: "",
      diaId: diaId(b.fecha),
      escenarioId: escenarioId(b.escenario),
      artistaId: b.artista ? artistaId(b.artista) : undefined,
      titulo: b.titulo.trim() || b.tipo,
      tipo: b.tipo,
      inicio,
      fin,
    };
    const igual = bloques.find(x => x.diaId === nuevo.diaId && x.escenarioId === nuevo.escenarioId && x.artistaId === nuevo.artistaId && x.tipo === nuevo.tipo && x.inicio === nuevo.inicio);
    if (igual) {
      if (igual.fin !== fin) { igual.fin = fin; resumen.bloques.actualizados++; } else resumen.bloques.iguales++;
      continue;
    }
    nuevo.id = unico(`${nuevo.diaId}-${nuevo.artistaId ?? slug(nuevo.titulo)}-${nuevo.tipo}-${inicio.replace(":", "")}`, new Set(bloques.map(x => x.id)));
    bloques.push(nuevo);
    resumen.bloques.nuevos++;
  }

  /* --- Backline -------------------------------------------------------- */
  const idsItems = new Set(items.map(i => i.id));
  for (const it of ext.items) {
    const aId = artistaId(it.artista);
    const destinos = diasDelItem(it.fecha, aId);
    if (!destinos.length) {
      avisos.push(`${it.artista}: "${it.descripcion}" no tiene día y el artista no aparece en el horario. No se cargó; indica el día.`);
      continue;
    }
    const descripcion = it.descripcion.trim();
    const cantidad = Math.max(0, Math.round(it.cantidad));
    const categoria = it.categoria === "Otro" ? categorizar(`${descripcion} ${it.grupo ?? ""}`) : it.categoria;
    const referencia = referenciaDe(descripcion);
    const observacion = [it.proveedor, it.nota].filter(Boolean).join(" · ") || undefined;

    for (const dId of destinos) {
      const igual = items.find(x => x.diaId === dId && x.artistaId === aId && clave(x.descripcion) === clave(descripcion) && (x.grupo ?? "") === (it.grupo ?? x.grupo ?? ""));
      if (igual) {
        if (igual.cantidad !== cantidad) {
          avisos.push(`${nombreArtista(aId)} · ${descripcion}: la cantidad cambió de ${igual.cantidad} a ${cantidad} (${origen}). Marcado para confirmar.`);
          igual.cantidad = cantidad;
          igual.porConfirmar = true;
          igual.origen = origen;
          itemsTocados.push(igual.id);
          resumen.items.actualizados++;
        } else resumen.items.iguales++;
        continue;
      }
      const entrada: ItemBacklineEntrada = {
        id: unico(`${dId}-${aId}-${slug(referencia).slice(0, 40)}`, idsItems),
        eventoId, diaId: dId, artistaId: aId,
        grupo: it.grupo ?? undefined,
        descripcion, cantidad, categoria, referencia,
        propietario: propietarioDe(it.proveedor ?? undefined),
        observacion,
        porConfirmar: it.dudoso,
        chuleadoEnHoja: false,
        origen,
      };
      idsItems.add(entrada.id);
      itemsTocados.push(entrada.id);
      items.push(entrada as ItemBackline);
      resumen.items.nuevos++;
    }
  }

  /* --- Tarima: zonas, puestos, canales; requisitos y planos ------------- */
  const mismo = (a: string, b: string) => clave(a) === clave(b);
  for (const z of ext.zonas) {
    const aId = artistaId(z.artista);
    const ya = zonas.find(x => x.artistaId === aId && mismo(x.nombre, z.nombre));
    if (ya) {
      let cambio = false;
      const nuevo: Partial<Zona> = { ancho: z.ancho ?? undefined, fondo: z.fondo ?? undefined, alto: z.alto ?? undefined, x: z.x ?? undefined, y: z.y ?? undefined, lado: z.lado ?? undefined, profundidad: z.profundidad ?? undefined };
      for (const k of ["ancho", "fondo", "alto", "x", "y", "lado", "profundidad"] as const) {
        if (nuevo[k] !== undefined && ya[k] === undefined) { (ya as Record<string, unknown>)[k] = nuevo[k]; cambio = true; }
      }
      if (cambio) resumen.zonas.actualizados++; else resumen.zonas.iguales++;
      continue;
    }
    zonas.push({
      id: unico(`${eventoId}-${aId}-zona-${slug(z.nombre)}`, new Set(zonas.map(x => x.id))),
      eventoId, artistaId: aId, nombre: z.nombre, tipo: z.tipo,
      ancho: z.ancho ?? undefined, fondo: z.fondo ?? undefined, alto: z.alto ?? undefined, cantidad: z.cantidad,
      ruedas: z.ruedas ?? undefined, lado: z.lado ?? undefined, profundidad: z.profundidad ?? undefined,
      x: z.x ?? undefined, y: z.y ?? undefined,
      observacion: z.nota ?? undefined, porConfirmar: z.dudoso, origen,
    });
    resumen.zonas.nuevos++;
  }
  for (const p of ext.puestos) {
    const aId = artistaId(p.artista);
    const zona = p.zona ? zonas.find(x => x.artistaId === aId && mismo(x.nombre, p.zona!)) : undefined;
    const ya = puestos.find(x => x.artistaId === aId && mismo(x.nombre, p.nombre));
    if (ya) {
      // Lo marcado a mano (sin porConfirmar) manda sobre lo que propone el OCR.
      if (ya.porConfirmar && p.x !== null && p.y !== null && (ya.x !== p.x || ya.y !== p.y)) { ya.x = p.x; ya.y = p.y; resumen.puestos.actualizados++; }
      else resumen.puestos.iguales++;
      continue;
    }
    puestos.push({
      id: unico(`${eventoId}-${aId}-puesto-${slug(p.nombre)}`, new Set(puestos.map(x => x.id))),
      eventoId, artistaId: aId, nombre: p.nombre, rol: p.rol, zonaId: zona?.id,
      x: p.x ?? undefined, y: p.y ?? undefined, corriente: p.corriente ?? undefined, monitor: p.monitor ?? undefined,
      porConfirmar: p.dudoso, origen,
    });
    resumen.puestos.nuevos++;
  }
  for (const c of ext.canales) {
    const aId = artistaId(c.artista);
    const dId = fechaValida(c.fecha) ? diaId(c.fecha) : undefined;
    const ya = canales.find(x => x.artistaId === aId && x.tipo === c.tipo && mismo(x.numero, c.numero) && (x.diaId ?? "") === (dId ?? ""));
    const datos = { instrumento: c.instrumento, microfono: c.microfono ?? undefined, base: c.base ?? undefined, snake: c.snake ?? undefined, ubicacion: c.ubicacion ?? undefined, observacion: c.nota ?? undefined };
    if (ya) {
      const cambio = (Object.keys(datos) as Array<keyof typeof datos>).some(k => datos[k] !== undefined && datos[k] !== ya[k]);
      if (cambio) { Object.assign(ya, datos); resumen.canales.actualizados++; } else resumen.canales.iguales++;
      continue;
    }
    const zona = c.ubicacion ? zonas.find(x => x.artistaId === aId && clave(c.ubicacion!).includes(clave(x.nombre))) : undefined;
    canales.push({
      id: unico(`${eventoId}-${aId}-${c.tipo}-${dId ? dId.slice(-5) + "-" : ""}${slug(c.numero)}`, new Set(canales.map(x => x.id))),
      eventoId, artistaId: aId, diaId: dId, tipo: c.tipo, numero: c.numero, ...datos, zonaId: zona?.id,
    });
    resumen.canales.nuevos++;
  }
  for (const q of ext.requisitos) {
    const aId = artistaId(q.artista);
    if (requisitos.some(x => x.artistaId === aId && x.tema === q.tema && x.texto === q.texto)) { resumen.requisitos.iguales++; continue; }
    const previo = requisitos.find(x => x.artistaId === aId && x.tema === q.tema);
    if (previo) { previo.texto = q.texto; previo.origen = origen; resumen.requisitos.actualizados++; continue; }
    requisitos.push({ id: unico(`${eventoId}-${aId}-${q.tema}`, new Set(requisitos.map(x => x.id))), eventoId, artistaId: aId, tema: q.tema, texto: q.texto, origen });
    resumen.requisitos.nuevos++;
  }
  for (const pl of ext.planos) {
    const aId = artistaId(pl.artista);
    const ya = stagePlots.find(s => s.artistaId === aId);
    if (ya) ya.archivo = pl.archivo; else stagePlots.push({ artistaId: aId, eventoId, archivo: pl.archivo });
  }

  function diasDelItem(fecha: string | null, aId: string): string[] {
    if (fechaValida(fecha)) return [diaId(fecha)];
    if (fecha) avisos.push(`Fecha ilegible "${fecha}" en el backline de ${nombreArtista(aId)}; se usó su horario.`);
    const suyos = bloques.filter(b => b.artistaId === aId);
    const shows = [...new Set(suyos.filter(b => b.tipo === "show").map(b => b.diaId))];
    if (shows.length) return shows;
    return [...new Set(suyos.map(b => b.diaId))];
  }
  function nombreArtista(id: string) { return artistas.find(a => a.id === id)?.nombre ?? id; }

  const fechasFinales = dias.map(d => d.fecha).sort();
  const paquete = PaqueteEvento.parse({
    evento: { ...evento, desde: fechasFinales[0] ?? evento.desde, hasta: fechasFinales.at(-1) ?? evento.hasta },
    escenarios, dias, artistas, bloques, items, stagePlots, zonas, puestos, canales, requisitos,
  });
  return { paquete, resumen: { evento: { id: eventoId, nuevo: !base }, ...resumen } };
}

function unico(id: string, usados: Set<string>): string {
  const baseId = slug(id) || "item";
  let out = baseId, n = 2;
  while (usados.has(out)) out = `${baseId}-${n++}`;
  return out;
}

/** Lo que ya sabemos del evento, en texto, para que el modelo use los mismos nombres. */
export function contextoDe(p: PaqueteEvento): string {
  return [
    `Evento: ${p.evento.nombre} (${p.evento.lugar}, ${p.evento.ciudad}, ${p.evento.desde} a ${p.evento.hasta})`,
    `Escenarios: ${p.escenarios.map(e => e.nombre).join(", ")}`,
    `Días: ${p.dias.map(d => `${d.nombre} = ${d.fecha} (${d.tipo})`).join("; ")}`,
    `Artistas: ${p.artistas.map(a => a.nombre).join(", ")}`,
  ].join("\n");
}
