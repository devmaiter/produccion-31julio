module JsonTest exposing (suite)

import Backline.Entidades as E
import Backline.Extraccion as Extraccion
import Backline.Json as Json
import Expect
import Fixtures
import Json.Decode as D
import Json.Encode as J
import Test exposing (Test, describe, test)


suite : Test
suite =
    describe "Backline.Json"
        [ describe "tipos cerrados"
            [ test "toda categoría va y vuelve por su nombre" <|
                \_ ->
                    E.categorias
                        |> List.map (E.categoriaANombre >> E.nombreACategoria)
                        |> Expect.equal (List.map Just E.categorias)
            , test "todo tipo de bloque va y vuelve por su nombre" <|
                \_ ->
                    E.tiposBloque
                        |> List.map (E.tipoBloqueANombre >> E.nombreATipoBloque)
                        |> Expect.equal (List.map Just E.tiposBloque)
            , test "una categoría desconocida es un error, no un dato" <|
                \_ ->
                    D.decodeString Json.categoria "\"Micrófonos\""
                        |> Expect.err
            ]
        , describe "propietario"
            [ test "CN es propio" <|
                \_ -> decodifica Json.propietario """{"tipo":"propio"}""" |> Expect.equal (Ok E.Propio)
            , test "un tercero trae su nombre" <|
                \_ -> decodifica Json.propietario """{"tipo":"tercero","nombre":"OML"}""" |> Expect.equal (Ok (E.Tercero "OML"))
            , test "un tercero sin nombre es un error" <|
                \_ -> decodifica Json.propietario """{"tipo":"tercero"}""" |> Expect.err
            ]
        , describe "valores con forma"
            [ test "fecha" <|
                \_ ->
                    [ "2026-09-12", "12/09/2026", "2026-9-12", "" ]
                        |> List.map (\s -> decodifica Json.fecha (J.encode 0 (J.string s)) |> Result.toMaybe)
                        |> Expect.equal [ Just "2026-09-12", Nothing, Nothing, Nothing ]
            , test "hora" <|
                \_ ->
                    [ "09:00", "23:59", "9:00", "24:00", "09:60" ]
                        |> List.map (\s -> decodifica Json.hora (J.encode 0 (J.string s)) |> Result.toMaybe)
                        |> Expect.equal [ Just "09:00", Just "23:59", Nothing, Nothing, Nothing ]
            , test "identificador" <|
                \_ ->
                    [ "sean-paul", "d1", "Sean Paul", "-x", "" ]
                        |> List.map (\s -> decodifica Json.identificador (J.encode 0 (J.string s)) |> Result.toMaybe)
                        |> Expect.equal [ Just "sean-paul", Just "d1", Nothing, Nothing, Nothing ]
            ]
        , describe "ítem"
            [ test "los opcionales ausentes quedan en Nothing y los booleanos en False" <|
                \_ ->
                    decodifica Json.item itemMinimo
                        |> Result.map (\i -> ( i.grupo, i.porConfirmar, i.origen ))
                        |> Expect.equal (Ok ( Nothing, False, Nothing ))
            , test "un opcional con el tipo equivocado es un error (no se traga)" <|
                \_ ->
                    decodifica Json.item (String.replace "\"descripcion\"" "\"grupo\":5,\"descripcion\"" itemMinimo)
                        |> Expect.err
            , test "una cantidad negativa es un error" <|
                \_ ->
                    decodifica Json.item (String.replace "\"cantidad\":2" "\"cantidad\":-1" itemMinimo)
                        |> Expect.err
            ]
        , describe "eventos reales del lector (data/*.json)"
            [ test "Cordillera 2026: 337 ítems, 40 artistas, 3 días" <|
                \_ ->
                    Json.decodificarPaquete Fixtures.cordillera2026
                        |> Result.map (\p -> ( List.length p.items, List.length p.artistas, List.length p.dias ))
                        |> Expect.equal (Ok ( 337, 40, 3 ))
            , test "Simón Bolívar: 7 ítems y 4 stage plots" <|
                \_ ->
                    Json.decodificarPaquete Fixtures.simonBolivar2026
                        |> Result.map (\p -> ( List.length p.items, List.length p.stagePlots ))
                        |> Expect.equal (Ok ( 7, 4 ))
            , test "Vallenato al Parque: horario sin backline" <|
                \_ ->
                    Json.decodificarPaquete Fixtures.vallenato2026
                        |> Result.map (\p -> ( List.length p.bloques, List.length p.items ))
                        |> Expect.equal (Ok ( 28, 0 ))
            , test "codificar y volver a decodificar da lo mismo" <|
                \_ ->
                    case Json.decodificarPaquete Fixtures.cordillera2026 of
                        Ok p ->
                            J.encode 0 (Json.codificarPaquete p)
                                |> Json.decodificarPaquete
                                |> Expect.equal (Ok p)

                        Err e ->
                            Expect.fail e
            , test "todo ítem apunta a un día y un artista que existen" <|
                \_ ->
                    case Json.decodificarPaquete Fixtures.cordillera2026 of
                        Ok p ->
                            let
                                dias =
                                    List.map .id p.dias

                                artistas =
                                    List.map .id p.artistas
                            in
                            p.items
                                |> List.filter (\i -> not (List.member i.diaId dias && List.member i.artistaId artistas))
                                |> List.length
                                |> Expect.equal 0

                        Err e ->
                            Expect.fail e
            ]
        , describe "extracción del lector"
            [ test "el rider de ejemplo se decodifica completo" <|
                \_ ->
                    Extraccion.decodificar Fixtures.extraccionRider
                        |> Result.map (\e -> ( List.length e.items, List.length e.bloques, List.length e.avisos ))
                        |> Expect.equal (Ok ( 5, 5, 1 ))
            , test "conserva lo dudoso y el proveedor" <|
                \_ ->
                    Extraccion.decodificar Fixtures.extraccionRider
                        |> Result.map (\e -> e.items |> List.filter .dudoso |> List.map (\i -> ( i.descripcion, i.proveedor, i.categoria )))
                        |> Expect.equal (Ok [ ( "Stage fan", Nothing, E.Otro ) ])
            ]
        ]


decodifica : D.Decoder a -> String -> Result String a
decodifica dec texto =
    D.decodeString dec texto |> Result.mapError D.errorToString


itemMinimo : String
itemMinimo =
    """{"id":"d1-a-0","eventoId":"ev","diaId":"d1","artistaId":"a","descripcion":"Snare stand","cantidad":2,"categoria":"Bases","referencia":"Snare stand","propietario":{"tipo":"propio"}}"""
