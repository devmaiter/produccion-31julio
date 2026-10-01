/* Holograma 3D para la portada de cada reel. Usa el Three.js y el mismo shader de
   ../reconocimiento-3d (borde fresnel, líneas de barrido y el corte que lo dibuja de abajo
   hacia arriba). Un solo lienzo WebGL que se mueve al reel visible: los navegadores
   permiten pocos contextos y doce reels con su propio WebGL se caerían en el celular. */
import * as THREE from "../reconocimiento-3d/vendor/three.js";
import { RoundedBoxGeometry } from "../reconocimiento-3d/vendor/three.js";

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
function platillo(g, x, y, z, r, inclina = .25) {
  pieza(g, cil(.012, r, .025), x, y, z, inclina, 0, .15);
  barra(g, [x, 0, z - .15], [x, y - .25, z - .05]); barra(g, [x, y - .25, z - .05], [x, y - .02, z]);
  tripode(g, x, .3, z - .15);
}

/* Cada equipo. La batería sigue la foto de referencia: tarima con tapete, bombo con
   frente con hueco, dos toms montados en el bombo, tom de piso a la derecha,
   redoblante y hi-hat a la izquierda con sus pedales, platillos y la silla. */
const CONSTRUIR = {
  bateria(g) {
    contorno(g, new THREE.BoxGeometry(2.3, .2, 1.9), 0, .1, .25);  // tarima
    contorno(g, new THREE.BoxGeometry(1.9, .01, 1.5), 0, .205, .3); // tapete
    const k = new THREE.Group(); k.position.y = .21; g.add(k);
    pieza(k, cil(.29, .29, .42), 0, .3, 0, Math.PI / 2);           // bombo
    pieza(k, aro(.29, .012), 0, .3, .21); pieza(k, aro(.29, .012), 0, .3, -.21);
    pieza(k, aro(.07, .006), .1, .22, -.215);                      // hueco del parche frontal
    barra(k, [-.18, .05, .3], [-.24, 0, .38]); barra(k, [.18, .05, .3], [.24, 0, .38]);
    pieza(k, caja(.1, .02, .26, .006), 0, .012, .36);              // pedal de bombo
    barra(k, [0, .03, .26], [0, .3, .22], .008);
    pieza(k, cil(.15, .15, .2), -.17, .78, .04, .35); pieza(k, cil(.16, .16, .22), .18, .78, .04, .35); // toms
    barra(k, [0, .58, 0], [-.12, .72, .02]); barra(k, [0, .58, 0], [.12, .72, .02]);
    pieza(k, cil(.18, .18, .14), -.46, .66, .32, .12);              // redoblante
    tripode(k, -.46, .58, .32);
    pieza(k, cil(.22, .22, .42), .5, .46, .34);                     // tom de piso
    for (const a of [.8, 2.4, 4.2]) barra(k, [.5 + Math.cos(a) * .24, .35, .34 + Math.sin(a) * .24], [.5 + Math.cos(a) * .3, 0, .34 + Math.sin(a) * .3]);
    pieza(k, cil(.18, .18, .012), -.78, .96, .2); pieza(k, cil(.18, .18, .012), -.78, .99, .2); // hi-hat
    barra(k, [-.78, 0, .2], [-.78, .96, .2]); tripode(k, -.78, .3, .2);
    pieza(k, caja(.09, .02, .24, .006), -.74, .012, .4);            // pedal de hi-hat
    pieza(k, cil(.012, .24, .03), -.48, 1.42, -.18, .35, 0, .2);    // crash
    barra(k, [-.48, 0, -.4], [-.48, 1.12, -.25]); barra(k, [-.48, 1.12, -.25], [-.48, 1.4, -.18]);
    pieza(k, cil(.012, .28, .03), .62, 1.2, -.12, .3, 0, -.25);     // ride
    barra(k, [.7, 0, -.35], [.68, .95, -.2]); barra(k, [.68, .95, -.2], [.62, 1.18, -.12]);
    pieza(k, cil(.19, .19, .08), 0, .55, .82);                      // silla
    barra(k, [0, .51, .82], [0, .12, .82]); tripode(k, 0, .12, .82, .25);
  },
  platillos(g) {
    platillo(g, -.55, 1.15, 0, .26); platillo(g, 0, 1.35, -.2, .3, .15); platillo(g, .55, 1.1, 0, .28);
    pieza(g, cil(.18, .18, .012), 0, .95, .45); pieza(g, cil(.18, .18, .012), 0, .98, .45);
    barra(g, [0, 0, .45], [0, .95, .45]); tripode(g, 0, .3, .45);
  },
  percusion(g) {
    [[-.42, .74, .3], [0, .78, .32], [.42, .72, .3]].forEach(([x, h, r], i) => {
      const z = i === 1 ? -.15 : .1;
      pieza(g, cil(r * .82, r * .62, h), x, .3 + h / 2, z);
      pieza(g, aro(r * .82, .012), x, .3 + h, z, Math.PI / 2);
      pieza(g, aro(r * .62, .01), x, .3, z, Math.PI / 2);
      tripode(g, x, .32, z, .22);
    });
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
  base(g) { // base de micrófono tipo boom: la categoría Bases es casi toda bases
    tripode(g, 0, .42, 0, .36);
    barra(g, [0, .42, 0], [0, 1.22, 0], .014);
    barra(g, [-.36, 1.04, 0], [.46, 1.48, 0], .011);
    pieza(g, cil(.045, .045, .08, 16), -.36, 1.04, 0, 0, 0, 1.07);
    const m = new THREE.Group(); m.position.set(.5, 1.5, 0); m.rotation.z = -1.57; g.add(m);
    pieza(m, cil(.024, .017, .14, 20), 0, 0, 0);
    pieza(m, new THREE.SphereGeometry(.034, 20, 12), 0, .095, 0);
  },
};

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

/* Pone el holograma de `tipo` dentro de `contenedor` y lo dibuja desde abajo. */
export function mostrar(contenedor, tipo) {
  if (!CONSTRUIR[tipo]) return false;
  if (!renderer) iniciar();
  if (renderer.domElement.parentElement !== contenedor) contenedor.append(renderer.domElement);
  if (actual !== tipo) {
    giro.traverse(o => { if (o.geometry && o !== giro) o.geometry.dispose(); });
    giro.clear();
    const g = new THREE.Group(); CONSTRUIR[tipo](g);
    const b = new THREE.Box3().setFromObject(g), tam = b.getSize(new THREE.Vector3());
    const s = Math.min(2.1 / tam.y, 2.1 / Math.max(tam.x, tam.z));
    const c = b.getCenter(new THREE.Vector3());
    g.scale.setScalar(s); g.position.set(-c.x * s, -b.min.y * s + .02, -c.z * s);
    giro.add(g); actual = tipo;
  }
  t0 = reloj.getElapsedTime();
  if (!corriendo) { corriendo = true; cuadro(); }
  return true;
}

export function pausar() { corriendo = false; }
