/* El lector de PDF usa Map.getOrInsert(Computed), que solo traen los navegadores más nuevos. */
for (const C of [Map, WeakMap]) {
  if (!C.prototype.getOrInsertComputed) C.prototype.getOrInsertComputed = function(k, f){ if (!this.has(k)) this.set(k, f(k)); return this.get(k); };
  if (!C.prototype.getOrInsert) C.prototype.getOrInsert = function(k, v){ if (!this.has(k)) this.set(k, v); return this.get(k); };
}
const BASE_IMG = "../extractor/data/";
const LECTOR = new URL(ENTORNO.rutas.lector, location.href).href;   // el mismo lector de "Subir documento"
const MUESTRA = "../extractor/muestras/hoja-backline.pdf";
const ORDEN = ["Batería","Platillos","Percusión","Teclado","Ampli bajo","Ampli guitarra","Guitarra","Bajo","Vientos","Voces","Bases","In ears","Consolas","Escenario","Cables y energía","DJ","Otro"];
const EMOJI = {"Batería":"🥁","Platillos":"🔔","Percusión":"🪘","Teclado":"🎹","Ampli bajo":"🔊","Ampli guitarra":"📢","Guitarra":"🎸","Bajo":"🎸","Bases":"🎙️","Escenario":"🏗️","Cables y energía":"🔌","DJ":"🎧","In ears":"🎧","Consolas":"🎛️","Vientos":"🎷","Voces":"🎤","Extras":"✨","Otro":"📦"};
const HUE = {"Batería":20,"Platillos":45,"Percusión":5,"Teclado":265,"Ampli bajo":200,"Ampli guitarra":340,"Guitarra":30,"Bajo":180,"Bases":220,"Escenario":120,"Cables y energía":55,"DJ":290,"In ears":175,"Consolas":235,"Vientos":40,"Voces":310,"Extras":150,"Otro":0};
const PC = matchMedia("(hover: hover) and (pointer: fine)").matches;
const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;
// ?demo=backstage (el link corto backstage/): la presentación para Backstage Company al abrir.
// Una copia con otra marca (backstage.html, la arma hacer-marcas.py) trae window.MARCA: su logo en el arranque y en
// la presentación, sin Circuito, y sus datos aparte en el celular.
const MARCA = ENTORNO.marca;
// Claves del almacenamiento: "<prefijo>:<nombre>" (el prefijo depende de la marca; ver entorno.js).
const P = ENTORNO.claves.app + ":", PREFIJOS = new RegExp("^(" + Object.values(ENTORNO.claves).join("|") + "):");
const DEMO = MARCA ? "backstage" : new URLSearchParams(location.search).get("demo") || (location.hash === "#presentacion" ? "backstage" : "");

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
// Todo lo guardado pasa por el almacén (plataforma/almacen.js): la app no sabe si queda en el celular o en un servidor.
const leer = Almacen.leer, escribir = Almacen.escribir;
// Las ayudas ("Baja con ↓…", "Pasa con ›…") salen solo la primera vez que se abren los reels (lo pidió el usuario).
const AYUDA = !leer(P + "ayuda-vista", false);
escribir(P + "ayuda-vista", true);
if (!AYUDA) document.getElementById("teclas")?.remove();

function aviso(t){
  const a = document.createElement("div"); a.className = "aviso"; a.textContent = t;
  document.body.append(a); setTimeout(() => a.remove(), 1800);
}
