// Inserta los datos en la página y genera:
//  - index.html  → se abre con doble clic, también sin internet
//  - publicar.html → la misma página sin envoltura (para publicarla como artefacto)
import { readFileSync, writeFileSync } from "node:fs";
const datos = readFileSync(new URL("datos/listado-esc1.json", import.meta.url), "utf8").replace(/</g, "\\u003c");
const pagina = readFileSync(new URL("pagina.html", import.meta.url), "utf8").replace("__DATOS__", datos);
writeFileSync(new URL("publicar.html", import.meta.url), pagina);
writeFileSync(new URL("index.html", import.meta.url),
  `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${pagina}\n</body>\n</html>\n`);
console.log("listo: index.html y publicar.html");
