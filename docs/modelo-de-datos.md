# Modelo de datos (preparado para el servidor)

Por ahora todo vive en el dispositivo (la interfaz primero, lo pidió el usuario el 2026-10-07).
Este documento es el plan para el servidor. Las pantallas ya guardan los datos con esta misma
forma, así que pasar a una base de datos es cambiar dónde se guardan, no rehacer las pantallas.

## Las ideas

- **Todo se relaciona con todo:** evento → escenarios → presentaciones (una banda en un escenario,
  un día) → documentos (rider y contra-rider) → piezas.
- **Dos espacios:**
  - **Evento (oficial):** lo arma el admin y está sincronizado con el cronograma. El empleado lo ve
    entero, pero no lo puede cambiar.
  - **Mis pruebas:** el escritorio de cada persona. Sube, prueba, edita y borra sin tocar nada
    oficial. Solo lo ve su dueño.
- **El rider es como viene y el contra-rider es lo que pone la empresa.** Los dos se guardan, para
  defender la producción si hay un reclamo.

## Tablas

```sql
-- Personas y su perfil.
create table usuarios (
  id          uuid primary key,
  nombre      text not null,
  correo      text unique not null,
  rol         text not null check (rol in ('admin', 'empleado'))
);

-- Un evento del cronograma (festival, concierto).
create table eventos (
  id          uuid primary key,
  nombre      text not null,
  desde       date not null,
  hasta       date not null check (hasta >= desde),
  lugar       text,
  creado_por  uuid not null references usuarios(id),
  creado_en   timestamptz not null default now()
);

create table escenarios (
  id          uuid primary key,
  evento_id   uuid not null references eventos(id) on delete cascade,
  nombre      text not null,
  orden       int not null default 0,
  unique (evento_id, nombre)
);

-- Catálogo de bandas: la misma banda vuelve en otros eventos con su historial.
create table bandas (
  id          uuid primary key,
  nombre      text not null unique
);

-- Una banda en un escenario, un día. El estado del rider va aquí.
create table presentaciones (
  id           uuid primary key,
  escenario_id uuid not null references escenarios(id) on delete cascade,
  banda_id     uuid not null references bandas(id),
  dia          date not null,
  hora         time,
  estado_rider text not null default 'falta' check (estado_rider in ('falta', 'recibido', 'revisado')),
  unique (escenario_id, banda_id, dia)
);

-- Un archivo subido: rider de una presentación o contra-rider de un escenario.
-- En "pruebas" el documento es de su dueño y no apunta a nada oficial.
create table documentos (
  id               uuid primary key,
  tipo             text not null check (tipo in ('rider', 'contra_rider')),
  espacio          text not null check (espacio in ('evento', 'pruebas')),
  presentacion_id  uuid references presentaciones(id) on delete cascade,
  escenario_id     uuid references escenarios(id) on delete cascade,
  dueno_id         uuid not null references usuarios(id),
  nombre_archivo   text not null,
  archivo_url      text not null,           -- el PDF/foto/Excel en el almacenamiento de archivos
  subido_en        timestamptz not null default now(),
  check (espacio = 'pruebas' or (tipo = 'rider' and presentacion_id is not null)
                             or (tipo = 'contra_rider' and escenario_id is not null))
);

-- Lo que el lector sacó de un documento, pieza por pieza, en el orden del rider.
create table piezas (
  id               uuid primary key,
  documento_id     uuid not null references documentos(id) on delete cascade,
  orden            int not null,
  seccion          text,                    -- "DRUMS", "Electric Guitar Andres Cepeda" (tal cual el rider)
  cantidad         int not null check (cantidad >= 0),
  referencia       text not null,           -- "KICK 24”"
  categoria        text not null,           -- Batería, Platillos, Bases…
  pieza_canonica   text,                    -- bombo, redoblante, tom… (dominio/bateria.ts)
  medida           int,                     -- pulgadas, si aplica
  renglon_rider    text,                    -- el renglón de donde salió
  por_confirmar    boolean not null default false,
  lo_trae_la_banda boolean not null default false,
  editado_por      uuid references usuarios(id),
  editado_en       timestamptz
);

create table fotos (
  id              uuid primary key,
  presentacion_id uuid references presentaciones(id) on delete cascade,
  url             text not null,
  subido_por      uuid not null references usuarios(id),
  subido_en       timestamptz not null default now()
);
```

## Quién puede qué

| Acción | Admin | Empleado |
|---|---|---|
| Ver el cronograma y los eventos | sí | sí |
| Crear o editar eventos, escenarios y bandas | sí | no |
| Subir el rider o el contra-rider oficial | sí | no |
| Editar o quitar piezas del evento | sí | no |
| Subir, editar y borrar en Mis pruebas | sí (las suyas) | sí (las suyas) |
| Ver Mis pruebas de otra persona | no | no |
| Tomar y subir fotos de una presentación | sí | sí |

En la base de datos esto va como reglas por fila. Un documento con `espacio = 'evento'` solo lo
cambia un admin. Uno con `espacio = 'pruebas'` solo lo ve y lo cambia su `dueno_id`. Hoy la misma
regla vive en `app/src/Backline/Tablero.elm` (`puedeEscribir`) y tiene sus pruebas.

## Las condiciones de la entrada a los reels

1. **¿Hay un evento hoy en el cronograma?** (`desde <= hoy <= hasta`)
   - **Sí, con riders recibidos:** se cargan sus riders como el backline del evento, el saludo nombra
     el evento («Buenas tardes, equipo · Hoy toca …») y se entra directo a los reels. No sale la
     entrada.
   - **Sí, pero sin riders:** sale la entrada. El saludo nombra el evento.
2. **¿Ya hay un rider cargado en el espacio en el que se está?** Se entra directo a los reels.
3. **No hay nada:** sale la entrada completa, con el texto que se escribe solo, los íconos
   «Subir rider» y «Tomar foto», el escáner mientras lee y el holograma al terminar.

## Cómo está hoy en el dispositivo

| Tabla | Hoy |
|---|---|
| eventos, escenarios, presentaciones | `localStorage["cronograma:eventos"]`: cada evento trae sus escenarios y cada escenario sus bandas (con `dia`, `estado` y `rider`) |
| documentos (archivo) | IndexedDB `backline-riders` / `archivos`, con la llave `archivoId` |
| documentos + piezas leídas | el estado de Elm (`lab-reels:tablero`): `evento` y `pruebas`, cada uno con sus piezas |
| fotos | IndexedDB `backline-fotos` |

Cuando llegue el servidor:
1. Cada uno de esos lugares pasa a ser una consulta a su tabla.
2. Los archivos van al almacenamiento de archivos.
3. Los riders que lleguen por correo entran como documentos `recibido` de su presentación.
