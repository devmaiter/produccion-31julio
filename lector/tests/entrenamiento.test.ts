import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leerCasos, medirCaso } from "../src/lectura/entrenamiento";

/* Cada caso del texto de entrenamiento es una prueba: lo que el lector ya aprendió no se pierde. */
const casos = leerCasos(readFileSync("tests/fixtures/entrenamiento/renglones.txt", "utf8"));

describe("entrenamiento: de izquierda a derecha y de arriba abajo", () => {
  for (const caso of casos) {
    it(caso.nombre, () => {
      const r = medirCaso(caso);
      expect(r.salio.map(s => `${s.cantidad} | ${s.texto}`), caso.renglones.join(" / ")).toHaveLength(caso.esperadas.length);
      expect(r.pasa, r.salio.map(s => `${s.cantidad} | ${s.texto}`).join("\n")).toBe(true);
    });
  }
});
