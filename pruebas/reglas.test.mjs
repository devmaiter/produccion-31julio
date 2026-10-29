// Pruebas de las reglas del backline (lab-reels/backline/reglas.js), sin navegador: node --test pruebas/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const R = createRequire(import.meta.url)("../lab-reels/backline/reglas.js");
const pieza = (referencia, grupo = "Drums", extra = {}) => ({ artistaId: "los-rayos", grupo, referencia, descripcion: referencia, categoria: "Batería", ...extra });
const faltan = (items, op) => R.faltantesDe(items, op).map(r => r.pieza);

test("los ventiladores van siempre a Extras; in ears y consolas a su reel", () => {
  assert.equal(R.reelDe({ referencia: "Stage fan", grupo: "Bass", categoria: "Escenario" }), "Extras");
  assert.equal(R.reelDe({ referencia: "Shure PSM 1000", grupo: "Drums", categoria: "In ears" }), "In ears");
  assert.equal(R.reelDe({ referencia: "Yamaha DM7", grupo: "Consola", categoria: "Consolas" }), "Consolas");
});
test("lo del bloque de un instrumento se queda en su reel", () => {
  assert.equal(R.reelDe({ referencia: "Mesa de percusión", grupo: "Bajo", categoria: "Percusión" }), "Bajo");
  assert.equal(R.reelDe({ referencia: "Drum throne", grupo: "Set Bongo", categoria: "Batería" }), "Percusión");
});
test("a la batería le falta lo que no nombra (la silla, los plásticos…)", () => {
  assert.deepEqual(faltan([pieza("22\" kick"), pieza("Hi hat stand"), pieza("Snare stand"), pieza("Kick pedal"), pieza("Ride 20\""), pieza("Drum carpet")]),
    ["Silla de batería", "Plásticos (parches)"]);
});
test("«hardware completo» cubre stands y pedal, no silla ni alfombra", () => {
  assert.deepEqual(faltan([pieza("Kick 22\""), pieza("Hardware completo"), pieza("Crash 18\""), pieza("Remo Ambassador")]),
    ["Silla de batería", "Alfombra para batería"]);
});
test("batería electrónica y secciones de puro hardware no piden nada", () => {
  assert.deepEqual(faltan([pieza("Roland TD-27")]), []);
  assert.deepEqual(faltan([pieza("3 boom cymbals stand", "Misc"), pieza("5 sillas de batería", "Misc")]), []);
});
test("una lista «tal cual» no avisa, y lo descartado tampoco", () => {
  const items = [pieza("22\" kick")];
  assert.deepEqual(faltan(items, { talCual: true }), []);
  const id = R.idFalta(items, "Silla de batería");
  assert.ok(!faltan(items, { descartadas: new Set([id]) }).includes("Silla de batería"));
});
test("bajo: base siempre; caja y cabezal de respaldo solo si la banda trae su cabezal", () => {
  const b = (ref, extra) => pieza(ref, "Bajo", { categoria: "Ampli bajo", ...extra });
  assert.deepEqual(faltan([b("Ampeg SVT 4 Pro")]), ["Base para bajo"]);
  assert.deepEqual(faltan([b("Ampeg SVT Classic head", { nota: "lo trae la banda" }), b("Bass stand", { categoria: "Bases" })]),
    ["Caja de bajo", "Cabezal de bajo de respaldo"]);
});
test("percusión: solo las bases de las congas, y «+ Stand» ya las trae", () => {
  const c = ref => pieza(ref, "Percusión", { categoria: "Percusión" });
  assert.deepEqual(faltan([c("LP Galaxy (X2 congas - X1 tumba)")]), ["Bases para congas"]);
  assert.deepEqual(faltan([c("LP Galaxy Giovanni Hidalgo (Conga y tumba + Stand)")]), []);
  assert.deepEqual(faltan([c("Bongó LP con base")]), []);
});
test("otro instrumento se registra sin tocar las reglas", () => {
  R.registrar("Vientos", [{ pieza: "Atril", categoria: "Bases", hay: /\batril/ }]);
  assert.ok(R.LLEVA.Vientos.length === 1);
});
test("la clave de una pieza no cambia por lo de entre paréntesis", () => {
  assert.equal(R.piezaDe({ artistaId: "a", grupo: "Bajo", referencia: "AMPEG SVT 810E CAB (anotado a mano: Colsubsidio)" }), "a|Bajo|ampeg svt 810e cab");
});
