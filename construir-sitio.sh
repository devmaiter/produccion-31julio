#!/usr/bin/env bash
# Arma sitio/ con la Home y todos los demos, tomando cada frente de su rama.
# Uso: ./construir-sitio.sh   (desde la raíz del repo, en la rama main)
# Luego: firebase deploy --only hosting   → https://backline-2797d.web.app
set -euo pipefail
cd "$(dirname "$0")"
rm -rf sitio && mkdir -p sitio/produccion-31-julio
cp home/index.html sitio/index.html
git archive main index.html sw.js | tar -x -C sitio/produccion-31-julio
git archive cordillera cordillera/backline-esc2.html cordillera/lector cordillera/README.md | tar -x -C sitio
git archive demo demo-listado/index.html demo-listado/vendor demo-listado/datos demo-listado/README.md | tar -x -C sitio
if [ -d extractor/dist ]; then
  cp -rL extractor/dist sitio/extractor
else
  echo "aviso: no hay extractor/dist; en la rama extractor corre 'cd extractor && npm install && npm run build' y vuelve a armar" >&2
fi
du -sh sitio
