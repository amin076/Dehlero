import { WebSocketServer } from "ws";

import { DehleroRuntime } from "../DehleroRuntime";
import { RuntimeDispatcher } from "../protocol/RuntimeDispatcher";

import type { RuntimeRequest } from "../protocol/RuntimeRequest";

export class RuntimeServer {

    private readonly runtime: DehleroRuntime;

    private readonly dispatcher: RuntimeDispatcher;

    private readonly server: WebSocketServer;

    constructor(port = 4010) {

        this.runtime = new DehleroRuntime();

        this.dispatcher = new RuntimeDispatcher(
            this.runtime,
        );

        this.server = new WebSocketServer({

            port,

        });

    }

    start() {

        console.log("");

        console.log("================================");

        console.log(" Dehlero Runtime Started");

        console.log("================================");

        console.log("");

        this.server.on("connection", socket => {

            console.log("[Runtime] Client Connected");

            socket.on("message", async raw => {

                try {

                    const request =
                        JSON.parse(
                            raw.toString(),
                        ) as RuntimeRequest;

                    const response =
                        await this.dispatcher.dispatch(
                            request,
                        );

                    socket.send(
                        JSON.stringify(
                            response,
                        ),
                    );

                }

                catch (error) {

                    socket.send(

                        JSON.stringify({

                            id: "",

                            ok: false,

                            error:
                                error instanceof Error
                                    ? error.message
                                    : "Unknown Error",

                        }),

                    );

                }

            });

        });

    }

}