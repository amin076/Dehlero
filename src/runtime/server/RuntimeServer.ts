import { DehleroRuntime } from "../DehleroRuntime";

export class RuntimeServer {
  private readonly runtime: DehleroRuntime;
  private readonly port: number;

  constructor(port = 4010) {
    this.port = port;
    this.runtime = new DehleroRuntime();
  }

  start(): void {
    console.log("");
    console.log("================================");
    console.log(" Dehlero Browser Runtime Ready");
    console.log("================================");
    console.log("[Runtime] Browser-safe mode.");
    console.log("[Runtime] Port requested:", this.port);
    console.log("");

    const api = {
      ping: () => this.runtime.ping(),

      runProgram: async (program: unknown) =>
        await this.runtime.runProgram(program as any),

      getStatus: (jobId: string) =>
        this.runtime.getStatus(jobId),
    };

    (globalThis as any).__DEHLERO_RUNTIME__ = api;

    console.log("[Runtime] Available as window.__DEHLERO_RUNTIME__");
  }
}
