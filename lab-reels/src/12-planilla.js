/* ── Planilla .xlsx (solo el admin): la banda como va, con lo que se haya editado ── */
function abrirPlanilla(id){
  const b = armarBandas(datos()).find(x => x.id === id); if (!b) return;
  const mayuscula = t => t.charAt(0).toLocaleUpperCase("es") + t.slice(1);
  const filas = [];
  for (const s of b.secciones) {
    if (s.grupo) filas.push({tipo: "seccion", cantidad: null, texto: s.grupo.replace(/[\s:·|–—-]+$/, "").toUpperCase()});
    for (const x of s.items) filas.push({tipo: "item", cantidad: x.cantidad, texto: mayuscula(x.referencia) + (x.propietario?.tipo === "tercero" ? " (lo trae la banda)" : "")});
  }
  const fecha = (b.items.find(x => /^d-\d{4}-\d{2}-\d{2}$/.test(x.diaId))?.diaId || "").slice(2);
  escribir("planilla:desde-reels", {banda: b.artistaId ? b.nombre : "", rider: V.doc?.nombre || "", fecha, filas});
  window.open("../planilla/?desde=reels", "_blank") || (location.href = "../planilla/?desde=reels");
}
