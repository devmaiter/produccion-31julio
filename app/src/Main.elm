module Main exposing (main)

{-| Punto de partida de la app. Recibe los eventos como JSON (flags),
los decodifica con las entidades y muestra un resumen. Sin diseño aún:
lo que se prueba aquí es que el modelo de datos y el JSON del lector
encajan.
-}

import Backline.Entidades as E exposing (PaqueteEvento)
import Backline.Json
import Browser
import Html exposing (Html, div, h1, h2, option, p, select, span, table, tbody, td, text, th, thead, tr)
import Html.Attributes exposing (selected, style, value)
import Html.Events exposing (onInput)
import Json.Decode as D


main : Program D.Value Model Msg
main =
    Browser.element
        { init = init
        , update = update
        , view = view
        , subscriptions = \_ -> Sub.none
        }


type alias Model =
    { eventos : List PaqueteEvento
    , elegido : Maybe String
    , error : Maybe String
    }


type Msg
    = Elegir String


init : D.Value -> ( Model, Cmd Msg )
init flags =
    case D.decodeValue (D.list Backline.Json.paquete) flags of
        Ok eventos ->
            ( { eventos = eventos
              , elegido = List.head eventos |> Maybe.map (\p -> p.evento.id)
              , error = Nothing
              }
            , Cmd.none
            )

        Err e ->
            ( { eventos = [], elegido = Nothing, error = Just (D.errorToString e) }, Cmd.none )


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Elegir id ->
            ( { model | elegido = Just id }, Cmd.none )



-- VISTA


view : Model -> Html Msg
view model =
    div [ style "font-family" "system-ui, sans-serif", style "padding" "16px", style "max-width" "70ch" ]
        [ h1 [] [ text "Backline" ]
        , case model.error of
            Just e ->
                p [ style "color" "#c62828" ] [ text ("Los datos no se pudieron leer: " ++ e) ]

            Nothing ->
                div []
                    [ select [ onInput Elegir ] (List.map (opcion model.elegido) model.eventos)
                    , model.eventos
                        |> List.filter (\p -> Just p.evento.id == model.elegido)
                        |> List.head
                        |> Maybe.map verEvento
                        |> Maybe.withDefault (p [] [ text "Elige un evento." ])
                    ]
        ]


opcion : Maybe String -> PaqueteEvento -> Html Msg
opcion elegido p =
    option [ value p.evento.id, selected (Just p.evento.id == elegido) ] [ text p.evento.nombre ]


verEvento : PaqueteEvento -> Html Msg
verEvento p =
    div []
        [ p_ (p.evento.lugar ++ ", " ++ p.evento.ciudad ++ " · " ++ p.evento.desde ++ " a " ++ p.evento.hasta)
        , p_
            (String.join " · "
                [ conteo (List.length p.dias) "día" "días"
                , conteo (List.length p.escenarios) "escenario" "escenarios"
                , conteo (List.length p.artistas) "artista" "artistas"
                , conteo (List.length p.bloques) "bloque de horario" "bloques de horario"
                , conteo (List.length p.items) "ítem de backline" "ítems de backline"
                ]
            )
        , h2 [] [ text "Ítems por categoría" ]
        , tabla [ "Categoría", "Ítems", "Piezas" ]
            (E.categorias
                |> List.map
                    (\c ->
                        let
                            deLaCategoria =
                                List.filter (\i -> i.categoria == c) p.items
                        in
                        [ E.categoriaANombre c
                        , String.fromInt (List.length deLaCategoria)
                        , String.fromInt (List.sum (List.map .cantidad deLaCategoria))
                        ]
                    )
                |> List.filter (\fila -> List.drop 1 fila /= [ "0", "0" ])
            )
        , h2 [] [ text "Backline por artista" ]
        , tabla [ "Artista", "Ítems", "Por confirmar", "De terceros" ]
            (p.artistas
                |> List.map
                    (\a ->
                        let
                            suyos =
                                List.filter (\i -> i.artistaId == a.id) p.items
                        in
                        [ a.nombre
                        , String.fromInt (List.length suyos)
                        , String.fromInt (List.length (List.filter .porConfirmar suyos))
                        , String.fromInt (List.length (List.filter (\i -> esTercero i.propietario) suyos))
                        ]
                    )
                |> List.filter (\fila -> List.drop 1 fila /= [ "0", "0", "0" ])
            )
        ]


esTercero : E.Propietario -> Bool
esTercero prop =
    case prop of
        E.Tercero _ ->
            True

        E.Propio ->
            False

        E.SinDefinir ->
            False


conteo : Int -> String -> String -> String
conteo n singular plural =
    String.fromInt n
        ++ " "
        ++ (if n == 1 then
                singular

            else
                plural
           )


p_ : String -> Html msg
p_ t =
    p [] [ text t ]


tabla : List String -> List (List String) -> Html msg
tabla encabezados filas =
    table [ style "border-collapse" "collapse" ]
        [ thead [] [ tr [] (List.map (\e -> th [ style "text-align" "left", style "padding" "4px 12px 4px 0" ] [ text e ]) encabezados) ]
        , tbody [] (List.map (\fila -> tr [] (List.map (\celda -> td [ style "padding" "2px 12px 2px 0" ] [ text celda ]) fila)) filas)
        ]
