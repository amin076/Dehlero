export type Vec3 = [number, number, number];

export type EasingName = "linear" | "easeInOut" | "easeOut" | "easeIn";

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

export type AddLightCommand = {
  type: "addLight";
  id: string;
  name?: string;
  kind: "ambient" | "directional" | "point";
  color?: string;
  intensity?: number;
  position?: Vec3;
};

export type ClearAiObjectsCommand = {
  type: "clearAiObjects";
};

export type RemoveObjectCommand = {
  type: "removeObject";
  id: string;
};

export type SetTransformCommand = {
  type: "setTransform";
  id: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
};

export type SetColorCommand = {
  type: "setColor";
  id: string;
  color: string;
};

export type AnimateObjectCommand = {
  type: "animateObject";
  id: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  duration: number;
  easing?: EasingName;
};

export type ProjectileObjectCommand = {
  type: "projectileObject";
  id: string;
  velocity: Vec3;
  gravity?: number;
  duration: number;
};

export type OrbitObjectCommand = {
  type: "orbitObject";
  id: string;
  center: Vec3;
  radius: number;
  height?: number;
  degrees: number;
  duration: number;
  easing?: EasingName;
};

export type SetCameraCommand = {
  type: "setCamera";
  position: Vec3;
  target: Vec3;
  fov?: number;
};

export type AnimateCameraCommand = {
  type: "animateCamera";
  position: Vec3;
  target: Vec3;
  duration: number;
  fov?: number;
  easing?: EasingName;
};

export type OrbitCameraCommand = {
  type: "orbitCamera";
  center: Vec3;
  radius: number;
  height: number;
  degrees: number;
  duration: number;
  fov?: number;
  easing?: EasingName;
};

export type FollowCameraCommand = {
  type: "followCamera";
  targetId: string;
  offset?: Vec3;
  duration: number;
  fov?: number;
};

export type DehleroCommand =
  | AddPrimitiveCommand
  | AddTextCommand
  | AddLightCommand
  | ClearAiObjectsCommand
  | RemoveObjectCommand
  | SetTransformCommand
  | SetColorCommand
  | AnimateObjectCommand
  | ProjectileObjectCommand
  | OrbitObjectCommand
  | SetCameraCommand
  | AnimateCameraCommand
  | OrbitCameraCommand
  | FollowCameraCommand;

export type DehleroCommandEnvelope = {
  dehleroCommand: true;
  version: "0.1";
  commands: DehleroCommand[];
};
