import type { RuntimeRequest } from "./RuntimeRequest";
import type { RuntimeResponse } from "./RuntimeResponse";
import { DehleroRuntime } from "../DehleroRuntime";

export class RuntimeDispatcher {

    private readonly runtime: DehleroRuntime;

    constructor(runtime: DehleroRuntime) {
        this.runtime = runtime;
    }

    async dispatch(
        request: RuntimeRequest,
    ): Promise<RuntimeResponse> {

        switch (request.method) {

            case "ping":

                return {

                    id: request.id,

                    ok: true,

                    payload: this.runtime.ping(),

                };

            case "getStatus":

                return {

                    id: request.id,

                    ok: true,

                    payload: this.runtime.getStatus(
                        request.payload as string,
                    ),

                };

            case "runProgram":

                return {

                    id: request.id,

                    ok: true,

                    payload: await this.runtime.runProgram(
                        request.payload as any,
                    ),

                };

            default:

                return {

                    id: request.id,

                    ok: false,

                    error: "Unknown runtime method.",

                };

        }

    }

}