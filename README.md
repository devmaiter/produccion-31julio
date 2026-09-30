
## Home de demos y publicación

`home/index.html` es la portada con un enlace a cada demo. `./construir-sitio.sh`
arma `sitio/` con la Home y los frentes tomados de sus ramas (`cordillera`,
`demo`, `extractor` ya construido) más la app del 31 de julio, y `firebase.json`
apunta el hosting a esa carpeta:

```bash
./construir-sitio.sh
firebase deploy --only hosting     # proyecto backline-2797d → https://backline-2797d.web.app
```

Para probarlo local: `cd sitio && python3 -m http.server 8000` y abrir
http://localhost:8000/. Los demos con OCR (Cordillera, Extractor) necesitan
servirse así; no funcionan abriendo el HTML suelto desde el disco.
