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

export type AddTextCommand = {
  type: "addText";
  id: string;
  text: string;
  position?: Vec3;
  scale?: Vec3;
  color?: string;
  background?: string;
};

export type ClearAiObjectsCommand = {
  type: "clearAiObjects";
};

export type AnimateObjectCommand = {
  type: "animateObject";
  id: string;
  position?: Vec3;
  duration: number;
};

export type AnimateCameraCommand = {
  type: "animateCamera";
  position: Vec3;
  target: Vec3;
  duration: number;
};

export type OrbitCameraCommand = {
  type: "orbitCamera";
  center: Vec3;
  radius: number;
  height: number;
  degrees: number;
  duration: number;
};

export type DehleroCommand =
  | AddPrimitiveCommand
  | AddTextCommand
  | ClearAiObjectsCommand
  | AnimateObjectCommand
  | AnimateCameraCommand
  | OrbitCameraCommand;

export type DehleroCommandEnvelope = {
  dehleroCommand: true;
  version: "0.1";
  commands: DehleroCommand[];
};