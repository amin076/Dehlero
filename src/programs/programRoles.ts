export type ProgramRole =
  | "hero.ball"
  | "hero.shuttle"
  | "hero.planet"
  | "hero.runway"
  | "camera.main"
  | "camera.record";

export type ProgramRoleBinding = {
  role: ProgramRole;
  nodeId: string;
};

export type ProgramRoleMap = Record<ProgramRole, string | null>;