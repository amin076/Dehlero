import type { DehleroProgram } from "./DehleroProgram";

export type ProgramRunResult = {
  jobId: string;
};

export class DehleroProgramRunner {
  async run(program: DehleroProgram): Promise<ProgramRunResult> {
    const jobId = `dehlero-job-${Date.now()}`;

    console.log("[DehleroProgramRunner] run:", program.program);
    console.log("[DehleroProgramRunner] jobId:", jobId);

    return {
      jobId,
    };
  }
}
