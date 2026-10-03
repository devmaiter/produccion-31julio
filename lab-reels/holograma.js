/* Holograma 3D para la portada de cada reel. Usa el Three.js y el mismo shader de
   ../reconocimiento-3d (borde fresnel, líneas de barrido y el corte que lo dibuja de abajo
   hacia arriba). Un solo lienzo WebGL que se mueve al reel visible: los navegadores
   permiten pocos contextos y doce reels con su propio WebGL se caerían en el celular. */
import * as THREE from "../reconocimiento-3d/vendor/three.js";
import { RoundedBoxGeometry } from "../reconocimiento-3d/vendor/three.js";
import { receta } from "./receta.js";

const COLOR = 0xff7a2e;

const holoU = { uColor: { value: new THREE.Color(COLOR) }, uTiempo: { value: 0 }, uRevela: { value: 10 } };
const vertHolo = `
  varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz;
    vec4 mv = viewMatrix * w; vV = -mv.xyz;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;
const fragComun = `
  uniform vec3 uColor; uniform float uTiempo, uRevela; varying vec3 vW;
  float banda(){ float y = fract(uTiempo * .22) * 3.4 - .4; return exp(-pow((vW.y - y) * 7., 2.)); }
  float frente(){ return smoothstep(.07, 0., uRevela - vW.y); }`;
const matHolo = new THREE.ShaderMaterial({
  uniforms: holoU, vertexShader: vertHolo, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  fragmentShader: fragComun + `
    varying vec3 vN; varying vec3 vV;
    void main(){
      if (vW.y > uRevela) discard;
      float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.2);
      float lin = smoothstep(.55, 1., sin(vW.y * 140. - uTiempo * 5.)) * .22;
      float a = .05 + f * .6 + lin + banda() * .3 + frente() * .9;
      gl_FragColor = vec4(uColor * (.55 + f * 1.2 + frente() * 2.), a);
    }`,
});
const matLinea = new THREE.ShaderMaterial({
  uniforms: holoU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: fragComun + `
    void main(){
      if (vW.y > uRevela) discard;
      gl_FragColor = vec4(uColor * (1.3 + banda() + frente() * 2.), .75 + banda() * .25);
    }`,
});

/* Piezas, igual que en reconocimiento-3d */
const ARRIBA = new THREE.Vector3(0, 1, 0);
function pieza(g, geo, x, y, z, rx = 0, ry = 0, rz = 0, umbral = 28) {
  const m = new THREE.Mesh(geo, matHolo);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, umbral), matLinea));
  g.add(m); return m;
}
const caja = (w, h, d, r = .015) => new RoundedBoxGeometry(w, h, d, 2, r);
const cil = (rt, rb, h, s = 32) => new THREE.CylinderGeometry(rt, rb, h, s);
const aro = (r, t = .008) => new THREE.TorusGeometry(r, t, 6, 48);
function barra(g, a, b, r = .012) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = pieza(g, cil(r, r, d.length(), 8), 0, 0, 0, 0, 0, 0, 70);
  m.position.copy(A).add(B).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(ARRIBA, d.normalize());
  return m;
}
function contorno(g, geo, x, y, z) { // solo las aristas: superficies grandes con brillo aditivo tapan todo
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), matLinea); l.position.set(x, y, z); g.add(l);
}
const tripode = (g, x, y, z, r = .2) => { for (const a of [0, 2.1, 4.2]) barra(g, [x, y, z], [x + Math.cos(a) * r, 0, z + Math.sin(a) * r]); };
function perillas(g, n, x0, paso, y, z, r = .014) { for (let i = 0; i < n; i++) pieza(g, cil(r, r, .02, 16), x0 + i * paso, y, z, Math.PI / 2); }
function cono(g, r, x, y, z) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  pieza(p, aro(r), 0, 0, 0);
  pieza(p, new THREE.CylinderGeometry(r * .3, r * .95, r * .35, 32, 1, true), 0, 0, -r * .17, -Math.PI / 2);
  pieza(p, new THREE.SphereGeometry(r * .28, 16, 8, 0, 6.283, 0, 1.2), 0, 0, -r * .2, Math.PI / 2);
}
/* Platillo en su base, mirando hacia el baterista (en `mira`). La china va al revés. */
const PULG = {crash: 17, ride: 21, splash: 10, china: 18};
const ALTO = {crash: 1.42, ride: 1.2, splash: 1.28, china: 1.38};
function platilloEnBase(g, x, z, p, mira) {
  const r = (p.pulgadas || PULG[p.tipo] || 17) * .0127, h = ALTO[p.tipo] || 1.4;
  const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = Math.atan2(mira[0] - x, mira[1] - z); g.add(b);
  pieza(b, p.tipo === "china" ? cil(r, .02, .035) : cil(.012, r, .025), 0, h, 0, .3);
  barra(b, [0, .3, -.18], [0, h - .3, -.12]); barra(b, [0, h - .3, -.12], [0, h - .02, 0]);
  tripode(b, 0, .3, -.18);
}
/* Bases de platillo en arco detrás del set, de izquierda a derecha. */
function arcoPlatillos(g, lista, {cx = 0, cz = .25, rx = .9, rz = .6, mira = [0, .82], dx = 0} = {}) {
  const n = lista.length;
  lista.forEach((p, i) => {
    const a = n === 1 ? .75 * Math.PI : n === 2 ? [.75, .2][i] * Math.PI : (.9 - i * .82 / (n - 1)) * Math.PI;
    const x = cx + rx * Math.cos(a), z = cz - rz * Math.sin(a);
    platilloEnBase(g, x + Math.sign(x) * dx, z, p, mira);
  });
}
function hihat(g, x, z, r, alto = .96) {
  pieza(g, cil(r, r, .012), x, alto, z); pieza(g, cil(r, r, .012), x, alto + .03, z);
  barra(g, [x, 0, z], [x, alto, z]); tripode(g, x, .3, z);
}

/* Cada equipo. La batería sigue la foto de referencia (tarima con tapete, bombo con hueco,
   toms montados en el bombo, tom de piso a la derecha, redoblante y hi-hat a la izquierda,
   platillos y silla) y se arma con la receta del listado: tantos toms, pisos y bases de
   platillo como diga. Sin receta sale el formato de siempre (ver receta.js). */
const KIT = {bombos: [22], toms: [10, 12], pisos: [16], redoblante: 14, hihat: 14, platillos: [{tipo: "crash"}, {tipo: "ride"}]};
const CONSTRUIR = {
  bateria(g, k = KIT) {
    const dx = k.bombos.length > 1 ? .21 : 0, pulg = n => n * .0127;
    contorno(g, new THREE.BoxGeometry(2.5 + dx * 2, .2, 2.05), 0, .1, .25);  // tarima
    contorno(g, new THREE.BoxGeometry(2.05 + dx * 2, .01, 1.6), 0, .205, .3); // tapete
    const kit = new THREE.Group(); kit.position.y = .21; g.add(kit);
    let alto = 0;
    k.bombos.forEach((p, i) => {                                   // bombo(s)
      const rb = pulg(p || 22), x = k.bombos.length > 1 ? (i ? dx : -dx) : 0;
      alto = Math.max(alto, rb * 2);
      pieza(kit, cil(rb, rb, .42), x, rb + .01, 0, Math.PI / 2);
      pieza(kit, aro(rb, .012), x, rb + .01, .21); pieza(kit, aro(rb, .012), x, rb + .01, -.21);
      pieza(kit, aro(.07, .006), x + .1, rb * .75, -.215);           // hueco del parche frontal
      barra(kit, [x - rb * .62, .05, .3], [x - rb * .83, 0, .38]); barra(kit, [x + rb * .62, .05, .3], [x + rb * .83, 0, .38]);
      const pedales = k.doblePedal && k.bombos.length === 1 ? [-.07, .07] : [0];
      for (const px of pedales) { pieza(kit, caja(.1, .02, .26, .006), x + px, .012, .36); barra(kit, [x + px, .03, .26], [x + px * .3, rb + .01, .22], .008); }
    });
    const n = k.toms.length, sep = n > 2 ? .34 : .35;               // toms montados
    k.toms.forEach((p, i) => {
      const r = pulg(p || 12), x = n === 1 ? .04 : (i - (n - 1) / 2) * sep, lejos = Math.abs(x) > .4;
      const y = alto + .19 - (lejos ? .05 : 0), z = lejos ? .12 : .04;
      pieza(kit, cil(r, r, r * 1.35), x, y, z, .35, 0, -x * .35);
      if (lejos) { barra(kit, [x, y - .1, z - .05], [x, .3, z - .12]); tripode(kit, x, .3, z - .12, .16); }
      else barra(kit, [0, alto, 0], [x * .75, y - .06, z - .02]);
    });
    const rs = pulg(k.redoblante || 14), zs = n > 2 ? .4 : .32;      // redoblante
    pieza(kit, cil(rs, rs, .14), -.46 - dx, .66, zs, .12); tripode(kit, -.46 - dx, .58, zs);
    if (k.redoblante2) { const r2 = pulg(k.redoblante2); pieza(kit, cil(r2, r2, .13), -1.1 - dx, .7, .45, .15, 0, .1); tripode(kit, -1.1 - dx, .62, .45); } // segundo redoblante
    [[.5, .34], [.8, -.06], [.97, .4]].slice(0, k.pisos.length).forEach(([x, z], i) => { // tom(s) de piso
      const r = pulg(k.pisos[i] || 16), h = Math.min(.46, r * 1.9); x += dx;
      pieza(kit, cil(r, r, h), x, .25 + h / 2, z);
      for (const a of [.8, 2.4, 4.2]) barra(kit, [x + Math.cos(a) * (r + .02), .35, z + Math.sin(a) * (r + .02)], [x + Math.cos(a) * (r + .08), 0, z + Math.sin(a) * (r + .08)]);
    });
    hihat(kit, -.78 - dx, .2, pulg(k.hihat || 14));                 // hi-hat
    pieza(kit, caja(.09, .02, .24, .006), -.74 - dx, .012, .4);
    if (k.xhat) { pieza(kit, cil(.15, .15, .012), .28 + dx, .98, .58); pieza(kit, cil(.15, .15, .012), .28 + dx, 1.01, .58); barra(kit, [.28 + dx, .3, .58], [.28 + dx, .98, .58]); tripode(kit, .28 + dx, .3, .58, .15); }
    if (k.pad) { pieza(kit, caja(.3, .04, .22, .01), -.7 - dx, .9, .64, .35, -.6); barra(kit, [-.7 - dx, .3, .64], [-.7 - dx, .88, .64]); tripode(kit, -.7 - dx, .3, .64, .16); }
    arcoPlatillos(kit, k.platillos, {dx});                           // una base por platillo
    pieza(kit, cil(.19, .19, .08), 0, .55, .82);                     // silla
    barra(kit, [0, .51, .82], [0, .12, .82]); tripode(kit, 0, .12, .82, .25);
  },
  platillos(g, r = {hihat: true, platillos: [{tipo: "crash"}, {tipo: "crash"}, {tipo: "ride"}]}) {
    arcoPlatillos(g, r.platillos, {cz: .35, rx: .75, rz: .55, mira: [0, .9]});
    if (r.hihat) hihat(g, 0, .45, .18, .95);
  },
  percusion(g, r = {congas: 3, platillos: []}) {
    // Cada instrumento en su sitio, en fila de izquierda a derecha; los platillos atrás.
    const fila = [];
    if (r.congas) fila.push([.4 * r.congas, x => {
      const altos = [.72, .78, .74, .7], radios = [.3, .32, .3, .28];
      for (let i = 0; i < r.congas; i++) {
        const cx = x + (i - (r.congas - 1) / 2) * .4, z = i % 2 ? -.12 : .1, h = altos[i], rr = radios[i];
        pieza(g, cil(rr * .82, rr * .62, h), cx, .3 + h / 2, z);
        pieza(g, aro(rr * .82, .012), cx, .3 + h, z, Math.PI / 2);
        pieza(g, aro(rr * .62, .01), cx, .3, z, Math.PI / 2);
        tripode(g, cx, .32, z, .22);
      }
    }]);
    for (let i = 0; i < (r.bongos || 0); i++) fila.push([.5, x => {
      pieza(g, cil(.1, .09, .16), x - .12, .82, 0); pieza(g, cil(.125, .11, .17), x + .12, .82, 0);
      pieza(g, caja(.08, .05, .06, .01), x, .8, 0); barra(g, [x, .78, 0], [x, .3, 0]); tripode(g, x, .3, 0, .2);
    }]);
    for (let i = 0; i < (r.djembe || 0); i++) fila.push([.45, x => {
      pieza(g, cil(.07, .15, .3), x, .15, 0); pieza(g, cil(.17, .08, .34), x, .47, 0);
      pieza(g, aro(.17, .012), x, .64, 0, Math.PI / 2);
    }]);
    for (let i = 0; i < (r.timbales || 0); i++) fila.push([.75, x => {
      pieza(g, cil(.17, .17, .17), x - .2, .92, 0); pieza(g, cil(.19, .19, .17), x + .2, .92, 0);
      barra(g, [x - .2, .83, 0], [x + .2, .83, 0]); barra(g, [x, .83, 0], [x, .3, 0]); tripode(g, x, .3, 0, .22);
    }]);
    for (let i = 0; i < (r.cajon || 0); i++) fila.push([.4, x => {
      pieza(g, caja(.3, .48, .3, .01), x, .24, 0); pieza(g, aro(.05, .006), x, .32, -.151);
    }]);
    for (let i = 0; i < (r.mesa || 0); i++) fila.push([.75, x => {
      pieza(g, caja(.6, .03, .4, .006), x, .85, 0);
      for (const [a, b] of [[-.27, -.17], [.27, -.17], [-.27, .17], [.27, .17]]) barra(g, [x + a, .84, b], [x + a, 0, b], .01);
    }]);
    let x = -fila.reduce((s, [w]) => s + w, 0) / 2;
    for (const [w, dibujar] of fila) { dibujar(x + w / 2); x += w; }
    if (r.platillos?.length) arcoPlatillos(g, r.platillos, {cz: .2, rx: Math.max(.8, -x + .2), rz: .75, mira: [0, 1.3]});
  },
  amp(g) {
    pieza(g, caja(.72, .56, .28, .03), 0, .28, 0);
    pieza(g, caja(.64, .36, .012, .004), 0, .22, .14);
    cono(g, .12, -.16, .22, .15); cono(g, .12, .16, .22, .15);
    pieza(g, caja(.64, .09, .012, .004), 0, .46, .14);
    perillas(g, 9, -.26, .065, .46, .155);
    pieza(g, caja(.2, .025, .05, .01), 0, .575, 0);
  },
  bajo(g) {
    pieza(g, caja(.62, 1.22, .42, .03), 0, .65, 0);
    for (let f = 0; f < 4; f++) for (const x of [-.145, .145]) cono(g, .115, x, .24 + f * .27, .215);
    pieza(g, caja(.62, .22, .34, .02), 0, 1.38, -.02);
    pieza(g, caja(.56, .11, .01, .004), 0, 1.38, .155);
    perillas(g, 10, -.24, .053, 1.38, .165, .012);
  },
  teclado(g) {
    pieza(g, caja(1.34, .11, .34, .02), 0, .84, 0);
    pieza(g, caja(1.22, .025, .16, .004), 0, .9, .07);
    const negra = new THREE.BoxGeometry(.012, .018, .09);
    for (let i = 0; i < 51; i++) if ([0, 2, 3, 5, 6].includes((i + 5) % 7)) pieza(g, negra, -.61 + (i + 1) * 1.22 / 52, .925, .03);
    for (const x of [-.45, .45]) { barra(g, [x, 0, .17], [x, .78, -.15], .016); barra(g, [x, 0, -.17], [x, .78, .15], .016); }
    barra(g, [-.45, .39, 0], [.45, .39, 0], .016);
  },
  guitarra(g) {
    const s = new THREE.Shape();
    s.moveTo(0, -.24);
    s.bezierCurveTo(.22, -.24, .22, -.05, .13, 0); s.bezierCurveTo(.1, .04, .14, .13, .16, .21);
    s.bezierCurveTo(.11, .25, .06, .12, .03, .11); s.lineTo(-.03, .11);
    s.bezierCurveTo(-.08, .13, -.1, .3, -.16, .27); s.bezierCurveTo(-.21, .22, -.12, .06, -.14, 0);
    s.bezierCurveTo(-.22, -.06, -.2, -.24, 0, -.24);
    const geo = new THREE.ExtrudeGeometry(s, { depth: .045, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 2, curveSegments: 28 });
    geo.translate(0, 0, -.0225);
    const gt = new THREE.Group(); gt.position.set(0, .36, 0); gt.rotation.x = -.22; g.add(gt);
    pieza(gt, geo, 0, 0, 0, 0, 0, 0, 40);
    pieza(gt, caja(.052, .62, .025, .006), 0, .42, .01);
    pieza(gt, caja(.085, .19, .016, .008), .008, .82, .005, 0, 0, -.05);
    barra(g, [-.18, 0, .18], [-.04, .7, -.06]); barra(g, [.18, 0, .18], [.04, .7, -.06]); barra(g, [0, 0, -.25], [0, .7, -.08]);
  },
  base(g, r) { // sin receta: base de micrófono tipo boom
    if (!r || !Object.keys(r).length) return BASES.microfono(g);
    // Hasta 20 piezas: con más, el holograma ya no se lee. Si sobran, se quitan del tipo que
    // más tiene, así cada tipo de base de la lista sigue saliendo al menos una vez.
    const n = Object.fromEntries(Object.keys(BASES).map(t => [t, Math.min(r[t] || 0, 8)]));
    for (let total = Object.values(n).reduce((a, b) => a + b, 0); total > 20; total--) {
      const t = Object.keys(n).reduce((a, b) => n[b] > n[a] ? b : a); n[t]--;
    }
    const lista = Object.keys(BASES).flatMap(t => Array(n[t]).fill(t));
    if (!lista.length) return BASES.microfono(g);
    const porFila = Math.ceil(Math.sqrt(lista.length * 1.6));
    for (let f = 0; f * porFila < lista.length; f++) {
      const fila = lista.slice(f * porFila, (f + 1) * porFila);
      const total = fila.reduce((s, t) => s + ANCHO[t], 0);
      let x = -total / 2;
      for (const t of fila) {
        const p = new THREE.Group(); p.position.set(x + ANCHO[t] / 2, 0, -f * .75); g.add(p);
        BASES[t](p); x += ANCHO[t];
      }
    }
  },
};

/* Cada tipo de base, dibujada en su sitio. ANCHO = cuánto ocupa en la fila. */
const ANCHO = {platillo: .55, hihat: .45, redoblante: .45, silla: .5, microfono: .95, teclado: 1, guitarra: .42, atril: .5, taburete: .5, otra: .4};
const BASES = {
  platillo(g) {
    tripode(g, 0, .3, 0, .2); barra(g, [0, .3, 0], [0, 1.1, 0], .013); barra(g, [0, 1.1, 0], [.18, 1.36, 0], .011);
    pieza(g, cil(.035, .035, .03, 16), .19, 1.37, 0, 0, 0, -.6);
  },
  hihat(g) {
    tripode(g, 0, .3, 0, .18); barra(g, [0, 0, 0], [0, .92, 0], .014); barra(g, [0, .92, 0], [0, 1.1, 0], .007);
    pieza(g, cil(.03, .03, .05, 16), 0, 1.02, 0); pieza(g, caja(.09, .02, .24, .006), 0, .012, .2);
  },
  redoblante(g) {
    tripode(g, 0, .3, 0, .18); barra(g, [0, .3, 0], [0, .56, 0], .013);
    pieza(g, aro(.13, .009), 0, .6, 0, Math.PI / 2);
    for (const a of [0, 2.1, 4.2]) barra(g, [0, .56, 0], [Math.cos(a) * .13, .6, Math.sin(a) * .13], .007);
  },
  silla(g) { pieza(g, cil(.19, .19, .08), 0, .55, 0); barra(g, [0, .51, 0], [0, .12, 0]); tripode(g, 0, .12, 0, .25); },
  microfono(g) {
    tripode(g, 0, .42, 0, .36);
    barra(g, [0, .42, 0], [0, 1.22, 0], .014);
    barra(g, [-.36, 1.04, 0], [.46, 1.48, 0], .011);
    pieza(g, cil(.045, .045, .08, 16), -.36, 1.04, 0, 0, 0, 1.07);
    const m = new THREE.Group(); m.position.set(.5, 1.5, 0); m.rotation.z = -1.57; g.add(m);
    pieza(m, cil(.024, .017, .14, 20), 0, 0, 0);
    pieza(m, new THREE.SphereGeometry(.034, 20, 12), 0, .095, 0);
  },
  teclado(g) {
    for (const x of [-.4, .4]) { barra(g, [x, 0, .17], [x, .78, -.15], .016); barra(g, [x, 0, -.17], [x, .78, .15], .016); }
    barra(g, [-.4, .39, 0], [.4, .39, 0], .016);
    for (const z of [-.15, .15]) barra(g, [-.46, .78, z], [.46, .78, z], .01);
  },
  guitarra(g) {
    barra(g, [-.15, 0, .12], [0, .62, -.02]); barra(g, [.15, 0, .12], [0, .62, -.02]); barra(g, [0, 0, -.18], [0, .62, -.02]);
    barra(g, [-.13, .25, .1], [.13, .25, .1], .01);
    pieza(g, aro(.05, .007), 0, .66, -.02, 0, 0, 0);
  },
  atril(g) {
    tripode(g, 0, .3, 0, .2); barra(g, [0, .3, 0], [0, 1.02, 0], .012);
    pieza(g, caja(.44, .3, .012, .004), 0, 1.12, .04, -.5);
  },
  taburete(g) {
    pieza(g, cil(.17, .17, .05), 0, .76, 0);
    for (const a of [.8, 2.4, 3.9, 5.5]) barra(g, [Math.cos(a) * .12, .74, Math.sin(a) * .12], [Math.cos(a) * .22, 0, Math.sin(a) * .22]);
    pieza(g, aro(.19, .008), 0, .3, 0, Math.PI / 2);
  },
  otra(g) { tripode(g, 0, .3, 0, .18); barra(g, [0, .3, 0], [0, .8, 0], .013); pieza(g, caja(.3, .02, .22, .006), 0, .82, 0); },
};

/* Teclados, amplis, guitarras: tantos como diga el listado (hasta 4), en dos filas si son más de dos. */
for (const t of ["teclado", "amp", "bajo", "guitarra"]) {
  const uno = CONSTRUIR[t];
  CONSTRUIR[t] = (g, r) => {
    const n = Math.max(1, Math.min(4, r?.n || 1));
    if (n === 1) return uno(g);
    const partes = [];
    for (let i = 0; i < n; i++) { const p = new THREE.Group(); uno(p); partes.push(p); }
    const tam = new THREE.Box3().setFromObject(partes[0]).getSize(new THREE.Vector3());
    const ancho = tam.x + (t === "guitarra" ? .15 : .1), fondo = tam.z + .35, cols = n > 2 ? 2 : n;
    partes.forEach((p, i) => {
      const f = Math.floor(i / cols), enFila = Math.min(cols, n - f * cols);
      p.position.set((i % cols - (enFila - 1) / 2) * ancho, 0, -f * fondo); g.add(p);
    });
  };
}

export const MODELO = {
  "Batería": "bateria", "Platillos": "platillos", "Percusión": "percusion", "Teclado": "teclado",
  "Ampli bajo": "bajo", "Ampli guitarra": "amp", "Guitarra": "guitarra", "Bajo": "guitarra", "Bases": "base",
};

let renderer, scene, camera, giro, actual = null, t0 = 0, corriendo = false;
const reloj = new THREE.Clock();

function iniciar() {
  const canvas = document.createElement("canvas");
  canvas.className = "lienzo3d";
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, .05, 50);
  camera.position.set(0, 1.55, 5); camera.lookAt(0, 1, 0);
  giro = new THREE.Group(); scene.add(giro);
  const base = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.18, 96).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(base);
}

function tamano() {
  const c = renderer.domElement, p = c.parentElement; if (!p) return;
  const w = p.clientWidth, h = p.clientHeight;
  if (c.width !== Math.round(w * renderer.getPixelRatio()) || c.height !== Math.round(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
}

const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
function cuadro() {
  if (!corriendo) return;
  requestAnimationFrame(cuadro);
  tamano();
  const t = reloj.getElapsedTime();
  holoU.uTiempo.value = t;
  holoU.uRevela.value = quieto ? 10 : -.1 + Math.min(1, (t - t0) / 1.6) * 2.6;
  if (!quieto) giro.rotation.y = .5 + t * .35;
  renderer.render(scene, camera);
}

/* Pone el holograma de `tipo` dentro de `contenedor` y lo dibuja desde abajo. Con `items`
   (los del documento) se arma según el listado: 4 bases de platillo en la lista, 4 en el holograma. */
export function mostrar(contenedor, tipo, items, categoria) {
  if (!CONSTRUIR[tipo]) return false;
  if (!renderer) iniciar();
  if (renderer.domElement.parentElement !== contenedor) contenedor.append(renderer.domElement);
  const rec = receta(tipo, items, categoria) || undefined, clave = tipo + JSON.stringify(rec || null);
  if (actual !== clave) {
    giro.traverse(o => { if (o.geometry && o !== giro) o.geometry.dispose(); });
    giro.clear();
    const g = new THREE.Group(); CONSTRUIR[tipo](g, rec);
    const b = new THREE.Box3().setFromObject(g), tam = b.getSize(new THREE.Vector3());
    const s = Math.min(2.1 / tam.y, 2.1 / Math.max(tam.x, tam.z));
    const c = b.getCenter(new THREE.Vector3());
    g.scale.setScalar(s); g.position.set(-c.x * s, -b.min.y * s + .02, -c.z * s);
    giro.add(g); actual = clave;
  }
  t0 = reloj.getElapsedTime();
  if (!corriendo) { corriendo = true; cuadro(); }
  return true;
}

export function pausar() { corriendo = false; }
