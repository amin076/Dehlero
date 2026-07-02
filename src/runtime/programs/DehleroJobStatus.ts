export type DehleroJobState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

export type DehleroJobStatus = {
  jobId: string;
  programId: string;
  state: DehleroJobState;
  progress: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  output?: string;
  error?: string;
};
