/* ── Piezas agregadas a mano: que no se pierdan nunca (lo pidió el usuario: tomó foto al pedal de sustain
   agregado y, al volver a abrir la lista, la pieza se cayó con su foto). Se guardan aparte por documento
   (lab-reels:agregados:<doc>) y vuelven al recargar. Lo de antes de este arreglo se recupera de las copias
   internas, de la app de Circuito (en la copia con marca) y de las fotos y chulos que quedaron sin pieza. ── */
function guardarAgregado(x){
  const k = P + "agregados:" + (V?.doc?.nombre || "");
  const l = leer(k, []).filter(y => piezaDe(y) !== piezaDe(x));
  escribir(k, [...l, x]);
}
// Mete en d las piezas que falten (por banda, sección y nombre), cada una al final de su sección.
function ponerAgregados(d, extra){
  const hay = new Set(d.items.map(piezaDe));
  let n = 0;
  for (const x of extra) {
    if (hay.has(piezaDe(x))) continue;
    const plantilla = d.items.find(i => i.artistaId === x.artistaId) || d.items[0]; if (!plantilla) continue;
    const nuevo = {...plantilla, ...x, id: String(x.id || "").startsWith("agregado-") ? x.id : "agregado-" + Date.now().toString(36) + n,
      diaId: plantilla.diaId, artistaId: x.artistaId || plantilla.artistaId};
    const deSeccion = d.items.filter(i => i.artistaId === nuevo.artistaId && (i.grupo || "") === (nuevo.grupo || ""));
    const i = deSeccion.length ? d.items.lastIndexOf(deSeccion.at(-1)) : d.items.length - 1;
    d.items.splice(i + 1, 0, nuevo); hay.add(piezaDe(nuevo)); n++;
  }
  return n;
}
async function piezasRecuperables(){
  const doc = V?.doc; if (!doc) return [];
  const de = [];
  const deTablero = txt => { try { const t = JSON.parse(txt || "{}"); for (const d of [t.pruebas, t.evento]) if (d?.nombre === doc.nombre) de.push(...(d.datos?.items || []).filter(i => String(i.id).startsWith("agregado-"))); } catch {} };
  // a) las copias internas de aquí
  for (const k of await instantaneas()) {
    try { const r = JSON.parse(await (await idb("readonly", st => st.get(k))).text()); deTablero(r.ls?.[P + "tablero"]); } catch {}
  }
  // b) en la copia con marca: lo de la app de Circuito (su tablero y sus copias internas)
  if (MARCA) {
    deTablero(Almacen.crudo(CLAVE_CIRCUITO + "tablero"));
    const deCircuito = Almacen.archivos(FOTOS_CIRCUITO);
    const claves = await deCircuito("readonly", st => st.getAllKeys()).catch(() => []) || [];
    for (const k of claves.filter(k => String(k).startsWith("instantanea-"))) {
      const b = await deCircuito("readonly", st => st.get(k)).catch(() => null);
      try { deTablero(JSON.parse(await b.text()).ls?.[CLAVE_CIRCUITO + "tablero"]); } catch {}
    }
  }
  // c) fotos y chulos que quedaron sin pieza: la pieza se arma con lo que dice su clave
  const actuales = new Set(datos().items.map(piezaDe));
  const artistas = new Set(datos().items.map(i => i.artistaId));
  const categoriaDe = nombre => Object.values(LLEVA).flat().find(r => sinTildesL(r.pieza) === sinTildesL(nombre))?.categoria;
  for (const k of Object.keys(V.fotos || {})) {
    if (!k.startsWith("pieza|")) continue;
    const partes = k.split("|"), art = partes[1], grupo = partes[2], ref = partes.slice(3, -1).join("|");
    if (!artistas.has(art)) continue;
    const x = {artistaId: art, grupo, referencia: ref, descripcion: ref, cantidad: 1, nota: "Recuperada: tenía fotos guardadas", propietario: {tipo: "propio"}, porConfirmar: false};
    const deGrupo = datos().items.find(i => i.artistaId === art && (i.grupo || "") === grupo);
    x.categoria = categoriaDe(corto(ref)) || deGrupo?.categoria || "Otro";
    if (!actuales.has(piezaDe(x))) de.push(x);
  }
  for (const nombre of leer(P + "chulos2:" + doc.nombre, [])) {
    if (actuales.has(nombre)) continue;
    const [art, grupo, ref] = String(nombre).split("|"); if (!artistas.has(art) || !ref) continue;
    const bonito = ref.charAt(0).toUpperCase() + ref.slice(1);
    const deGrupo = datos().items.find(i => i.artistaId === art && (i.grupo || "") === grupo);
    de.push({artistaId: art, grupo, referencia: bonito, descripcion: bonito, cantidad: 1, categoria: categoriaDe(bonito) || deGrupo?.categoria || "Otro", nota: "Recuperada: tenía chulo", propietario: {tipo: "propio"}, porConfirmar: false});
  }
  // Una sola vez cada pieza; la versión que vino de un documento (con su cantidad y nota) gana.
  const unicas = new Map();
  for (const x of de) if (!unicas.has(piezaDe(x)) && !actuales.has(piezaDe(x))) unicas.set(piezaDe(x), x);
  return [...unicas.values()];
}
