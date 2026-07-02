export type DehleroProgramFormat = "shorts" | "landscape" | "square";

export type DehleroProgram = {
  id: string;
  name: string;
  program: string;
  createdAt: string;
  output?: string;
  params?: {
    duration?: number;
    format?: DehleroProgramFormat;
    [key: string]: unknown;
  };
};
