import type { DehleroJobStatus } from "./programs/DehleroJobStatus";
import type { DehleroProgram } from "./programs/DehleroProgram";
import { DehleroProgramRunner } from "./programs/DehleroProgramRunner";

export class DehleroRuntime {
  private readonly runner = new DehleroProgramRunner();
  private readonly jobs = new Map<string, DehleroJobStatus>();

  ping() {
    return {
      ok: true,
      runtime: "dehlero",
      version: "0.1.0",
    };
  }

  async runProgram(program: DehleroProgram) {
    const result = await this.runner.run(program);

    this.jobs.set(result.jobId, {
      jobId: result.jobId,
      programId: program.id,
      state: "completed",
      progress: 100,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      output: program.output,
    });

    return result;
  }

  getStatus(jobId: string) {
    return this.jobs.get(jobId) ?? null;
  }
}
