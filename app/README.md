# Backline: proyecto unificado

Une los dos prototipos en un solo proyecto con un modelo de datos común:

| Prototipo | Qué aportó |
|---|---|
| **Hoja de producción** (`../index.html`): Simón Bolívar y Vallenato al Parque | Días y horario por banda, stage plots, fotos, categorías por palabras clave, lista pegada, sugerencias de IA por foto (`../functions`) |
| **Lista de chequeo Cordillera 2026** (repo `cordillera`) | Escenarios, cantidades, propietario (CN / terceros), conteo en cancha, referencias equivalentes y totales por referencia |

Los prototipos siguen intactos en la rama `main`. Este proyecto vive en `app/`.

## Cómo correrlo

```bash
cd app
npm install
npm run dev        # servidor local
npm test           # pruebas (dominio + datos importados)
npm run build      # typecheck + build de producción en dist/
npm run importar   # vuelve a generar data/*.json desde los prototipos
```

## Modelo de datos (`src/dominio/entidades.ts`)

```
Evento ─┬─ Escenario
        ├─ Día (show | pruebas)
        ├─ Bloque (show, soundcheck, linecheck, load-in, montaje, cambio) ── Día, Escenario, Artista
        ├─ ItemBackline ── Día, Artista, Categoría, Referencia, Propietario
        └─ StagePlot ── Artista
Artista
Verificacion ── ItemBackline (contado, listo, cantidad corregida)
```

- **Categoría**: Batería, Platillos, Percusión, Bajo, Ampli bajo, Guitarra, Ampli guitarra, Teclado, Bases, DJ, Escenario, Cables y energía, Otro.
- **Referencia**: nombre canónico de la pieza. "Base de redoblante" y "Snare stand" son la misma referencia y se suman juntas.
- **Propietario**: `propio` (CN), `tercero` (OML, BACKLINE COP, una persona) o `sin-definir`.

Cada entidad tiene su esquema **zod**. Todo lo que entra (JSON, almacenamiento, formularios) se valida antes de llegar a la lógica.

## Reglas de negocio (`src/dominio/`)

| Archivo | Regla |
|---|---|
| `categorias.ts` | Adivina la categoría por palabras clave, en orden de prioridad |
| `referencias.ts` | Tabla de equivalencias entre nombres de la misma pieza |
| `propietario.ts` | Interpreta la columna de observaciones (CN = propio) |
| `lista.ts` | Convierte un rider pegado (WhatsApp o correo) en ítems con cantidad y categoría |
| `verificacion.ts` | Estado en cancha: pendiente, ok, falta, sobra; y el avance total |
| `totales.ts` | Totales por referencia: se **suma** dentro de un día y se toma el **máximo** entre días |

## Extracción: correo, PDF o foto → entidades (`src/extraccion/`)

La información siempre llega por correo, en PDF o en foto. Este módulo la convierte en días, artistas, horario y backline.

```
archivos ──► fuentes.ts ──► extraer.ts ──► integrar.ts ──► PaqueteEvento
(.eml .pdf    correo: cuerpo   Claude lee y     ids, referencias,       validado con zod;
 .jpg .png    + adjuntos;      transcribe a     propietario, días,      nada se guarda
 .txt)        PDF/foto tal cual un esquema fijo  fusión sin duplicar     sin revisión
```

1. **`fuentes.ts`**: abre un `.eml` y manda el cuerpo como texto y los adjuntos (PDF, fotos) como documentos. Los PDF y las fotos sueltas van tal cual.
2. **`extraer.ts`**: una sola llamada a Claude (`claude-opus-5-5`) con salida estructurada (`esquema.ts`). El modelo solo transcribe nombres y cantidades, y marca lo dudoso. Si un filtro de seguridad rechaza la petición, la API la reintenta en otro modelo (`fallbacks: "default"`).
3. **`integrar.ts`**: código determinista y probado.
   - Asigna ids estables y reconoce el mismo escenario o artista escrito de dos formas.
   - Normaliza horas y fechas, aplica referencias y propietario (CN, terceros).
   - Un rider sin fecha va a los días de show del artista.
   - Procesar el mismo correo dos veces no duplica nada.
   - Un cambio de cantidad se aplica, se marca "confirmar" y queda en avisos.
   - Lo que no cuadra no se descarta en silencio: queda en **avisos**.
   - Cada ítem guarda su `origen` (el archivo de donde salió).

**Desde la app**: `ANTHROPIC_API_KEY=... npm run dev` y abrir la pestaña **Importar**. Se sube el correo, PDF o fotos, se elige el evento destino, se revisa el resumen y los avisos, y se guarda. La clave vive solo en el servidor local (`/api/extraer`, `/api/guardar`); nunca llega al navegador.

**Desde la terminal**:

```bash
npm run extraer -- --evento cordillera-2026 correo.eml hoja-dia2.jpg   # muestra el resumen, no guarda
npm run extraer -- --evento cordillera-2026 --crudo crudo.json correo.eml --guardar
npm run extraer -- --desde-crudo crudo.json            # re-integra sin volver a llamar a la API
```

## Datos migrados (`data/`)

| Evento | Días | Artistas | Bloques | Ítems | Stage plots |
|---|---|---|---|---|---|
| Cordillera 2026 | 3 | 40 | 149 | 337 | 8 |
| Vallenato al Parque 2026 | 3 | 19 | 28 | 0 | 0 |
| Parque Simón Bolívar jul–ago 2026 | 3 | 16 | 52 | 7 | 4 |

El backline de Simón Bolívar y Vallenato se editaba en vivo en Firestore, y las reglas de Firestore no dejan leerlo sin la app. Por eso aquí solo está lo que quedó escrito en el HTML: la lista de One 4 All. Para traer el resto hace falta exportarlo desde la consola de Firebase.

## Estructura

```
app/
  src/dominio/   entidades y reglas de negocio (sin DOM ni red: se prueban solas)
  src/datos/     carga de eventos, consultas y repositorios de verificación
  src/extraccion/ correo/PDF/foto → Claude → entidades (con revisión antes de guardar)
  src/ui/        interfaz mínima (sin diseño todavía)
  scripts/       importador desde los prototipos y comando de extracción
  data/          eventos migrados, validados
  public/        stage plots extraídos
  tests/         pruebas con vitest
```

## Siguientes pasos

1. Probar la extracción con correos, PDF y fotos reales de producción y ajustar las instrucciones con lo que falle.
2. Repositorio en **Firestore** con la misma interfaz `RepositorioVerificaciones`, para sincronizar entre celulares.
3. Llevar la extracción a una Cloud Function (como `../functions`) para usarla desde el celular sin el servidor local.
4. Usuarios y permisos por evento (hoy es un PIN compartido).
5. Diseño.
