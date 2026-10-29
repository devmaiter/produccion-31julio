/* El entorno de los reels: lo único que cambia si la app se muda (otra marca, otro servidor, otra base de datos).
   El resto del código no escribe nombres de claves, bases ni rutas: los toma de aquí.

   Otra marca: antes de este archivo, window.MARCA = {nombre, logo, prefijo} (lo pone hacer-marcas.py). Sus datos
   quedan aparte en el celular: claves "<prefijo>:", "<prefijo>-cronograma:" y bases "<prefijo>-fotos", "<prefijo>-riders".
   Sin marca son las de Circuito, las de siempre: "lab-reels:", "cronograma:", "backline-fotos", "backline-riders".
   Estos nombres NO se cambian sin migrar lo guardado (ver CLAUDE.md: «nada se pierde»). */
(function () {
  const marca = window.MARCA || null;
  const p = marca?.prefijo || "lab-reels";
  window.ENTORNO = Object.freeze({
    marca,
    /** Prefijos de las claves de localStorage (cada clave es "<prefijo>:<nombre>"). */
    claves: Object.freeze({ app: p, cronograma: marca ? `${p}-cronograma` : "cronograma", planilla: "planilla" }),
    /** Bases de IndexedDB: las fotos (y copias internas) y los riders del cronograma. */
    bases: Object.freeze({ fotos: marca ? `${p}-fotos` : "backline-fotos", riders: marca ? `${p}-riders` : "backline-riders" }),
    /** La app de Circuito, de donde una copia con marca trae lo que quedó guardado allá (traerDeCircuito). */
    circuito: Object.freeze({ app: "lab-reels", fotos: "backline-fotos" }),
    /** Dónde están el lector y el evento del día, relativo a esta página. */
    rutas: Object.freeze({ lector: "../cordillera/lector/", hoy: "../hoy/" }),
  });
})();
