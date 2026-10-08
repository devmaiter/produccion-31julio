module Backline.Entidades exposing
    ( Artista
    , Bloque
    , Categoria(..)
    , Dia
    , Escenario
    , Evento
    , ItemBackline
    , PaqueteEvento
    , Propietario(..)
    , StagePlot
    , TipoBloque(..)
    , TipoDia(..)
    , Verificacion
    , categoriaANombre
    , categorias
    , etiquetaPropietario
    , nombreACategoria
    , nombreATipoBloque
    , nombreATipoDia
    , tipoBloqueANombre
    , tipoDiaANombre
    , tiposBloque
    , tiposDia
    )

{-| Modelo de datos del backline.

Es el espejo de `lector/src/dominio/entidades.ts`: el lector (JavaScript)
produce ese JSON y la app lo decodifica en `Backline.Json`. Cada categoría
y cada tipo es un tipo cerrado, así el compilador obliga a tratar todos
los casos en cada pantalla y en cada regla.

-}


{-| Qué clase de equipo es un ítem.
-}
type Categoria
    = Bateria
    | Platillos
    | Percusion
    | Bajo
    | AmpliBajo
    | Guitarra
    | AmpliGuitarra
    | Teclado
    | Bases
    | InEars
    | Consolas
    | Dj
    | EquipoDeEscenario
    | CablesYEnergia
    | Otro


{-| Todas, en el orden en que se muestran.
-}
categorias : List Categoria
categorias =
    [ Bateria
    , Platillos
    , Percusion
    , Bajo
    , AmpliBajo
    , Guitarra
    , AmpliGuitarra
    , Teclado
    , Bases
    , InEars
    , Consolas
    , Dj
    , EquipoDeEscenario
    , CablesYEnergia
    , Otro
    ]


{-| El nombre tal como viaja en el JSON y se muestra en pantalla.
-}
categoriaANombre : Categoria -> String
categoriaANombre c =
    case c of
        Bateria ->
            "Batería"

        Platillos ->
            "Platillos"

        Percusion ->
            "Percusión"

        Bajo ->
            "Bajo"

        AmpliBajo ->
            "Ampli bajo"

        Guitarra ->
            "Guitarra"

        AmpliGuitarra ->
            "Ampli guitarra"

        Teclado ->
            "Teclado"

        Bases ->
            "Bases"

        InEars ->
            "In ears"

        Consolas ->
            "Consolas"

        Dj ->
            "DJ"

        EquipoDeEscenario ->
            "Escenario"

        CablesYEnergia ->
            "Cables y energía"

        Otro ->
            "Otro"


nombreACategoria : String -> Maybe Categoria
nombreACategoria nombre =
    buscar categoriaANombre categorias nombre


{-| Quién pone el equipo. "CN" en las hojas es equipo propio de la
producción; OML, BACKLINE COP o un nombre propio es un tercero.
-}
type Propietario
    = Propio
    | Tercero String
    | SinDefinir


etiquetaPropietario : Propietario -> String
etiquetaPropietario p =
    case p of
        Propio ->
            "Propio (CN)"

        Tercero nombre ->
            nombre

        SinDefinir ->
            "Sin definir"


{-| Una jornada del evento. Los días de pruebas no tienen shows.
-}
type TipoDia
    = DiaDeShow
    | DiaDePruebas


tiposDia : List TipoDia
tiposDia =
    [ DiaDeShow, DiaDePruebas ]


tipoDiaANombre : TipoDia -> String
tipoDiaANombre t =
    case t of
        DiaDeShow ->
            "show"

        DiaDePruebas ->
            "pruebas"


nombreATipoDia : String -> Maybe TipoDia
nombreATipoDia =
    buscar tipoDiaANombre tiposDia


{-| Qué pasa en un bloque del horario.
-}
type TipoBloque
    = Show
    | Soundcheck
    | Linecheck
    | LoadIn
    | Montaje
    | Cambio
    | Marca


tiposBloque : List TipoBloque
tiposBloque =
    [ Show, Soundcheck, Linecheck, LoadIn, Montaje, Cambio, Marca ]


tipoBloqueANombre : TipoBloque -> String
tipoBloqueANombre t =
    case t of
        Show ->
            "show"

        Soundcheck ->
            "soundcheck"

        Linecheck ->
            "linecheck"

        LoadIn ->
            "load-in"

        Montaje ->
            "montaje"

        Cambio ->
            "cambio"

        Marca ->
            "marca"


nombreATipoBloque : String -> Maybe TipoBloque
nombreATipoBloque =
    buscar tipoBloqueANombre tiposBloque


type alias Evento =
    { id : String
    , nombre : String
    , lugar : String
    , ciudad : String
    , desde : String
    , hasta : String
    }


type alias Escenario =
    { id : String
    , eventoId : String
    , nombre : String
    }


type alias Dia =
    { id : String
    , eventoId : String
    , fecha : String
    , nombre : String
    , tipo : TipoDia
    }


type alias Artista =
    { id : String
    , nombre : String
    }


{-| Un bloque del horario: show, prueba, montaje o cambio de un artista en
un escenario. Un bloque que cruza la medianoche tiene fin < inicio.
Las marcas ("Puertas", "Noise curfew") no tienen artista.
-}
type alias Bloque =
    { id : String
    , diaId : String
    , escenarioId : String
    , artistaId : Maybe String
    , titulo : String
    , tipo : TipoBloque
    , inicio : String
    , fin : String
    }


{-| Una línea del rider de backline de un artista en un día.
-}
type alias ItemBackline =
    { id : String
    , eventoId : String
    , diaId : String
    , artistaId : String
    , grupo : Maybe String
    , descripcion : String
    , cantidad : Int
    , categoria : Categoria
    , referencia : String
    , propietario : Propietario
    , observacion : Maybe String
    , porConfirmar : Bool
    , chuleadoEnHoja : Bool
    , origen : Maybe String
    }


type alias StagePlot =
    { artistaId : String
    , eventoId : String
    , archivo : String
    , descripcion : Maybe String
    }


{-| Lo que se registra en cancha para un ítem.
-}
type alias Verificacion =
    { itemId : String
    , contado : Maybe Int
    , listo : Bool
    , cantidadCorregida : Maybe Int
    , actualizado : Maybe String
    }


{-| Todo lo de un evento: es lo que se importa y exporta.
-}
type alias PaqueteEvento =
    { evento : Evento
    , escenarios : List Escenario
    , dias : List Dia
    , artistas : List Artista
    , bloques : List Bloque
    , items : List ItemBackline
    , stagePlots : List StagePlot
    }


buscar : (a -> String) -> List a -> String -> Maybe a
buscar nombreDe lista nombre =
    List.filter (\x -> nombreDe x == nombre) lista |> List.head
