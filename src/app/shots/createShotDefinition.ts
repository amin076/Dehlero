import type {
  CloseUpShotDefinition,
  CraneShotDefinition,
  DollyShotDefinition,
  FollowShotDefinition,
  OrbitShotDefinition,
  ProgrammaticShotDefinition,
  ShotDefinition,
  ShotType,
  StaticShotDefinition,
  TheatreShotDefinition,
} from "./ShotTypes";

import { createDefaultTitleCue } from "./ShotOverlayTypes";

export function createShotDefinition(
  type: ShotType,
  duration = 5,
): ShotDefinition {
  const base = {
    id: `shot-${crypto.randomUUID()}`,
    name: getDefaultShotName(type),
    duration,
    overlays: [createDefaultTitleCue()],
  };

  switch (type) {
    case "orbit":
      return {
        ...base,
        type,
        targetNodeId: undefined,
        radius: 8,
        height: 2.5,
        angleDeg: 180,
      } satisfies OrbitShotDefinition;

    case "close-up":
      return {
        ...base,
        type,
        targetNodeId: undefined,
        distance: 3,
        height: 1.4,
      } satisfies CloseUpShotDefinition;

    case "dolly":
      return {
        ...base,
        type,
        targetNodeId: undefined,
        fromDistance: 10,
        toDistance: 4,
      } satisfies DollyShotDefinition;

    case "crane":
      return {
        ...base,
        type,
        targetNodeId: undefined,
        startHeight: 1.5,
        endHeight: 8,
      } satisfies CraneShotDefinition;

    case "follow":
      return {
        ...base,
        type,
        targetNodeId: undefined,
        distance: 6,
        height: 2,
      } satisfies FollowShotDefinition;

    case "theatre":
      return {
        ...base,
        type,
        sequenceName: "Main",
      } satisfies TheatreShotDefinition;

    case "programmatic":
      return {
        ...base,
        type,
        programId: undefined,
      } satisfies ProgrammaticShotDefinition;

    case "static":
    default:
      return {
        ...base,
        type: "static",
      } satisfies StaticShotDefinition;
  }
}

function getDefaultShotName(type: ShotType) {
  switch (type) {
    case "orbit":
      return "Orbit Shot";
    case "close-up":
      return "Close Up Shot";
    case "dolly":
      return "Dolly Shot";
    case "crane":
      return "Crane Shot";
    case "follow":
      return "Follow Shot";
    case "theatre":
      return "Theatre Shot";
    case "programmatic":
      return "Programmatic Shot";
    case "static":
    default:
      return "Static Shot";
  }
}