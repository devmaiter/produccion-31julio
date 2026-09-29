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
  src/ui/        interfaz mínima (sin diseño todavía)
  scripts/       importador desde los prototipos
  data/          eventos migrados, validados
  public/        stage plots extraídos
  tests/         pruebas con vitest
```

## Siguientes pasos

1. Repositorio en **Firestore** con la misma interfaz `RepositorioVerificaciones`, para sincronizar entre celulares.
2. Guardar ítems nuevos (lista pegada y sugerencias de IA) como `ItemBackline` validados.
3. Conectar `../functions` (sugerencias por foto) al modelo nuevo de categorías.
4. Usuarios y permisos por evento (hoy es un PIN compartido).
5. Diseño.
