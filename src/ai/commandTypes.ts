export type Vec3 = [number, number, number];

export type AddPrimitiveCommand = {
  type: "addPrimitive";
  primitive: "cube" | "sphere" | "plane";
  id: string;
  name?: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  color?: string;
};

export type DehleroCommand = AddPrimitiveCommand;

export type DehleroCommandEnvelope = {
  dehleroCommand: true;
  version: "0.1";
  commands: DehleroCommand[];
};