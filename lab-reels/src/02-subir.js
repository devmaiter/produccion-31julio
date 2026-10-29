/* ── Reel 0: subir un documento ── */
const subida = {estado: "inicio", archivos: [], resultado: null, error: ""};
/* Subir un documento, explicado como un reel (lo pidió el usuario: "el usuario no entiende de programación,
   que sea como un juego que le explique"). Tres escenas que se repiten: el rider entra, la app lo lee y
   sale el backline como en la planilla. Leyendo un archivo de verdad se queda en la segunda. */
const ESCENAS = ["Sube el rider de la banda", "La app lo lee por ti", "Y te sale el backline, listo para revisar"];
function htmlTutorial(leyendo){
  const filas = [["1", "Bombo 22”"], ["1", "Redoblante 14”"], ["2", "Tom 10” · 12”"], ["4", "Bases de platillo"], ["1", "Ampeg SVT + 8x10"]];
  const papel = `<span class="tuto-papel"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>`;
  return `
      <div class="tuto${leyendo ? " leyendo" : ""}" aria-hidden="true">
        ${leyendo ? "" : `<div class="tuto-prog"><i></i><i></i><i></i></div>`}
        <div class="tuto-escena e1"><span class="tuto-zona">${papel}</span></div>
        <div class="tuto-escena e2">${papel.replace("tuto-papel", "tuto-papel leido")}<span class="tuto-linea"></span></div>
        <div class="tuto-escena e3"><div class="tuto-hoja">${filas.map(([q, t], k) => `<p style="--k:${k}"><b>${q} x</b><span>${t}</span></p>`).join("")}</div></div>
      </div>
      ${leyendo ? "" : `<div class="tuto-textos" aria-live="off">${ESCENAS.map((t, k) => `<p class="t${k + 1}"><b>${k + 1}</b>${t}</p>`).join("")}</div>`}`;
}
/* La entrada (lo pidió el usuario): el texto se escribe solo, letra por letra, para que se lea; después
   se borra y quedan solo los dos botones, sin texto fijo. El escáner es la espera mientras se lee el
   documento, y el holograma presenta lo que se encontró. Tocar la pantalla salta la escritura. */
const ICONO_RIDER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5"/><path d="M12 18v-6.5"/><path d="m9 14 3-3 3 3"/></svg>`;
const ICONO_CAMARA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5h-5L7.5 7H4.5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/></svg>`;
/* El mensaje de bienvenida (lo pidió el usuario: que a cualquier persona del equipo le guste leerlo).
   Saluda según la hora, como un compañero; reconoce el oficio (el que monta sabe, la app solo le
   quita leer el rider renglón por renglón); dice el beneficio concreto; y el cierre cambia en cada
   visita para que no se vuelva paisaje. Al admin le habla del evento que organiza. */
const CIERRES = [
  "Súbelo y en segundos tienes el backline listo para montar.",
  "Menos tiempo leyendo PDF, más tiempo en la tarima.",
  "Rider en mano, backline en segundos.",
  "Tú pones el oficio. Nosotros leemos la letra pequeña.",
  "Llega a la prueba de sonido sabiendo qué va en cada lugar.",
];
function frasesBienvenida(){
  const h = new Date().getHours();
  const saludo = h < 12 ? "Buen día, equipo." : h < 19 ? "Buenas tardes, equipo." : "Buenas noches, equipo.";
  const evento = leer(P + "evento", "");
  const admin = V?.perfil === "admin";
  const medio = evento ? `Hoy toca ${evento}.` : admin ? "Tú organizas el evento; nosotros leemos los riders." : "Sube el rider de la banda; nosotros lo leemos por ti.";
  const visitas = leer(P + "visitas", 0);
  escribir(P + "visitas", visitas + 1);
  return [saludo, medio, CIERRES[visitas % CIERRES.length]];
}
function htmlIntro(){
  return `
      <div class="intro" data-fase="1">
        <p class="intro-escribe" aria-live="polite"><span class="txt"></span><span class="cursor" aria-hidden="true"></span></p>
        <div class="intro-final">
          <div class="acciones-subir">
            <button class="accion-subir principal" data-acc="elegir">${ICONO_RIDER}<span>Subir rider</span><small>PDF, Excel o correo</small></button>
            <button class="accion-subir" data-acc="foto">${ICONO_CAMARA}<span>Tomar foto</span><small>De la hoja impresa</small></button>
          </div>
        </div>
      </div>`;
}
let introTimers = [], introHecha = false;
function correrIntro(){
  const el = document.querySelector("#subir .intro");
  if (!el || el.dataset.corriendo) return;
  el.dataset.corriendo = "1";
  introTimers.forEach(clearTimeout); introTimers = [];
  const txt = el.querySelector(".txt");
  const final = () => { introTimers.forEach(clearTimeout); el.dataset.fase = "3"; };
  // Se escribe una vez por visita: si la pantalla se vuelve a dibujar (filtros, perfil), queda en el final.
  if (QUIETO || introHecha) return final();
  introHecha = true;
  // Escribe cada frase letra por letra, la deja leer y la borra.
  let t = 400;
  for (const frase of frasesBienvenida()) {
    for (let i = 1; i <= frase.length; i++) { const k = i; introTimers.push(setTimeout(() => { txt.textContent = frase.slice(0, k); }, t)); t += 38; }
    t += 900 + frase.length * 18;
    introTimers.push(setTimeout(() => { el.dataset.fase = "2"; }, t));
    t += 450;
    introTimers.push(setTimeout(() => { txt.textContent = ""; el.dataset.fase = "1"; }, t));
    t += 250;
  }
  introTimers.push(setTimeout(final, t));
  el.addEventListener("click", e => { if (el.dataset.fase !== "3" && !e.target.closest("button")) final(); });
}
function htmlSubir(){
  const s = subida;
  const pie = "";
  const lista = s.archivos.length ? `<ul class="archivos">${s.archivos.map(a => `<li class="${a.clase}"><span>${esc(a.nombre)}</span><span>${esc(a.estado)}</span></li>`).join("")}</ul>` : "";
  let cuerpo;
  if (s.estado === "leyendo") cuerpo = `
      ${htmlTutorial(true)}
      <h2>Leyendo<em>…</em></h2>
      <p class="sub" id="lento">Todo pasa en este dispositivo. Una foto tarda más porque hay que reconocer las letras.</p>${lista}`;
  else if (s.estado === "error") cuerpo = `
      <div class="encontre" aria-hidden="true"><strong>⚠</strong></div>
      <h2>${esc(s.error.titulo)}</h2>
      <p class="sub">${esc(s.error.texto)}</p>
      ${s.error.avisos?.length ? `<ul class="archivos">${s.error.avisos.slice(0, 6).map(a => `<li><span>${esc(a)}</span></li>`).join("")}</ul>` : ""}
      <div class="botones"><button class="btn" data-acc="elegir">Probar con otro archivo</button></div>${lista}`;
  else if (s.estado === "listo") {
    const r = s.resultado;
    cuerpo = `
      <div class="resultado-holo"><div class="holo" data-cat="Tarima"><div class="emoji" aria-hidden="true">🥁</div></div></div>
      <div class="encontre"><strong data-to="${r.bandas}">${r.bandas}</strong></div>
      <h2>${r.bandas === 1 ? "Banda" : "Bandas"} <em>${r.bandas === 1 ? "encontrada" : "encontradas"}</em></h2>
      ${r.dudosos || r.avisos ? `<p class="sub">${[r.dudosos ? `${r.dudosos} por confirmar` : "", r.avisos ? `${r.avisos} ${r.avisos === 1 ? "aviso" : "avisos"} del lector` : ""].filter(Boolean).join(" · ")}</p>` : ""}
      <div class="botones"><button class="btn" data-acc="ver">Ver mis reels ${PC ? "↓" : "↑"}</button><button class="btn sec" data-acc="otro">Subir otro</button></div>${lista}`;
  } else cuerpo = htmlIntro() + lista;
  return `
  <article class="reel subir" id="subir" data-n="1" aria-label="Subir documento">
    <div class="slides"><section class="slide">
      ${cuerpo}
      ${pie}
    </section></div>
    <input type="file" id="archivo" hidden multiple accept=".pdf,.xlsx,.xls,.csv,.txt,.eml,image/*">
    <input type="file" id="camara" hidden accept="image/*" capture="environment">
  </article>`;
}

function htmlReel(c, i, total){
  const n = 1 + c.bandas.length;
  const dias = Object.entries(c.bandasPorDia).map(([id,q]) => `<span class="chip">${esc(c.corto[id])} · ${q} ${q === 1 ? "banda" : "bandas"}</span>`).join("");
  const max = Math.max(1, ...c.resumen.map(r => r.q));
  const resumen = c.resumen.map(r => `<li><span class="q">${r.q}</span><span class="t">${esc(r.ref)}<div class="barra" style="width:${Math.max(8, 100*r.q/max)}%"></div></span></li>`).join("");
  const bandas = c.bandas.map(b => `
    <section class="slide banda">
      ${b.plot ? `<div class="fondo" style="background-image:url('${esc(b.plot)}')"></div>` : ""}
      <h3>${esc(b.nombre)}</h3>
      <p class="sub"><span class="hora">${esc(b.dia)}${b.show ? " · " + esc(b.show.inicio) : ""}</span> · ${b.items.reduce((s,x)=>s+x.cantidad,0)} piezas</p>
      ${b.plot ? `<img class="plot" src="${esc(b.plot)}" alt="Stage plot de ${esc(b.nombre)}" loading="lazy">` : ""}
      ${htmlFicha(b, c.cat)}
    </section>`).join("");
  return `
  <article class="reel" id="${c.id}" style="--h:${HUE[sinNum(c.cat)] ?? 20}" data-n="${n}" aria-label="${esc(c.cat)}">
    <div class="prog">${"<i></i>".repeat(n)}</div>
    <div class="cab"><b>${esc(c.cat)}</b><span class="n">${i+1}/${total}</span></div>
    <div class="slides">
      <section class="slide portada">
        <div class="holo" data-cat="${esc(c.holo)}"><div class="emoji" aria-hidden="true">${EMOJI[sinNum(c.cat)] || "📦"}</div></div>
        ${htmlOrigen()}
        <h2>${esc(c.cat)}</h2>
        <div class="big"><strong data-to="${c.equipos}">${c.equipos}</strong><span>${c.equipos === 1 ? "banda" : "bandas"}</span></div>
        <div class="dias">${dias}${c.dudosos ? `<span class="chip warn">${c.dudosos} por confirmar</span>` : ""}</div>
        <p class="pista">${PC ? "Pasa con › para ver banda por banda" : "Desliza para ver banda por banda"} <span class="flecha">→</span></p>
        <button class="ver-totales" aria-expanded="false">Totales de fondo ›</button>
        <div class="totales" hidden>
          <button class="cerrar">Cerrar ✕</button>
          <p class="sub">Por referencia, todas las bandas: se suma dentro del día y se toma el máximo entre días. ${c.aTener} piezas.</p>
          <ul class="lista">${resumen}</ul>
        </div>
      </section>
      ${bandas}
    </div>
    <button class="pasar ant" aria-label="Anterior" disabled>‹</button>
    <button class="pasar sig" aria-label="Siguiente">›</button>
  </article>`;
}
