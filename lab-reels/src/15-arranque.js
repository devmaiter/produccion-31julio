/* ── Arranque ── */
splash().then(() => DEMO ? presentacion() : null).then(() => { if (DEMO) irALaBanda(); if (actual) guiaAlLlegar(actual); });
if (location.hash === "#intro") history.replaceState(null, "", location.pathname);
// Los filtros no se guardan: se arranca sin ellos, y así llega la primera vista.
enviar({tipo: "limpiar"});
(function arrancar(){
  if (!V) return setTimeout(arrancar, 20);
  arrancado = true;
  fotosSitio.de = null; cargarFotosSitio();
  // Al abrir: recuperar piezas que se hayan caído y sumar las bandas del show.
  setTimeout(() => recuperarPiezas().catch(() => {}).then(() => asegurarShow()).catch(() => {}), 1200);
  pintarPendiente();
  if (MARCA && !leer(P + "importado-circuito", "")) {
    const esperar = n => V?.doc ? traerDeCircuito().then(f => f && aviso(`Traje ${f} ${f === 1 ? "foto" : "fotos"} de la app de Circuito`)) : n > 0 && setTimeout(() => esperar(n - 1), 500);
    setTimeout(() => esperar(40), 1500);
  }
  pintarBarra();
  // Si se abrió con ?lista= ya es el documento pedido; si no, se avisa si hay un evento de hoy distinto al abierto.
  if (!new URLSearchParams(location.search).get("lista")) setTimeout(() => avisarEventoNuevo().catch(() => {}), 1200);
  riderDelCronograma();
  if (V.doc && !location.hash) introHecha = true;   // ya hay rider: sin la entrada
  pintar(location.hash.slice(1));
  if (!location.hash) setTimeout(directoALosReels, 1700);   // después del logo de Circuito
  eventoDeHoy().then(ok => ok && setTimeout(directoALosReels, 300)).catch(() => {});
})();
