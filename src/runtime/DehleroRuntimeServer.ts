import { WebSocketServer } from "ws";
import type { RpcRequest } from "./RpcRequest.js";
import type { RpcResponse } from "./RpcResponse.js";

export class DehleroRuntimeServer {

    private server: WebSocketServer;

    constructor(
        port = 4010,
    ) {

        this.server = new WebSocketServer({
            port,
        });

    }

    start() {

        console.log("=================================");
        console.log(" Dehlero Runtime");
        console.log("=================================");

        this.server.on("connection", socket => {

            console.log("Keynu Connected.");

            socket.on("message", raw => {

                const request =
                    JSON.parse(
                        raw.toString(),
                    ) as RpcRequest;

                console.log(
                    "[RPC]",
                    request.method,
                );

                const response: RpcResponse = {

                    id: request.id,

                    ok: true,

                    payload: {

                        runtime: "dehlero",

                        version: "0.1.0",

                        received: request.method,

                    },

                };

                socket.send(
                    JSON.stringify(response),
                );

            });

        });

    }

}