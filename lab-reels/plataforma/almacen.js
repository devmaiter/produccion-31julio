/* El almacén: la única puerta para guardar y leer (inversión de dependencias). La app pide «guarda esto» y no sabe
   dónde queda. Hoy queda en el celular (localStorage para datos, IndexedDB para fotos y audios). Para mudarse a un
   servidor o a otra base se escribe otro adaptador con las mismas funciones y se pasa a Almacen.usar(…), sin tocar
   el resto de la app.

   Adaptador de datos (texto por clave): { obtener(clave) → texto | null, poner(clave, texto), quitar(clave), claves() → [clave] }
   Adaptador de archivos (Blob por clave, por base): { ejecutar(base, modo, accion) → Promise, listar(base) → Promise<[[clave, Blob]]> },
   con la forma de IndexedDB. */
(function () {
  const enCelular = {
    obtener: k => localStorage.getItem(k),
    poner: (k, v) => localStorage.setItem(k, v),
    quitar: k => localStorage.removeItem(k),
    claves: () => Object.keys(localStorage),
  };
  const bases = new Map();   // nombre → Promise<IDBDatabase>
  // Cada base tiene un solo almacén: "fotos" (fotos, audios, copias internas) o "archivos" (riders del cronograma).
  const abrir = (nombre, almacen = "fotos") => {
    if (!bases.has(nombre)) {
      const p = new Promise((ok, mal) => {
        try {
          const r = indexedDB.open(nombre, 1);
          r.onupgradeneeded = () => r.result.createObjectStore(almacen);
          r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
        } catch (err) { mal(err); }
      });
      p.catch(() => {});
      bases.set(nombre, p);
    }
    return bases.get(nombre);
  };
  const archivosEnCelular = {
    async ejecutar(base, modo, accion, almacen = "fotos") {
      const db = await abrir(base, almacen);
      return new Promise((ok, mal) => {
        const tx = db.transaction(almacen, modo), q = accion(tx.objectStore(almacen));
        tx.oncomplete = () => ok(q?.result); tx.onerror = () => mal(tx.error);
      });
    },
    async listar(base) {
      const db = await abrir(base);
      return new Promise((ok, mal) => {
        const tx = db.transaction("fotos"), q = tx.objectStore("fotos").openCursor(), todos = [];
        q.onsuccess = () => { const c = q.result; if (c) { todos.push([c.key, c.value]); c.continue(); } };
        tx.oncomplete = () => ok(todos); tx.onerror = () => mal(tx.error);
      });
    },
  };
  let datos = enCelular, archivos = archivosEnCelular;

  window.Almacen = Object.freeze({
    /** Cambia dónde se guarda: Almacen.usar({datos, archivos}). Lo que no se pase sigue igual. */
    usar(a) { if (a?.datos) datos = a.datos; if (a?.archivos) archivos = a.archivos; },
    /** El valor guardado (JSON), o `def` si no hay o no se puede leer. */
    leer(k, def) { try { return JSON.parse(datos.obtener(k)) ?? def; } catch { return def; } },
    /** Guarda un valor (JSON); null lo quita. Nunca lanza: si el celular no deja, no pasa nada. */
    escribir(k, v) { try { v === null ? datos.quitar(k) : datos.poner(k, JSON.stringify(v)); } catch {} },
    /** El texto tal cual (para respaldos y copias). */
    crudo(k) { try { return datos.obtener(k); } catch { return null; } },
    ponerCrudo(k, texto) { try { datos.poner(k, texto); } catch {} },
    quitar(k) { try { datos.quitar(k); } catch {} },
    claves() { try { return datos.claves(); } catch { return []; } },
    /** Archivos (fotos, audios, copias internas) de una base: Almacen.archivos(base)(modo, store => store.put(…)). */
    archivos: (base, almacen = "fotos") => (modo, accion) => archivos.ejecutar(base, modo, accion, almacen),
    /** Todos los archivos de una base, como [[clave, Blob]] (para el respaldo). */
    listarArchivos: base => archivos.listar(base),
  });
})();
