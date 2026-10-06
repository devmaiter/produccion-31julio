module TableroTest exposing (suite)

import Backline.Tablero as T exposing (Modo(..), Msg(..), Perfil(..))
import Dict
import Expect
import Json.Decode as D
import Json.Encode as E
import Test exposing (Test, describe, test)


{-| Un rider de una banda, como lo arma la pantalla con lo que leyó el lector.
-}
riderJson : String
riderJson =
    """
    { "tipo": "cargar", "doc": { "nombre": "Rider Los Rayos", "archivos": ["rider.pdf"], "cuando": "2026-10-05",
      "datos": { "artistas": [ { "id": "los-rayos", "nombre": "Los Rayos" }, { "id": "la-otra", "nombre": "La Otra" } ],
        "dias": [ { "id": "d-doc", "nombre": "Del documento", "tipo": "show" } ],
        "comparaciones": [ { "artistaId": "los-rayos", "diaId": "d-doc", "hoja": "ST4", "filas": [] } ],
        "items": [
          { "id": "doc-0", "diaId": "d-doc", "artistaId": "los-rayos", "cantidad": 1, "categoria": "Batería", "grupo": "Drums", "referencia": "Bombo 22\\"", "descripcion": "Bombo 22\\"" },
          { "id": "doc-1", "diaId": "d-doc", "artistaId": "los-rayos", "cantidad": 1, "categoria": "Ampli bajo", "grupo": "Bajo", "referencia": "Ampeg SVT Classic", "descripcion": "Ampeg SVT Classic", "porConfirmar": true },
          { "id": "doc-2", "diaId": "d-doc", "artistaId": "la-otra", "cantidad": 2, "categoria": "Batería", "grupo": "Batería", "referencia": "Redoblante", "descripcion": "Redoblante" }
        ] } } }
    """


enviar : String -> T.Model -> T.Model
enviar json m =
    case D.decodeString T.decodificarMsg json of
        Ok msg ->
            T.update msg m

        Err e ->
            Debug.todo (D.errorToString e)


conRider : Perfil -> T.Model
conRider perfil =
    T.update (CambiarPerfil perfil) T.inicial |> enviar riderJson


refs : T.Model -> List String
refs m =
    T.visibles m |> List.map .referencia


campo : List String -> D.Decoder a -> T.Model -> Result D.Error a
campo ruta dec m =
    D.decodeValue (D.at ruta dec) (T.vista m)


suite : Test
suite =
    describe "Backline.Tablero"
        [ describe "perfiles"
            [ test "se arranca como empleado y en modo normal" <|
                \_ -> Expect.equal ( T.inicial.perfil, T.modoEfectivo T.inicial ) ( Empleado, Normal )
            , test "el empleado no puede pasar a modo festival" <|
                \_ -> conRider Empleado |> T.update (CambiarModo Festival) |> T.modoEfectivo |> Expect.equal Normal
            , test "el admin sí" <|
                \_ -> conRider Admin |> T.update (CambiarModo Festival) |> T.modoEfectivo |> Expect.equal Festival
            , test "si el admin pasa a empleado, ve el modo normal" <|
                \_ -> conRider Admin |> T.update (CambiarModo Festival) |> T.update (CambiarPerfil Empleado) |> T.modoEfectivo |> Expect.equal Normal
            , test "el empleado no edita ni borra ítems" <|
                \_ ->
                    conRider Empleado
                        |> T.update (EditarItem { id = "doc-0", cantidad = 3, referencia = "Otra cosa", categoria = "Otro" })
                        |> T.update (BorrarItem "doc-1")
                        |> refs
                        |> Expect.equal [ "Bombo 22\"", "Ampeg SVT Classic", "Redoblante" ]
            , test "el admin edita: la pieza queda confirmada" <|
                \_ ->
                    conRider Admin
                        |> enviar """{ "tipo": "editar", "id": "doc-1", "cantidad": 2, "referencia": "  Ampeg SVT-VR ", "categoria": "Ampli bajo" }"""
                        |> T.visibles
                        |> List.filter (\i -> i.id == "doc-1")
                        |> List.map (\i -> ( i.cantidad, i.referencia, i.porConfirmar ))
                        |> Expect.equal [ ( 2, "Ampeg SVT-VR", False ) ]
            , test "una edición sin nombre o con cantidad 0 no se aplica" <|
                \_ ->
                    conRider Admin
                        |> T.update (EditarItem { id = "doc-0", cantidad = 0, referencia = "Bombo", categoria = "Batería" })
                        |> T.update (EditarItem { id = "doc-0", cantidad = 1, referencia = "  ", categoria = "Batería" })
                        |> refs
                        |> List.head
                        |> Expect.equal (Just "Bombo 22\"")
            , test "el admin borra un ítem" <|
                \_ -> conRider Admin |> T.update (BorrarItem "doc-1") |> refs |> Expect.equal [ "Bombo 22\"", "Redoblante" ]
            , test "Pide vs propuesta solo le llega al admin" <|
                \_ ->
                    Expect.equal
                        ( campo [ "doc", "datos", "comparaciones" ] (D.list D.value) (conRider Admin) |> Result.map List.length
                        , campo [ "doc", "datos", "comparaciones" ] (D.list D.value) (conRider Empleado) |> Result.map List.length
                        )
                        ( Ok 1, Ok 0 )
            , test "la vista dice de qué documento viene y cuándo se subió" <|
                \_ ->
                    conRider Empleado
                        |> campo [ "doc" ] (D.map2 Tuple.pair (D.field "nombre" D.string) (D.field "cuando" D.string))
                        |> Expect.equal (Ok ( "Rider Los Rayos", "2026-10-05" ))
            , test "la vista dice qué puede hacer cada perfil" <|
                \_ ->
                    Expect.equal
                        ( campo [ "puede", "editar" ] D.bool (conRider Admin), campo [ "puede", "editar" ] D.bool (conRider Empleado) )
                        ( Ok True, Ok False )
            ]
        , describe "buscador y filtros (los dos perfiles)"
            [ test "busca sin importar tildes ni mayúsculas" <|
                \_ -> conRider Empleado |> enviar """{ "tipo": "buscar", "texto": "BATERIA" }""" |> refs |> Expect.equal [ "Bombo 22\"", "Redoblante" ]
            , test "busca por el nombre de la banda" <|
                \_ -> conRider Empleado |> T.update (Buscar "rayos") |> refs |> Expect.equal [ "Bombo 22\"", "Ampeg SVT Classic" ]
            , test "todas las palabras tienen que estar" <|
                \_ -> conRider Empleado |> T.update (Buscar "ampeg classic") |> refs |> Expect.equal [ "Ampeg SVT Classic" ]
            , test "filtra por banda y por categoría a la vez" <|
                \_ ->
                    conRider Empleado
                        |> enviar """{ "tipo": "banda", "banda": "la-otra" }"""
                        |> enviar """{ "tipo": "categoria", "categoria": "Batería" }"""
                        |> refs
                        |> Expect.equal [ "Redoblante" ]
            , test "limpiar deja ver todo" <|
                \_ -> conRider Empleado |> T.update (Buscar "zzz") |> T.update T.LimpiarFiltros |> refs |> List.length |> Expect.equal 3
            , test "las opciones cuentan los ítems de cada banda" <|
                \_ ->
                    conRider Empleado
                        |> campo [ "opciones", "bandas" ] (D.list (D.map2 Tuple.pair (D.field "nombre" D.string) (D.field "n" D.int)))
                        |> Expect.equal (Ok [ ( "Los Rayos", 2 ), ( "La Otra", 1 ) ])
            ]
        , describe "fotos de las bandas"
            [ test "los dos perfiles agregan y quitan fotos" <|
                \_ ->
                    conRider Empleado
                        |> enviar """{ "tipo": "foto", "banda": "los-rayos", "foto": "f1" }"""
                        |> T.update (AgregarFoto "los-rayos" "f2")
                        |> T.update (QuitarFoto "los-rayos" "f1")
                        |> .fotos
                        |> Dict.toList
                        |> Expect.equal [ ( "los-rayos", [ "f2" ] ) ]
            , test "al quitar la última foto la banda queda sin fotos" <|
                \_ -> conRider Empleado |> T.update (AgregarFoto "x" "f1") |> T.update (QuitarFoto "x" "f1") |> .fotos |> Dict.isEmpty |> Expect.equal True
            ]
        , describe "guardar en el dispositivo"
            [ test "lo guardado vuelve igual (sin los filtros)" <|
                \_ ->
                    let
                        m =
                            conRider Admin |> T.update (CambiarModo Festival) |> T.update (AgregarFoto "los-rayos" "f1") |> T.update (Buscar "bombo")

                        vuelto =
                            T.decodificarEstado (T.guardable m)
                    in
                    Expect.equal ( vuelto.perfil, vuelto.modo, ( vuelto.fotos, Maybe.map (.items >> List.length) vuelto.doc, vuelto.filtro.texto ) )
                        ( Admin, Festival, ( m.fotos, Just 3, "" ) )
            , test "lo que pidió la banda llega a la vista y se guarda tal cual" <|
                \_ ->
                    let
                        pedidos =
                            E.list identity [ E.object [ ( "artistaId", E.string "los-rayos" ), ( "renglones", E.list E.string [ "DRUMS: DW, YAMAHA" ] ) ] ]

                        m =
                            conRider Admin
                                |> T.update
                                    (Cargar
                                        { nombre = "r"
                                        , archivos = []
                                        , cuando = ""
                                        , artistas = []
                                        , dias = E.list identity []
                                        , bloques = E.list identity []
                                        , stagePlots = E.list identity []
                                        , comparaciones = []
                                        , pedidos = pedidos
                                        , items = []
                                        }
                                    )

                        vuelto =
                            T.decodificarEstado (T.guardable m)
                    in
                    Expect.equal
                        ( campo [ "doc", "datos", "pedidos" ] D.value m |> Result.map (E.encode 0)
                        , Maybe.map (.pedidos >> E.encode 0) vuelto.doc
                        )
                        ( Ok (E.encode 0 pedidos), Just (E.encode 0 pedidos) )
            , test "algo dañado en el dispositivo arranca de cero" <|
                \_ -> T.decodificarEstado (E.string "basura") |> .perfil |> Expect.equal Empleado
            , test "un mensaje desconocido no se acepta" <|
                \_ -> D.decodeString T.decodificarMsg """{ "tipo": "hackear" }""" |> Result.toMaybe |> Expect.equal Nothing
            ]
        ]
