#!/usr/bin/env bash
# Arma lo que publica GitHub Pages (https://devmaiter.github.io/produccion-31julio/)
# desde el código que vive en main. Ya no hay ramas por demo: todo está aquí.
#
#   lector/            código del lector  → cordillera/lector/ (lector.js empaquetado;
#                                            lo usan Cordillera, los reels y la planilla)
#   extractor-fuente/  código del extractor → extractor/ (su build)
#   demo-listado/      pagina.html + datos → index.html y publicar.html
#   app/               núcleo en Elm (Tablero.elm) → lab-reels/tablero.js
#
# La app del 31 de julio vive en produccion-31-julio/ y no se toca aquí.
# Uso: ./construir-sitio.sh   (en main) y luego commit + push.
set -euo pipefail
cd "$(dirname "$0")"

(cd lector && npm install && npm run preparar)        # dependencias y datos del OCR (no se suben)
ln -sfn ../../lector/ocr extractor-fuente/public/ocr   # el extractor publica esos datos; el enlace no va en git
(cd extractor-fuente && npm install && npm run build:cordillera -- ../cordillera/lector && npm run build)
rm -rf extractor && cp -rL extractor-fuente/dist extractor
node demo-listado/construir.mjs
(cd app && npm install && npx elm make src/Tablero.elm --optimize --output=../lab-reels/tablero.js)   # el núcleo en Elm de los reels
python3 lab-reels/hacer-marcas.py   # las copias con otra marca (backstage.html), desde lab-reels/index.html

# Bytes de control crudos dentro de cadenas de los scripts minificados → \xNN (igual para JS).
python3 - <<'PY'
import re, pathlib
for d in ("cordillera", "extractor"):
    for p in pathlib.Path(d).rglob("*"):
        if p.suffix in (".js", ".mjs") and p.is_file():
            b = p.read_bytes(); n, k = re.subn(rb"[\x00-\x08\x0b\x0c\x0e-\x1f]", lambda m: b"\\x%02x" % m.group(0)[0], b)
            if k: p.write_bytes(n); print(f"escapados {k} bytes en {p}")
PY
du -sh cordillera extractor demo-listado produccion-31-julio
