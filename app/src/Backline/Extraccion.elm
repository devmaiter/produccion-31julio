module Backline.Extraccion exposing
    ( BloqueExtraido
    , DiaExtraido
    , EventoExtraido
    , Extraccion
    , ItemExtraido
    , decodificar
    , extraccion
    )

{-| Lo que devuelve el lector al leer un correo, un PDF o una foto
(`lector/src/lectura/esquema.ts`). Es plano y por nombres, no por ids: así
lo produce el lector y así se revisa y corrige en pantalla antes de
convertirlo en entidades.
-}

import Backline.Entidades exposing (Categoria, TipoBloque, TipoDia)
import Backline.Json as Json
import Json.Decode as D exposing (Decoder)


type alias Extraccion =
    { evento : Maybe EventoExtraido
    , escenarios : List String
    , dias : List DiaExtraido
    , artistas : List String
    , bloques : List BloqueExtraido
    , items : List ItemExtraido
    , avisos : List String
    }


type alias EventoExtraido =
    { nombre : String
    , lugar : Maybe String
    , ciudad : Maybe String
    , desde : Maybe String
    , hasta : Maybe String
    }


type alias DiaExtraido =
    { fecha : String
    , nombre : String
    , tipo : TipoDia
    }


type alias BloqueExtraido =
    { fecha : String
    , escenario : Maybe String
    , artista : Maybe String
    , titulo : String
    , tipo : TipoBloque
    , inicio : String
    , fin : Maybe String
    }


type alias ItemExtraido =
    { artista : String
    , fecha : Maybe String
    , grupo : Maybe String
    , descripcion : String
    , cantidad : Int
    , categoria : Categoria
    , proveedor : Maybe String
    , dudoso : Bool
    , nota : Maybe String
    }


decodificar : String -> Result String Extraccion
decodificar texto =
    D.decodeString extraccion texto |> Result.mapError D.errorToString


extraccion : Decoder Extraccion
extraccion =
    D.map7 Extraccion
        (D.field "evento" (D.nullable evento))
        (D.field "escenarios" (D.list D.string))
        (D.field "dias" (D.list dia))
        (D.field "artistas" (D.list D.string))
        (D.field "bloques" (D.list bloque))
        (D.field "items" (D.list item))
        (D.field "avisos" (D.list D.string))


evento : Decoder EventoExtraido
evento =
    D.map5 EventoExtraido
        (D.field "nombre" D.string)
        (D.field "lugar" (D.nullable D.string))
        (D.field "ciudad" (D.nullable D.string))
        (D.field "desde" (D.nullable D.string))
        (D.field "hasta" (D.nullable D.string))


dia : Decoder DiaExtraido
dia =
    D.map3 DiaExtraido
        (D.field "fecha" D.string)
        (D.field "nombre" D.string)
        (D.field "tipo" Json.tipoDia)


{-| Las fechas y horas llegan tal como el lector las leyó: se validan al
integrar, no aquí, para poder mostrar lo dudoso y dejar que alguien lo
corrija.
-}
bloque : Decoder BloqueExtraido
bloque =
    D.map7 BloqueExtraido
        (D.field "fecha" D.string)
        (D.field "escenario" (D.nullable D.string))
        (D.field "artista" (D.nullable D.string))
        (D.field "titulo" D.string)
        (D.field "tipo" Json.tipoBloque)
        (D.field "inicio" D.string)
        (D.field "fin" (D.nullable D.string))


item : Decoder ItemExtraido
item =
    D.map8 (\a f g d c cat p du -> ItemExtraido a f g d c cat p du)
        (D.field "artista" D.string)
        (D.field "fecha" (D.nullable D.string))
        (D.field "grupo" (D.nullable D.string))
        (D.field "descripcion" D.string)
        (D.field "cantidad" D.int)
        (D.field "categoria" Json.categoria)
        (D.field "proveedor" (D.nullable D.string))
        (D.field "dudoso" D.bool)
        |> D.andThen (\sinNota -> D.map sinNota (D.field "nota" (D.nullable D.string)))
