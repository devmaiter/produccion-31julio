module Backline.Tablero exposing
    ( Documento
    , Espacio(..)
    , Filtro
    , Item
    , Model
    , Modo(..)
    , Msg(..)
    , Perfil(..)
    , Permiso(..)
    , decodificarEstado
    , decodificarMsg
    , docActual
    , guardable
    , inicial
    , modoEfectivo
    , normalizar
    , puede
    , puedeEscribir
    , update
    , visibles
    , vista
    )

{-| El tablero de backline: un solo estado para el admin y el empleado.

Los dos suben riders con la misma herramienta, buscan y filtran, y toman fotos
de las bandas. Hay dos espacios: el del evento (lo arma el admin; el empleado lo
ve pero no lo puede dañar) y "Mis pruebas", el escritorio propio donde cualquiera
sube, prueba y edita. Solo el admin tiene el modo festival (varias bandas, totales de
fondo), "Pide vs propuesta", la edición de ítems y la planilla .xlsx. Los
permisos se deciden aquí y no en la pantalla: un empleado que mande "editar"
no cambia nada.

JavaScript lee los archivos, guarda en el dispositivo y dibuja; este módulo
solo recibe mensajes y devuelve la vista que hay que dibujar.

-}

import Dict exposing (Dict)
import Json.Decode as D
import Json.Encode as E



-- MODELO


type Perfil
    = Admin
    | Empleado


type Modo
    = Normal
    | Festival


{-| Dónde se trabaja: el backline del evento (oficial, sincronizado con el cronograma) o "Mis
pruebas", el escritorio propio de cada quien (lo pidió el usuario: que el empleado pueda subir y
probar todo sin dañar lo que armó el admin).
-}
type Espacio
    = Evento
    | Pruebas


type alias Item =
    { id : String
    , diaId : String
    , artistaId : String
    , cantidad : Int
    , categoria : String
    , grupo : String
    , referencia : String
    , descripcion : String
    , nota : Maybe String
    , propietario : E.Value
    , porConfirmar : Bool
    , sinBanda : Bool
    }


type alias Documento =
    { nombre : String
    , archivos : List String
    , cuando : String
    , artistas : List { id : String, nombre : String }
    , dias : E.Value
    , bloques : E.Value
    , stagePlots : E.Value
    , comparaciones : List Comparacion
    , pedidos : E.Value
    , items : List Item
    }


{-| "Cant | Requerimiento | Cant | Propuesta" de una banda: se pasa tal cual a la pantalla.
-}
type alias Comparacion =
    { artistaId : String, valor : E.Value }


type alias Filtro =
    { texto : String
    , banda : Maybe String
    , categoria : Maybe String
    }


type alias Model =
    { perfil : Perfil
    , modo : Modo
    , espacio : Espacio
    , evento : Maybe Documento
    , pruebas : Maybe Documento
    , filtro : Filtro
    , fotos : Dict String (List String)
    }


inicial : Model
inicial =
    { perfil = Empleado, modo = Normal, espacio = Pruebas, evento = Nothing, pruebas = Nothing, filtro = sinFiltro, fotos = Dict.empty }


sinFiltro : Filtro
sinFiltro =
    { texto = "", banda = Nothing, categoria = Nothing }


type Msg
    = Cargar Documento
    | CargarEvento Documento
    | CambiarEspacio Espacio
    | Borrar
    | CambiarPerfil Perfil
    | CambiarModo Modo
    | Buscar String
    | FiltrarBanda (Maybe String)
    | FiltrarCategoria (Maybe String)
    | LimpiarFiltros
    | EditarItem { id : String, cantidad : Int, referencia : String, categoria : String }
    | BorrarItem String
    | AgregarFoto String String
    | QuitarFoto String String



-- PERMISOS


type Permiso
    = VerFestival
    | Editar
    | Comparar
    | Planilla


puede : Perfil -> Permiso -> Bool
puede perfil _ =
    perfil == Admin


{-| Editar, quitar ítems o borrar el documento: en "Mis pruebas" cualquiera; en el evento, solo el admin.
-}
puedeEscribir : Model -> Bool
puedeEscribir m =
    m.espacio == Pruebas || m.perfil == Admin


{-| El documento del espacio en el que se está.
-}
docActual : Model -> Maybe Documento
docActual m =
    case m.espacio of
        Evento ->
            m.evento

        Pruebas ->
            m.pruebas


{-| El empleado siempre ve el modo normal; el admin, el que eligió.
-}
modoEfectivo : Model -> Modo
modoEfectivo m =
    if puede m.perfil VerFestival then
        m.modo

    else
        Normal



-- UPDATE


update : Msg -> Model -> Model
update msg m =
    case msg of
        Cargar doc ->
            -- Un documento subido a mano: filtros limpios, y las fotos de bandas que ya no están se
            -- quedan guardadas (la banda puede volver con otro rider). El admin que está en el evento
            -- lo cambia; cualquier otro lo prueba en su escritorio y el evento queda intacto.
            if m.perfil == Admin && m.espacio == Evento then
                { m | evento = Just doc, filtro = sinFiltro }

            else
                { m | pruebas = Just doc, espacio = Pruebas, filtro = sinFiltro }

        CargarEvento doc ->
            -- El evento sincronizado con el cronograma: llega igual para todos.
            { m | evento = Just doc, espacio = Evento, filtro = sinFiltro }

        CambiarEspacio e ->
            { m | espacio = e, filtro = sinFiltro }

        Borrar ->
            if not (puedeEscribir m) then
                m

            else
                case m.espacio of
                    Evento ->
                        { m | evento = Nothing, filtro = sinFiltro }

                    Pruebas ->
                        { m | pruebas = Nothing, filtro = sinFiltro }

        CambiarPerfil p ->
            { m | perfil = p }

        CambiarModo modo ->
            if puede m.perfil VerFestival then
                { m | modo = modo }

            else
                m

        Buscar t ->
            conFiltro (\f -> { f | texto = t }) m

        FiltrarBanda b ->
            conFiltro (\f -> { f | banda = b }) m

        FiltrarCategoria c ->
            conFiltro (\f -> { f | categoria = c }) m

        LimpiarFiltros ->
            { m | filtro = sinFiltro }

        EditarItem e ->
            if puedeEscribir m && e.cantidad >= 1 && String.trim e.referencia /= "" then
                conItems (List.map (editar e)) m

            else
                m

        BorrarItem id ->
            if puedeEscribir m then
                conItems (List.filter (\i -> i.id /= id)) m

            else
                m

        AgregarFoto banda foto ->
            { m | fotos = Dict.update banda (\fs -> Just (Maybe.withDefault [] fs ++ [ foto ])) m.fotos }

        QuitarFoto banda foto ->
            { m | fotos = Dict.update banda (Maybe.map (List.filter ((/=) foto)) >> Maybe.andThen noVacia) m.fotos }


noVacia : List a -> Maybe (List a)
noVacia l =
    if List.isEmpty l then
        Nothing

    else
        Just l


conFiltro : (Filtro -> Filtro) -> Model -> Model
conFiltro f m =
    { m | filtro = f m.filtro }


conItems : (List Item -> List Item) -> Model -> Model
conItems f m =
    let
        cambiar =
            Maybe.map (\d -> { d | items = f d.items })
    in
    case m.espacio of
        Evento ->
            { m | evento = cambiar m.evento }

        Pruebas ->
            { m | pruebas = cambiar m.pruebas }


editar : { id : String, cantidad : Int, referencia : String, categoria : String } -> Item -> Item
editar e i =
    if i.id /= e.id then
        i

    else
        let
            ref =
                String.trim e.referencia
        in
        { i
            | cantidad = e.cantidad
            , referencia = ref
            , descripcion =
                if i.descripcion == i.referencia then
                    ref

                else
                    i.descripcion
            , categoria = e.categoria
            , porConfirmar = False
        }



-- BÚSQUEDA


{-| Minúsculas y sin tildes: "Batería" y "bateria" son lo mismo.
-}
normalizar : String -> String
normalizar =
    String.toLower >> String.map sinTilde


sinTilde : Char -> Char
sinTilde c =
    case c of
        'á' ->
            'a'

        'é' ->
            'e'

        'í' ->
            'i'

        'ó' ->
            'o'

        'ú' ->
            'u'

        'ü' ->
            'u'

        'ñ' ->
            'n'

        _ ->
            c


{-| Los ítems que pasan la búsqueda y los filtros. Cada palabra buscada tiene que estar en el ítem,
su sección, su categoría o el nombre de su banda.
-}
visibles : Model -> List Item
visibles m =
    case docActual m of
        Nothing ->
            []

        Just doc ->
            List.filter (pasa m.filtro doc) doc.items


pasa : Filtro -> Documento -> Item -> Bool
pasa f doc i =
    let
        palabras =
            String.words (normalizar f.texto)

        donde =
            normalizar (String.join " " [ i.referencia, i.descripcion, Maybe.withDefault "" i.nota, i.grupo, i.categoria, nombreBanda doc i.artistaId ])
    in
    List.all (\p -> String.contains p donde) palabras
        && (f.banda == Nothing || f.banda == Just i.artistaId)
        && (f.categoria == Nothing || f.categoria == Just i.categoria)


nombreBanda : Documento -> String -> String
nombreBanda doc id =
    doc.artistas |> List.filter (\a -> a.id == id) |> List.head |> Maybe.map .nombre |> Maybe.withDefault id



-- VISTA (lo que JavaScript dibuja)


vista : Model -> E.Value
vista m =
    let
        items =
            visibles m

        admin =
            puede m.perfil
    in
    E.object
        [ ( "perfil", perfilJson m.perfil )
        , ( "modo", modoJson (modoEfectivo m) )
        , ( "puede"
          , E.object
                [ ( "festival", E.bool (admin VerFestival) )
                , ( "editar", E.bool (puedeEscribir m) )
                , ( "borrar", E.bool (puedeEscribir m) )
                , ( "comparar", E.bool (admin Comparar) )
                , ( "planilla", E.bool (admin Planilla) )
                ]
          )
        , ( "espacio", espacioJson m.espacio )
        , ( "hay", E.object [ ( "evento", E.bool (m.evento /= Nothing) ), ( "pruebas", E.bool (m.pruebas /= Nothing) ) ] )
        , ( "doc"
          , case docActual m of
                Nothing ->
                    E.null

                Just doc ->
                    E.object
                        [ ( "nombre", E.string doc.nombre )
                        , ( "totalItems", E.int (List.length doc.items) )
                        , ( "cuando", E.string doc.cuando )
                        , ( "datos", datosJson doc items (admin Comparar) m.filtro )
                        ]
          )
        , ( "filtro", filtroJson m.filtro )
        , ( "hayFiltro", E.bool (m.filtro /= sinFiltro) )
        , ( "encontrados", E.int (List.length items) )
        , ( "opciones", opciones m )
        , ( "fotos", E.dict identity (E.list E.string) m.fotos )
        ]


datosJson : Documento -> List Item -> Bool -> Filtro -> E.Value
datosJson doc items comparar f =
    E.object
        [ ( "artistas", E.list (\a -> E.object [ ( "id", E.string a.id ), ( "nombre", E.string a.nombre ) ]) doc.artistas )
        , ( "dias", doc.dias )
        , ( "bloques", doc.bloques )
        , ( "stagePlots", doc.stagePlots )
        , ( "items", E.list itemJson items )
        , ( "pedidos", doc.pedidos )
        , ( "comparaciones"
          , if comparar then
                doc.comparaciones
                    |> List.filter (\c -> f.banda == Nothing || f.banda == Just c.artistaId)
                    |> E.list .valor

            else
                E.list identity []
          )
        ]


{-| Bandas y categorías del documento, con cuántos ítems tiene cada una.
-}
opciones : Model -> E.Value
opciones m =
    case docActual m of
        Nothing ->
            E.object [ ( "bandas", E.list identity [] ), ( "categorias", E.list identity [] ) ]

        Just doc ->
            let
                contar clave =
                    List.foldl (\i -> Dict.update (clave i) (Maybe.withDefault 0 >> (+) 1 >> Just)) Dict.empty doc.items

                porBanda =
                    contar .artistaId

                porCat =
                    contar .categoria

                cuenta d k =
                    Dict.get k d |> Maybe.withDefault 0
            in
            E.object
                [ ( "bandas"
                  , doc.artistas
                        |> List.filter (\a -> cuenta porBanda a.id > 0)
                        |> E.list (\a -> E.object [ ( "id", E.string a.id ), ( "nombre", E.string a.nombre ), ( "n", E.int (cuenta porBanda a.id) ) ])
                  )
                , ( "categorias", E.list (\( c, n ) -> E.object [ ( "nombre", E.string c ), ( "n", E.int n ) ]) (Dict.toList porCat) )
                ]


itemJson : Item -> E.Value
itemJson i =
    E.object
        ([ ( "id", E.string i.id )
         , ( "diaId", E.string i.diaId )
         , ( "artistaId", E.string i.artistaId )
         , ( "cantidad", E.int i.cantidad )
         , ( "categoria", E.string i.categoria )
         , ( "grupo", E.string i.grupo )
         , ( "referencia", E.string i.referencia )
         , ( "descripcion", E.string i.descripcion )
         , ( "nota", Maybe.map E.string i.nota |> Maybe.withDefault E.null )
         , ( "propietario", i.propietario )
         , ( "porConfirmar", E.bool i.porConfirmar )
         ]
            ++ (if i.sinBanda then
                    [ ( "sinBanda", E.bool True ) ]

                else
                    []
               )
        )


filtroJson : Filtro -> E.Value
filtroJson f =
    E.object
        [ ( "texto", E.string f.texto )
        , ( "banda", Maybe.map E.string f.banda |> Maybe.withDefault E.null )
        , ( "categoria", Maybe.map E.string f.categoria |> Maybe.withDefault E.null )
        ]


perfilJson : Perfil -> E.Value
perfilJson p =
    E.string
        (case p of
            Admin ->
                "admin"

            Empleado ->
                "empleado"
        )


espacioJson : Espacio -> E.Value
espacioJson e =
    E.string
        (case e of
            Evento ->
                "evento"

            Pruebas ->
                "pruebas"
        )


modoJson : Modo -> E.Value
modoJson modo =
    E.string
        (case modo of
            Normal ->
                "normal"

            Festival ->
                "festival"
        )



-- GUARDAR Y LEER (lo que JavaScript guarda en el dispositivo)


{-| Lo que se guarda: perfil, modo elegido, el espacio, los dos documentos (con lo editado) y fotos. Los filtros no.
-}
guardable : Model -> E.Value
guardable m =
    E.object
        [ ( "version", E.int 2 )
        , ( "perfil", perfilJson m.perfil )
        , ( "modo", modoJson m.modo )
        , ( "espacio", espacioJson m.espacio )
        , ( "evento", Maybe.map documentoJson m.evento |> Maybe.withDefault E.null )
        , ( "pruebas", Maybe.map documentoJson m.pruebas |> Maybe.withDefault E.null )
        , ( "fotos", E.dict identity (E.list E.string) m.fotos )
        ]


documentoJson : Documento -> E.Value
documentoJson d =
    E.object
        [ ( "nombre", E.string d.nombre )
        , ( "archivos", E.list E.string d.archivos )
        , ( "cuando", E.string d.cuando )
        , ( "datos"
          , E.object
                [ ( "artistas", E.list (\a -> E.object [ ( "id", E.string a.id ), ( "nombre", E.string a.nombre ) ]) d.artistas )
                , ( "dias", d.dias )
                , ( "bloques", d.bloques )
                , ( "stagePlots", d.stagePlots )
                , ( "items", E.list itemJson d.items )
                , ( "pedidos", d.pedidos )
                , ( "comparaciones", E.list .valor d.comparaciones )
                ]
          )
        ]


{-| Lo guardado en el dispositivo. Lo que falte o venga dañado vuelve a su valor inicial.
-}
decodificarEstado : D.Value -> Model
decodificarEstado v =
    let
        campo nombre dec def =
            D.decodeValue (D.field nombre dec) v |> Result.withDefault def
    in
    { perfil = campo "perfil" perfilDec Empleado
    , modo = campo "modo" modoDec Normal
    , espacio = campo "espacio" espacioDec Pruebas
    , evento = campo "evento" (D.nullable documentoDec) Nothing

    -- Lo guardado antes de los espacios (versión 1, un solo "doc") pasa a "Mis pruebas".
    , pruebas =
        if campo "version" D.int 1 >= 2 then
            campo "pruebas" (D.nullable documentoDec) Nothing

        else
            campo "doc" (D.nullable documentoDec) Nothing
    , filtro = sinFiltro
    , fotos = campo "fotos" (D.dict (D.list D.string)) Dict.empty
    }


perfilDec : D.Decoder Perfil
perfilDec =
    D.string
        |> D.andThen
            (\s ->
                case s of
                    "admin" ->
                        D.succeed Admin

                    "empleado" ->
                        D.succeed Empleado

                    _ ->
                        D.fail ("perfil desconocido: " ++ s)
            )


espacioDec : D.Decoder Espacio
espacioDec =
    D.string
        |> D.andThen
            (\s ->
                case s of
                    "evento" ->
                        D.succeed Evento

                    "pruebas" ->
                        D.succeed Pruebas

                    _ ->
                        D.fail ("espacio desconocido: " ++ s)
            )


modoDec : D.Decoder Modo
modoDec =
    D.string
        |> D.andThen
            (\s ->
                case s of
                    "normal" ->
                        D.succeed Normal

                    "festival" ->
                        D.succeed Festival

                    _ ->
                        D.fail ("modo desconocido: " ++ s)
            )


opcional : String -> D.Decoder a -> a -> D.Decoder a
opcional nombre dec def =
    D.oneOf [ D.field nombre (D.oneOf [ D.null def, dec ]), D.succeed def ]


listaCruda : String -> D.Decoder E.Value
listaCruda nombre =
    opcional nombre D.value (E.list identity [])


documentoDec : D.Decoder Documento
documentoDec =
    D.map4 (\nombre archivos cuando datos -> datos nombre archivos cuando)
        (D.field "nombre" D.string)
        (opcional "archivos" (D.list D.string) [])
        (opcional "cuando" D.string "")
        (D.field "datos" datosDec)


datosDec : D.Decoder (String -> List String -> String -> Documento)
datosDec =
    D.succeed
        (\artistas dias bloques plots comps pedidos items nombre archivos cuando ->
            { nombre = nombre
            , archivos = archivos
            , cuando = cuando
            , artistas = artistas
            , dias = dias
            , bloques = bloques
            , stagePlots = plots
            , comparaciones = comps
            , pedidos = pedidos
            , items = items
            }
        )
        |> con (opcional "artistas" (D.list (D.map2 (\id n -> { id = id, nombre = n }) (D.field "id" D.string) (D.field "nombre" D.string))) [])
        |> con (listaCruda "dias")
        |> con (listaCruda "bloques")
        |> con (listaCruda "stagePlots")
        |> con (opcional "comparaciones" (D.list comparacionDec) [])
        |> con (listaCruda "pedidos")
        |> con (D.field "items" (D.list itemDec))


comparacionDec : D.Decoder Comparacion
comparacionDec =
    D.map2 Comparacion (D.field "artistaId" D.string) D.value


itemDec : D.Decoder Item
itemDec =
    D.succeed Item
        |> con (D.field "id" D.string)
        |> con (opcional "diaId" D.string "d-doc")
        |> con (D.field "artistaId" D.string)
        |> con (opcional "cantidad" D.int 1)
        |> con (opcional "categoria" D.string "Otro")
        |> con (opcional "grupo" D.string "")
        |> con (D.field "referencia" D.string)
        |> con (opcional "descripcion" D.string "")
        |> con (opcional "nota" (D.map Just D.string) Nothing)
        |> con (opcional "propietario" D.value (E.object [ ( "tipo", E.string "propio" ) ]))
        |> con (opcional "porConfirmar" D.bool False)
        |> con (opcional "sinBanda" D.bool False)


con : D.Decoder a -> D.Decoder (a -> b) -> D.Decoder b
con =
    D.map2 (|>)



-- MENSAJES DE JAVASCRIPT


{-| Un mensaje de la pantalla: `{ "tipo": "buscar", "texto": "bombo" }`.
-}
decodificarMsg : D.Decoder Msg
decodificarMsg =
    D.field "tipo" D.string |> D.andThen mensaje


mensaje : String -> D.Decoder Msg
mensaje tipo =
    let
        texto =
            D.field "texto" D.string

        quizas nombre =
            D.field nombre (D.nullable D.string)
    in
    case tipo of
        "cargar" ->
            D.map Cargar (D.field "doc" documentoDec)

        "cargar-evento" ->
            D.map CargarEvento (D.field "doc" documentoDec)

        "espacio" ->
            D.map CambiarEspacio (D.field "espacio" espacioDec)

        "borrar" ->
            D.succeed Borrar

        "perfil" ->
            D.map CambiarPerfil (D.field "perfil" perfilDec)

        "modo" ->
            D.map CambiarModo (D.field "modo" modoDec)

        "buscar" ->
            D.map Buscar texto

        "banda" ->
            D.map FiltrarBanda (quizas "banda")

        "categoria" ->
            D.map FiltrarCategoria (quizas "categoria")

        "limpiar" ->
            D.succeed LimpiarFiltros

        "editar" ->
            D.map4 (\id q r c -> EditarItem { id = id, cantidad = q, referencia = r, categoria = c })
                (D.field "id" D.string)
                (D.field "cantidad" D.int)
                (D.field "referencia" D.string)
                (D.field "categoria" D.string)

        "quitar-item" ->
            D.map BorrarItem (D.field "id" D.string)

        "foto" ->
            D.map2 AgregarFoto (D.field "banda" D.string) (D.field "foto" D.string)

        "quitar-foto" ->
            D.map2 QuitarFoto (D.field "banda" D.string) (D.field "foto" D.string)

        _ ->
            D.fail ("mensaje desconocido: " ++ tipo)
