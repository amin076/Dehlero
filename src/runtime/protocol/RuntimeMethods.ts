export const RuntimeMethods = {

    Ping: "ping",

    RunProgram: "runProgram",

    GetStatus: "getStatus",

    StopProgram: "stopProgram",

} as const;

export type RuntimeMethod =
    typeof RuntimeMethods[keyof typeof RuntimeMethods];