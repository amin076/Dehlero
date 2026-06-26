import * as THREE from "three";
import type { ISheetObject } from "@theatre/core";

export type LibraryCategory =
  | "3D"
  | "2D"
  | "Planets"
  | "Environment"
  | "Lights"
  | "Camera";

export type LibraryItem = {
  id: string;
  label: string;
  category: LibraryCategory;
  create: () => THREE.Object3D;
};

export type UpdatableHelper = {
  update: () => void;
};

export type SceneHelper = THREE.Object3D & UpdatableHelper;

export type NodeSource =
  | { type: "library"; libraryId: string }
  | { type: "model"; assetKey: string; fileName: string }
  | { type: "textured-planet"; assetKey: string; fileName: string }
  | { type: "ambient" };

export type SavedObject = {
  name: string;
  source: NodeSource;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  texture?: {
    assetKey: string;
    fileName: string;
  };
};

export type SavedScene = {
  version: 1 | 2;
  name: string;
  objects: SavedObject[];
  timeline?: SavedTimelineClip[];
};

export type MotionPreset = "spin" | "pulse" | "float" | "color-shift";

export type CameraShot =
  | "static"
  | "orbit"
  | "dolly-in"
  | "dolly-out"
  | "close-up"
  | "dolly-zoom"
  | "pan-left"
  | "pan-right"
  | "crane-up"
  | "crane-down"
  | "hero";
export type RecordingAspect = "16:9" | "9:16";

export type WorkspaceMode = "scene" | "shots" | "animate" | "record";

export type CameraShotRigOptions = {
  orbitDegrees?: number;
  distanceMultiplier?: number;
  heightMultiplier?: number;
  fov?: number;
};

export type SavedTimelineClip =
  | {
      kind: "camera-shot";
      shot: CameraShot;
      start: number;
      duration: number;
      cameraName: string;
      targetName?: string;
      orbitDegrees?: number;
      distanceMultiplier?: number;
    }
  | {
      kind: "object-motion";
      preset: MotionPreset;
      start: number;
      duration: number;
      targetName: string;
      loop: boolean;
    };

export type CameraOption = {
  id: string;
  label: string;
};

export type ShotListItem = {
  id: string;
  label: string;
  cameraLabel: string;
  targetLabel: string;
  duration: number;
  active?: boolean;
  orbitDegrees?: number;
  distanceMultiplier?: number;
  heightMultiplier?: number;
  fov?: number;
};

export type TimelineDockItem = ShotListItem & {
  start: number;
  kind: "camera-shot" | "object-motion";
};

export type TimelineAnimation = {
  id: string;
  name: string;
  kind?: "object-motion" | "camera-shot";
  metadata?: {
    cameraLabel?: string;
    preset?: MotionPreset;
    shot?: CameraShot;
    targetLabel?: string;
  };
  elapsed: number;
  delay: number;
  duration: number;
  loop: boolean;
  started: boolean;
  finished: boolean;
  start?: () => void;
  update: (progress: number, delta: number) => void;
  complete?: () => void;
  orbitDegrees?: number;
  distanceMultiplier?: number;
  heightMultiplier?: number;
  fov?: number;
};

export type TheatreBinding = {
  objectKey: string;
  theatreObject: ISheetObject<any>;
  unsubscribe: () => void;
};

export type TheatrePrimitivePath = Array<string | number>;

export type TheatreInternalStudio = {
  transaction: (callback: (api: {
    stateEditors: {
      coreByProject: {
        historic: {
          sheetsById: {
            sequence: {
              setPrimitivePropAsSequenced: (
                address: Record<string, unknown> & {
                  pathToProp: TheatrePrimitivePath;
                },
                propConfig?: unknown,
              ) => void;
            };
          };
        };
      };
    };
  }) => void) => void;
};
