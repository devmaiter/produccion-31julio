#!/usr/bin/env bash
# Trae a la raíz de main (lo que publica GitHub Pages en
# https://devmaiter.github.io/produccion-31julio/) la última versión de cada demo
# desde su rama. La Home es index.html; la app del 31 de julio vive en
# produccion-31-julio/ y no se toca aquí.
# Uso: ./construir-sitio.sh   (en la rama main) y luego commit + push.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf cordillera demo-listado
git archive cordillera cordillera/backline-esc2.html cordillera/lector cordillera/README.md | tar -x
git archive demo demo-listado/index.html demo-listado/vendor demo-listado/datos demo-listado/README.md | tar -x
if [ -d "${EXTRACTOR_DIST:-/nonexistent}" ]; then
  rm -rf extractor && cp -rL "$EXTRACTOR_DIST" extractor
else
  echo "aviso: extractor/ se deja como está. Para renovarlo: en la rama extractor 'cd extractor && npm install && npm run build', y aquí EXTRACTOR_DIST=/ruta/a/extractor/dist ./construir-sitio.sh" >&2
fi
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
