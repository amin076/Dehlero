import type { ShotOverlayCue } from "./ShotOverlayTypes";

export type ShotType =
  | "static"
  | "orbit"
  | "close-up"
  | "dolly"
  | "crane"
  | "follow"
  | "theatre"
  | "programmatic";

export interface BaseShotDefinition {
  id: string;
  name: string;
  type: ShotType;
  duration: number;
  overlays: ShotOverlayCue[];
}

export interface StaticShotDefinition extends BaseShotDefinition {
  type: "static";
}

export interface OrbitShotDefinition extends BaseShotDefinition {
  type: "orbit";
  targetNodeId?: string;
  radius: number;
  height: number;
  angleDeg: number;
}

export interface CloseUpShotDefinition extends BaseShotDefinition {
  type: "close-up";
  targetNodeId?: string;
  distance: number;
  height: number;
}

export interface DollyShotDefinition extends BaseShotDefinition {
  type: "dolly";
  fromDistance: number;
  toDistance: number;
  targetNodeId?: string;
}

export interface CraneShotDefinition extends BaseShotDefinition {
  type: "crane";
  startHeight: number;
  endHeight: number;
  targetNodeId?: string;
}

export interface FollowShotDefinition extends BaseShotDefinition {
  type: "follow";
  targetNodeId?: string;
  distance: number;
  height: number;
}

export interface TheatreShotDefinition extends BaseShotDefinition {
  type: "theatre";
  sequenceName?: string;
}

export interface ProgrammaticShotDefinition extends BaseShotDefinition {
  type: "programmatic";
  programId?: string;
}

export type ShotDefinition =
  | StaticShotDefinition
  | OrbitShotDefinition
  | CloseUpShotDefinition
  | DollyShotDefinition
  | CraneShotDefinition
  | FollowShotDefinition
  | TheatreShotDefinition
  | ProgrammaticShotDefinition;

export function createBaseShot(
  type: ShotType,
  name: string,
  duration = 5,
): BaseShotDefinition {
  return {
    id: `shot-${crypto.randomUUID()}`,
    name,
    type,
    duration,
    overlays: [],
  };
}
