port module Tablero exposing (main)

{-| El núcleo del tablero sin pantalla: recibe mensajes de JavaScript por `entrada` y
devuelve por `vista` lo que hay que dibujar y por `guardar` lo que hay que guardar en
el dispositivo. La lógica vive en `Backline.Tablero`.
-}

import Backline.Tablero as T
import Json.Decode as D
import Json.Encode as E


port entrada : (D.Value -> msg) -> Sub msg


port vista : E.Value -> Cmd msg


port guardar : E.Value -> Cmd msg


port error : String -> Cmd msg


type Msg
    = Llega D.Value


main : Program D.Value T.Model Msg
main =
    Platform.worker
        { init =
            \guardado ->
                let
                    m =
                        T.decodificarEstado guardado
                in
                ( m, vista (T.vista m) )
        , update = update
        , subscriptions = \_ -> entrada Llega
        }


update : Msg -> T.Model -> ( T.Model, Cmd Msg )
update (Llega v) m =
    case D.decodeValue T.decodificarMsg v of
        Ok msg ->
            let
                nuevo =
                    T.update msg m
            in
            ( nuevo, Cmd.batch [ vista (T.vista nuevo), guardar (T.guardable nuevo) ] )

        Err e ->
            ( m, error (D.errorToString e) )
