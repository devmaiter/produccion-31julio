
## Home de demos y publicación

GitHub Pages publica la rama `main` en https://devmaiter.github.io/produccion-31julio/.
La raíz es la Home (`index.html`) con un enlace a cada demo:

| Carpeta | Demo | Viene de |
|---|---|---|
| `cordillera/` | Lista de chequeo ESC 2 con "Subir documento" | rama `cordillera` |
| `extractor/` | Extractor de backline (build de Vite) | rama `extractor` |
| `demo-listado/` | Del listado al backline organizado | rama `demo` |
| `reconocimiento-3d/` | Reconocimiento de equipo con cámara y holograma 3D | aquí mismo |
| `produccion-31-julio/` | Hoja de producción del 31 de julio | aquí mismo (antes estaba en la raíz) |

Para renovar los demos desde sus ramas: `./construir-sitio.sh`, commit y push a
`main`; Pages lo publica solo en uno o dos minutos. Para probar local:
`python3 -m http.server 8000` en la raíz y abrir http://localhost:8000/.
Los demos con OCR necesitan servirse así; no funcionan abriendo el HTML suelto.

La app del 31 de julio sigue usando Firestore del proyecto `backline-2797d`
(`.firebaserc`, `functions/`); Firebase no publica las páginas.
