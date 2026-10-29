// Red de seguridad: guarda lo que la app muestra y guarda en cada escenario, normalizado, para comparar
// antes y después de cada cambio. Uso: node red-de-seguridad.mjs <salida.json> [base-url]
// Necesita el sitio servido en local: python3 -m http.server 8000 (en la raíz del repo).
import { chromium } from "playwright";
import fs from "node:fs";
const SALIDA = process.argv[2], BASE = process.argv[3] || "http://localhost:8000";
const RIDER = new URL("../lector/tests/fixtures/riders/rider-tabla-con-observaciones.pdf", import.meta.url).pathname;
const CHROME = process.env.CHROME || (fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);
const b = await chromium.launch({ executablePath: CHROME });
const out = {};
const limpiar = t => String(t || "")
  .replace(/\b\d{1,2}:\d{2}\b/g, "HH:MM")
  .replace(/\bhoy, \d{1,2} \w{3}\b/g, "hoy, FECHA")
  .replace(/\b(Buen día|Buenas tardes|Buenas noches)\b/g, "SALUDO")
  .replace(/\b(Lun|Mar|Mié|Jue|Vie|Sáb|Dom), \d{1,2} \w{3}\b/g, "DIA")
  .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
const VOLATIL = /instantanea|ultimo-respaldo|cuando|subido|fecha|hora|ts$|evento-cargado|importado-circuito/i;

async function estado(p){
  return p.evaluate(VOL => {
    const vol = new RegExp(VOL, "i");
    const doc = window.V?.doc;
    const d = doc?.datos;
    const items = d ? d.items.map(x => ({ id: x.id, artista: x.artistaId, grupo: x.grupo, cantidad: x.cantidad, referencia: x.referencia,
      descripcion: x.descripcion, categoria: x.categoria, nota: x.nota || null, reel: typeof reelDe === "function" ? reelDe(x) : null })) : null;
    const falt = {};
    if (d && typeof faltantes === "function") for (const a of d.artistas) {
      const g = {}; for (const x of d.items.filter(i => i.artistaId === a.id)) (g[x.grupo] ||= []).push(x);
      for (const [k, v] of Object.entries(g)) { const f = faltantes(v).map(r => r.pieza); if (f.length) falt[a.nombre + "|" + k] = f; }
    }
    const ls = {};
    for (const k of Object.keys(localStorage).sort()) {
      let v = localStorage.getItem(k);
      if (k.endsWith(":tablero")) { try { const j = JSON.parse(v); for (const kk of Object.keys(j)) if (vol.test(kk)) j[kk] = "VOL"; if (j.doc) { for (const kk of Object.keys(j.doc)) if (vol.test(kk)) j.doc[kk] = "VOL"; } v = JSON.stringify(j); } catch {} }
      v = v.replace(/"(cuando|subido|fecha|ts)":"[^"]*"/g, '"$1":"VOL"').replace(/"id":"n-[a-z0-9]+"/g, '"id":"n-X"');
      ls[k] = vol.test(k) ? "VOL" : (v.length > 4000 ? `LEN${v.length}:` + v.slice(0, 400) : v);
    }
    return { doc: doc ? { nombre: doc.nombre, artistas: d.artistas.map(a => [a.id, a.nombre]), nItems: d.items.length } : null,
      items, faltantes: falt, perfil: window.V?.perfil, espacio: window.V?.espacio, modo: window.V?.modo, ls,
      marca: window.MARCA || null, secciones: [...document.querySelectorAll("[id^=banda-]")].map(e => e.id) };
  }, VOLATIL.source);
}
async function texto(p, sel){ return limpiar(await p.evaluate(s => [...document.querySelectorAll(s)].map(e => e.innerText).join("\n---\n"), sel)); }
async function idbClaves(p, base){
  return p.evaluate(nombre => new Promise(ok => { const r = indexedDB.open(nombre); r.onerror = () => ok(null);
    r.onsuccess = () => { const db = r.result; const stores = [...db.objectStoreNames]; if (!stores.length) return ok({stores}); const t = db.transaction(stores); const res = {stores};
      let n = stores.length; for (const s of stores) { const q = t.objectStore(s).getAllKeys(); q.onsuccess = () => { res[s] = q.result.map(String).map(k => k.replace(/instantanea-.*$/, "instantanea-X").replace(/\d{10,}|-[a-z0-9]{7,}$/g, "X")).sort(); if (--n === 0) ok(res); }; } }; }), base);
}
async function escenario(nombre, fn){
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-CO", timezoneId: "America/Bogota" });
  const p = await ctx.newPage(); const errores = [];
  p.on("pageerror", e => errores.push(e.message));
  await p.addInitScript(() => { localStorage.setItem("lab-reels:ayuda-vista", "true"); localStorage.setItem("backstage:ayuda-vista", "true"); });
  try { out[nombre] = await fn(p); } catch (e) { out[nombre] = { fallo: String(e) }; }
  out[nombre].errores = errores;
  await ctx.close();
  console.log("listo:", nombre, errores.length ? "ERRORES " + errores.length : "");
}
const esperar = (p, ms) => p.waitForTimeout(ms);

await escenario("hoy-22-oct", async p => {
  await p.goto(BASE + "/hoy/22-oct/"); await esperar(p, 17000);
  return { ...(await estado(p)), feed: await texto(p, "#feed") };
});
await escenario("hoy", async p => {
  await p.goto(BASE + "/hoy/"); await esperar(p, 17000);
  const e = await estado(p);
  await p.evaluate(() => enviar({tipo: "perfil", perfil: "admin"})); await esperar(p, 1500);
  return { ...e, feedEmpleado: undefined, feedAdmin: await texto(p, "#feed"), admin: await estado(p) };
});
await escenario("hoy-17-oct", async p => { await p.goto(BASE + "/hoy/17-oct/"); await esperar(p, 17000); return { ...(await estado(p)), feed: await texto(p, "#feed") }; });
await escenario("lista-a-mano", async p => { await p.goto(BASE + "/lab-reels/?lista=listas/lista-a-mano.txt"); await esperar(p, 18000); return { ...(await estado(p)), feed: await texto(p, "#feed"), idb: await idbClaves(p, "backline-fotos") }; });
await escenario("backstage", async p => { await p.goto(BASE + "/lab-reels/backstage.html?lista=listas/lista-a-mano.txt"); await esperar(p, 20000); return { ...(await estado(p)), feed: await texto(p, "#feed"), idb: await idbClaves(p, "backstage-fotos") }; });
await escenario("chulo-y-nota", async p => {
  await p.goto(BASE + "/hoy/22-oct/"); await esperar(p, 17000);
  const id = await p.evaluate(() => V.doc.datos.items.find(x => /Snare stand/i.test(x.referencia)).id);
  await p.evaluate(i => marcarChulo(i), id); await esperar(p, 800);
  const sec = await p.evaluate(() => { const x = V.doc.datos.items[0]; return `${x.artistaId}|${x.grupo}`; });
  // nota escrita y guardada en la primera sección
  await p.evaluate(s => { const t = document.querySelector(`[data-nota-texto="${CSS.escape(s)}"]`); if (t) { t.value = "Nota de prueba"; t.dispatchEvent(new Event("input", {bubbles: true})); } }, sec);
  await p.evaluate(s => typeof guardarNota === "function" && guardarNota(s), sec); await esperar(p, 800);
  await p.reload(); await esperar(p, 15000);
  return { ...(await estado(p)), chulosTrasRecargar: await p.evaluate(() => [...chulos].length), feed: await texto(p, "#feed") };
});
await escenario("subir-rider", async p => {
  await p.goto(BASE + "/lab-reels/#intro"); await esperar(p, 6000);
  const [fc] = await Promise.all([p.waitForEvent("filechooser", { timeout: 15000 }), p.evaluate(() => document.getElementById("archivo").click())]);
  await fc.setFiles(RIDER); await esperar(p, 25000);
  return { ...(await estado(p)), feed: await texto(p, "#feed") };
});
await escenario("don-teto", async p => { await p.goto(BASE + "/don-teto/"); await esperar(p, 18000); return { ...(await estado(p)), feed: await texto(p, "#feed") }; });
await escenario("aviso-evento", async p => {
  await p.goto(BASE + "/hoy/17-oct/"); await esperar(p, 15000);
  await p.goto(BASE + "/lab-reels/"); await esperar(p, 8000);
  return { doc: await p.evaluate(() => V.doc?.nombre), aviso: limpiar(await p.evaluate(() => document.getElementById("evento-nuevo")?.innerText || "")) };
});
await escenario("propio-y-aviso", async p => {
  await p.goto(BASE + "/lab-reels/#intro"); await esperar(p, 6000);
  const [fc] = await Promise.all([p.waitForEvent("filechooser", { timeout: 15000 }), p.evaluate(() => document.getElementById("archivo").click())]);
  await fc.setFiles(RIDER); await esperar(p, 22000);
  await p.goto(BASE + "/lab-reels/"); await esperar(p, 9000);
  return { doc: await p.evaluate(() => V.doc?.nombre), aviso: limpiar(await p.evaluate(() => document.getElementById("evento-nuevo")?.innerText || "")) };
});
for (const [n, url] of [["planilla", "/planilla/"], ["cronograma", "/cronograma/"], ["entrenar", "/entrenar/"], ["home", "/"]]) {
  await escenario(n, async p => { await p.goto(BASE + url); await esperar(p, 5000); return { titulo: await p.title(), texto: (await texto(p, "body")).slice(0, 3000) }; });
}
fs.writeFileSync(SALIDA, JSON.stringify(out, null, 1));
await b.close();
console.log("guardado", SALIDA);
