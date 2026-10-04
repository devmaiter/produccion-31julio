// Convierte los JSON de data/ y tests/fixtures/ en un módulo Elm con cadenas,
// para que elm-test pueda probar los decodificadores con datos reales.
// Se corre de nuevo cuando cambian esos archivos: npm run fixtures
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const cadena = ruta => JSON.stringify(JSON.parse(readFileSync(join(raiz, ruta), "utf8"))).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const fixtures = [
  ["cordillera2026", "data/cordillera-2026.json"],
  ["simonBolivar2026", "data/simon-bolivar-2026.json"],
  ["vallenato2026", "data/vallenato-al-parque-2026.json"],
  ["extraccionRider", "tests/fixtures/extraccion-rider.json"],
];

const modulo = [
  `module Fixtures exposing (${fixtures.map(([n]) => n).join(", ")})`,
  "",
  "{-| Generado por scripts/generar-fixtures.mjs. No editar a mano. -}",
  "",
  ...fixtures.flatMap(([nombre, ruta]) => [
    "",
    `{-| ${ruta} -}`,
    `${nombre} : String`,
    `${nombre} =`,
    `    "${cadena(ruta)}"`,
    "",
  ]),
].join("\n");

writeFileSync(join(raiz, "tests", "Fixtures.elm"), modulo);
console.log("tests/Fixtures.elm generado");
