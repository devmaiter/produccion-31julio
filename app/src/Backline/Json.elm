module Backline.Json exposing
    ( categoria
    , codificarPaquete
    , codificarVerificacion
    , decodificarPaquete
    , fecha
    , hora
    , identificador
    , item
    , paquete
    , propietario
    , tipoBloque
    , tipoDia
    , verificacion
    )

{-| Decodificadores y codificadores del JSON que produce el lector y que
guarda la app. Son estrictos: una fecha mal escrita, una categoría
desconocida o un campo opcional con el tipo equivocado son errores, no
datos que entran a medias.
-}

import Backline.Entidades as E exposing (Categoria, Propietario, TipoBloque, TipoDia)
import Char
import Json.Decode as D exposing (Decoder)
import Json.Encode as J



-- DECODIFICAR


decodificarPaquete : String -> Result String E.PaqueteEvento
decodificarPaquete texto =
    D.decodeString paquete texto |> Result.mapError D.errorToString


paquete : Decoder E.PaqueteEvento
paquete =
    D.succeed E.PaqueteEvento
        |> requerido "evento" evento
        |> requerido "escenarios" (D.list escenario)
        |> requerido "dias" (D.list dia)
        |> requerido "artistas" (D.list artista)
        |> requerido "bloques" (D.list bloque)
        |> requerido "items" (D.list item)
        |> requerido "stagePlots" (D.list stagePlot)


evento : Decoder E.Evento
evento =
    D.succeed E.Evento
        |> requerido "id" identificador
        |> requerido "nombre" textoNoVacio
        |> requerido "lugar" textoNoVacio
        |> requerido "ciudad" textoNoVacio
        |> requerido "desde" fecha
        |> requerido "hasta" fecha


escenario : Decoder E.Escenario
escenario =
    D.succeed E.Escenario
        |> requerido "id" identificador
        |> requerido "eventoId" identificador
        |> requerido "nombre" textoNoVacio


dia : Decoder E.Dia
dia =
    D.succeed E.Dia
        |> requerido "id" identificador
        |> requerido "eventoId" identificador
        |> requerido "fecha" fecha
        |> requerido "nombre" textoNoVacio
        |> requerido "tipo" tipoDia


artista : Decoder E.Artista
artista =
    D.succeed E.Artista
        |> requerido "id" identificador
        |> requerido "nombre" textoNoVacio


bloque : Decoder E.Bloque
bloque =
    D.succeed E.Bloque
        |> requerido "id" identificador
        |> requerido "diaId" identificador
        |> requerido "escenarioId" identificador
        |> opcional "artistaId" identificador
        |> requerido "titulo" textoNoVacio
        |> requerido "tipo" tipoBloque
        |> requerido "inicio" hora
        |> requerido "fin" hora


item : Decoder E.ItemBackline
item =
    D.succeed E.ItemBackline
        |> requerido "id" identificador
        |> requerido "eventoId" identificador
        |> requerido "diaId" identificador
        |> requerido "artistaId" identificador
        |> opcional "grupo" D.string
        |> requerido "descripcion" textoNoVacio
        |> requerido "cantidad" enteroNoNegativo
        |> requerido "categoria" categoria
        |> requerido "referencia" textoNoVacio
        |> requerido "propietario" propietario
        |> opcional "observacion" D.string
        |> conDefecto "porConfirmar" D.bool False
        |> conDefecto "chuleadoEnHoja" D.bool False
        |> opcional "origen" D.string


stagePlot : Decoder E.StagePlot
stagePlot =
    D.succeed E.StagePlot
        |> requerido "artistaId" identificador
        |> requerido "eventoId" identificador
        |> requerido "archivo" textoNoVacio
        |> opcional "descripcion" D.string


verificacion : Decoder E.Verificacion
verificacion =
    D.succeed E.Verificacion
        |> requerido "itemId" identificador
        |> opcional "contado" enteroNoNegativo
        |> conDefecto "listo" D.bool False
        |> opcional "cantidadCorregida" enteroNoNegativo
        |> opcional "actualizado" D.string


categoria : Decoder Categoria
categoria =
    enumerado "categoría" E.nombreACategoria


tipoDia : Decoder TipoDia
tipoDia =
    enumerado "tipo de día" E.nombreATipoDia


tipoBloque : Decoder TipoBloque
tipoBloque =
    enumerado "tipo de bloque" E.nombreATipoBloque


propietario : Decoder Propietario
propietario =
    D.field "tipo" D.string
        |> D.andThen
            (\tipo ->
                case tipo of
                    "propio" ->
                        D.succeed E.Propio

                    "tercero" ->
                        D.map E.Tercero (D.field "nombre" textoNoVacio)

                    "sin-definir" ->
                        D.succeed E.SinDefinir

                    otro ->
                        D.fail ("propietario desconocido: " ++ otro)
            )



-- CAMPOS


{-| Un campo que tiene que estar.
-}
requerido : String -> Decoder a -> Decoder (a -> b) -> Decoder b
requerido nombre dec =
    D.map2 (|>) (D.field nombre dec)


{-| Ausente o null → Nothing. Presente con el tipo equivocado → error.
-}
opcional : String -> Decoder a -> Decoder (Maybe a -> b) -> Decoder b
opcional nombre dec =
    D.map2 (|>) (campoOpcional nombre dec)


conDefecto : String -> Decoder a -> a -> Decoder (a -> b) -> Decoder b
conDefecto nombre dec defecto =
    D.map2 (|>) (D.map (Maybe.withDefault defecto) (campoOpcional nombre dec))


campoOpcional : String -> Decoder a -> Decoder (Maybe a)
campoOpcional nombre dec =
    D.maybe (D.field nombre D.value)
        |> D.andThen
            (\presente ->
                case presente of
                    Nothing ->
                        D.succeed Nothing

                    Just _ ->
                        D.field nombre (D.nullable dec)
            )


enumerado : String -> (String -> Maybe a) -> Decoder a
enumerado que leer =
    D.string
        |> D.andThen
            (\s ->
                case leer s of
                    Just v ->
                        D.succeed v

                    Nothing ->
                        D.fail (que ++ " desconocida: " ++ s)
            )



-- VALORES CON FORMA


{-| Minúsculas, números y guiones; empieza con letra o número.
-}
identificador : Decoder String
identificador =
    conForma "identificador" esIdentificador


esIdentificador : String -> Bool
esIdentificador s =
    case String.uncons s of
        Just ( c, _ ) ->
            (Char.isLower c || Char.isDigit c)
                && String.all (\x -> Char.isLower x || Char.isDigit x || x == '-') s

        Nothing ->
            False


{-| AAAA-MM-DD.
-}
fecha : Decoder String
fecha =
    conForma "fecha AAAA-MM-DD" esFecha


esFecha : String -> Bool
esFecha s =
    case String.split "-" s of
        [ a, m, d ] ->
            String.length a == 4 && String.length m == 2 && String.length d == 2 && soloDigitos (a ++ m ++ d)

        _ ->
            False


{-| HH:MM en 24 horas.
-}
hora : Decoder String
hora =
    conForma "hora HH:MM" esHora


esHora : String -> Bool
esHora s =
    case String.split ":" s of
        [ h, m ] ->
            String.length h
                == 2
                && String.length m
                == 2
                && soloDigitos (h ++ m)
                && (Maybe.withDefault 99 (String.toInt h) < 24)
                && (Maybe.withDefault 99 (String.toInt m) < 60)

        _ ->
            False


soloDigitos : String -> Bool
soloDigitos s =
    s /= "" && String.all Char.isDigit s


textoNoVacio : Decoder String
textoNoVacio =
    conForma "texto no vacío" (\s -> String.trim s /= "")


enteroNoNegativo : Decoder Int
enteroNoNegativo =
    D.int
        |> D.andThen
            (\n ->
                if n >= 0 then
                    D.succeed n

                else
                    D.fail ("número negativo: " ++ String.fromInt n)
            )


conForma : String -> (String -> Bool) -> Decoder String
conForma que valida =
    D.string
        |> D.andThen
            (\s ->
                if valida s then
                    D.succeed s

                else
                    D.fail ("se esperaba " ++ que ++ ", llegó: " ++ s)
            )



-- CODIFICAR


codificarPaquete : E.PaqueteEvento -> J.Value
codificarPaquete p =
    J.object
        [ ( "evento", codificarEvento p.evento )
        , ( "escenarios", J.list codificarEscenario p.escenarios )
        , ( "dias", J.list codificarDia p.dias )
        , ( "artistas", J.list codificarArtista p.artistas )
        , ( "bloques", J.list codificarBloque p.bloques )
        , ( "items", J.list codificarItem p.items )
        , ( "stagePlots", J.list codificarStagePlot p.stagePlots )
        ]


codificarEvento : E.Evento -> J.Value
codificarEvento e =
    J.object
        [ ( "id", J.string e.id )
        , ( "nombre", J.string e.nombre )
        , ( "lugar", J.string e.lugar )
        , ( "ciudad", J.string e.ciudad )
        , ( "desde", J.string e.desde )
        , ( "hasta", J.string e.hasta )
        ]


codificarEscenario : E.Escenario -> J.Value
codificarEscenario e =
    J.object
        [ ( "id", J.string e.id )
        , ( "eventoId", J.string e.eventoId )
        , ( "nombre", J.string e.nombre )
        ]


codificarDia : E.Dia -> J.Value
codificarDia d =
    J.object
        [ ( "id", J.string d.id )
        , ( "eventoId", J.string d.eventoId )
        , ( "fecha", J.string d.fecha )
        , ( "nombre", J.string d.nombre )
        , ( "tipo", J.string (E.tipoDiaANombre d.tipo) )
        ]


codificarArtista : E.Artista -> J.Value
codificarArtista a =
    J.object
        [ ( "id", J.string a.id )
        , ( "nombre", J.string a.nombre )
        ]


codificarBloque : E.Bloque -> J.Value
codificarBloque b =
    J.object
        ([ ( "id", J.string b.id )
         , ( "diaId", J.string b.diaId )
         , ( "escenarioId", J.string b.escenarioId )
         ]
            ++ siHay "artistaId" J.string b.artistaId
            ++ [ ( "titulo", J.string b.titulo )
               , ( "tipo", J.string (E.tipoBloqueANombre b.tipo) )
               , ( "inicio", J.string b.inicio )
               , ( "fin", J.string b.fin )
               ]
        )


codificarItem : E.ItemBackline -> J.Value
codificarItem i =
    J.object
        ([ ( "id", J.string i.id )
         , ( "eventoId", J.string i.eventoId )
         , ( "diaId", J.string i.diaId )
         , ( "artistaId", J.string i.artistaId )
         ]
            ++ siHay "grupo" J.string i.grupo
            ++ [ ( "descripcion", J.string i.descripcion )
               , ( "cantidad", J.int i.cantidad )
               , ( "categoria", J.string (E.categoriaANombre i.categoria) )
               , ( "referencia", J.string i.referencia )
               , ( "propietario", codificarPropietario i.propietario )
               ]
            ++ siHay "observacion" J.string i.observacion
            ++ [ ( "porConfirmar", J.bool i.porConfirmar )
               , ( "chuleadoEnHoja", J.bool i.chuleadoEnHoja )
               ]
            ++ siHay "origen" J.string i.origen
        )


codificarPropietario : Propietario -> J.Value
codificarPropietario p =
    case p of
        E.Propio ->
            J.object [ ( "tipo", J.string "propio" ) ]

        E.Tercero nombre ->
            J.object [ ( "tipo", J.string "tercero" ), ( "nombre", J.string nombre ) ]

        E.SinDefinir ->
            J.object [ ( "tipo", J.string "sin-definir" ) ]


codificarStagePlot : E.StagePlot -> J.Value
codificarStagePlot s =
    J.object
        ([ ( "artistaId", J.string s.artistaId )
         , ( "eventoId", J.string s.eventoId )
         , ( "archivo", J.string s.archivo )
         ]
            ++ siHay "descripcion" J.string s.descripcion
        )


codificarVerificacion : E.Verificacion -> J.Value
codificarVerificacion v =
    J.object
        ([ ( "itemId", J.string v.itemId )
         , ( "contado", Maybe.withDefault J.null (Maybe.map J.int v.contado) )
         , ( "listo", J.bool v.listo )
         ]
            ++ siHay "cantidadCorregida" J.int v.cantidadCorregida
            ++ siHay "actualizado" J.string v.actualizado
        )


{-| Un campo opcional solo se escribe si tiene valor.
-}
siHay : String -> (a -> J.Value) -> Maybe a -> List ( String, J.Value )
siHay nombre codificar valor =
    case valor of
        Just v ->
            [ ( nombre, codificar v ) ]

        Nothing ->
            []
