import * as THREE from "three";
import type { ISheet, ISheetObject } from "@theatre/core";
import type { SceneNode } from "../core/scene/SceneNode";
import type {
  TimelineAnimation,
  TheatreBinding,
} from "./studioTypes";
import {
  colorToRgba,
  getFirstStandardMaterial,
} from "./studioMath";
import { createCameraShotFrames } from "./studioCameraShots";
import {
  sequenceTheatrePrimitiveProps,
  studio,
} from "./studioTheatre";

export function setTheatreObjectAt({
  theatreSheet,
  position,
  theatreObject,
  values,
}: {
  theatreSheet: ISheet | null;
  position: number;
  theatreObject: ISheetObject<any>;
  values: Record<string, unknown>;
}) {
  if (!theatreSheet) return;

  theatreSheet.sequence.position = position;

  studio.transaction(({ set }) => {
    const setValue = set as (pointer: unknown, value: unknown) => void;

    Object.entries(values).forEach(([key, value]) => {
      setValue((theatreObject.props as Record<string, unknown>)[key], value);
    });
  });
}

export function bakeCameraShotToTheatre({
  clip,
  theatreSheet,
  getCameraByName,
  getTheatreCameraByName,
  findSceneNodeByName,
  cameraStates,
}: {
  clip: TimelineAnimation;
  theatreSheet: ISheet;
  getCameraByName: (name: string) => THREE.PerspectiveCamera;
  getTheatreCameraByName: (name: string) => ISheetObject<any> | null;
  findSceneNodeByName: (name?: string) => SceneNode | null;
  cameraStates: Map<string, { position: THREE.Vector3; fov: number }>;
}) {
  if (clip.kind !== "camera-shot" || !clip.metadata?.shot) return;

  const cameraName = clip.metadata.cameraLabel ?? "Main View";
  const sourceCamera = getCameraByName(cameraName);
  const theatreCamera = getTheatreCameraByName(cameraName);

  if (!theatreCamera) return;

  sequenceTheatrePrimitiveProps(theatreCamera, [
    ["position", "x"],
    ["position", "y"],
    ["position", "z"],
    ["rotation", "x"],
    ["rotation", "y"],
    ["rotation", "z"],
    ["camera", "fov"],
  ]);

  const state = cameraStates.get(cameraName) ?? {
    position: sourceCamera.position.clone(),
    fov: sourceCamera.fov,
  };

  const targetNode =
    clip.metadata.targetLabel &&
    clip.metadata.targetLabel !== "Scene center"
      ? findSceneNodeByName(clip.metadata.targetLabel)
      : null;

  const frames = createCameraShotFrames(
    clip.metadata.shot,
    clip.duration,
    sourceCamera,
    targetNode,
    state,
  );

  frames.forEach((frame) => {
    setTheatreObjectAt({
      theatreSheet,
      position: clip.delay + frame.offset,
      theatreObject: theatreCamera,
      values: {
        position: {
          x: frame.position.x,
          y: frame.position.y,
          z: frame.position.z,
        },
        rotation: {
          x: frame.rotation.x,
          y: frame.rotation.y,
          z: frame.rotation.z,
        },
        camera: {
          fov: frame.fov,
        },
      },
    });
  });

  const lastFrame = frames[frames.length - 1];

  cameraStates.set(cameraName, {
    position: lastFrame.position.clone(),
    fov: lastFrame.fov,
  });
}

export function bakeObjectMotionToTheatre({
  clip,
  theatreSheet,
  findSceneNodeByName,
  theatreBindings,
  objectStates,
}: {
  clip: TimelineAnimation;
  theatreSheet: ISheet;
  findSceneNodeByName: (name?: string) => SceneNode | null;
  theatreBindings: Map<string, TheatreBinding>;
  objectStates: Map<
    string,
    {
      position: THREE.Vector3;
      rotation: THREE.Euler;
      scale: THREE.Vector3;
      color: THREE.Color | null;
      opacity: number;
    }
  >;
}) {
  if (
    clip.kind !== "object-motion" ||
    !clip.metadata?.preset ||
    !clip.metadata.targetLabel
  ) {
    return;
  }

  const node = findSceneNodeByName(clip.metadata.targetLabel);
  const binding = node ? theatreBindings.get(node.id) : null;

  if (!node || !binding) return;

  const material = getFirstStandardMaterial(node.root);

  const state = objectStates.get(node.name) ?? {
    position: node.root.position.clone(),
    rotation: node.root.rotation.clone(),
    scale: node.root.scale.clone(),
    color: material?.color.clone() ?? null,
    opacity: material?.opacity ?? 1,
  };

  const start = clip.delay;
  const end = clip.delay + clip.duration;

  if (clip.metadata.preset === "spin") {
    sequenceTheatrePrimitiveProps(binding.theatreObject, [
      ["rotation", "x"],
      ["rotation", "y"],
      ["rotation", "z"],
    ]);

    setTheatreObjectAt({
      theatreSheet,
      position: start,
      theatreObject: binding.theatreObject,
      values: {
        rotation: {
          x: state.rotation.x,
          y: state.rotation.y,
          z: state.rotation.z,
        },
      },
    });

    state.rotation.y += Math.PI * 2;

    setTheatreObjectAt({
      theatreSheet,
      position: end,
      theatreObject: binding.theatreObject,
      values: {
        rotation: {
          x: state.rotation.x,
          y: state.rotation.y,
          z: state.rotation.z,
        },
      },
    });
  }

  if (clip.metadata.preset === "pulse") {
    sequenceTheatrePrimitiveProps(binding.theatreObject, [
      ["scale", "x"],
      ["scale", "y"],
      ["scale", "z"],
    ]);

    [0, 0.5, 1].forEach((progress) => {
      const multiplier = progress === 0.5 ? 1.45 : 1;

      setTheatreObjectAt({
        theatreSheet,
        position: start + clip.duration * progress,
        theatreObject: binding.theatreObject,
        values: {
          scale: {
            x: state.scale.x * multiplier,
            y: state.scale.y * multiplier,
            z: state.scale.z * multiplier,
          },
        },
      });
    });
  }

  if (clip.metadata.preset === "float") {
    sequenceTheatrePrimitiveProps(binding.theatreObject, [
      ["position", "x"],
      ["position", "y"],
      ["position", "z"],
    ]);

    [0, 0.25, 0.5, 0.75, 1].forEach((progress) => {
      setTheatreObjectAt({
        theatreSheet,
        position: start + clip.duration * progress,
        theatreObject: binding.theatreObject,
        values: {
          position: {
            x: state.position.x,
            y:
              state.position.y +
              Math.sin(progress * Math.PI * 2) * 0.75,
            z: state.position.z,
          },
        },
      });
    });
  }

  if (clip.metadata.preset === "color-shift" && state.color) {
    sequenceTheatrePrimitiveProps(binding.theatreObject, [
      ["material", "color"],
    ]);

    const targetColor = new THREE.Color("#6ee7ff");

    setTheatreObjectAt({
      theatreSheet,
      position: start,
      theatreObject: binding.theatreObject,
      values: {
        material: {
          color: colorToRgba(state.color, state.opacity),
        },
      },
    });

    setTheatreObjectAt({
      theatreSheet,
      position: end,
      theatreObject: binding.theatreObject,
      values: {
        material: {
          color: colorToRgba(targetColor, state.opacity),
        },
      },
    });

    state.color.copy(targetColor);
  }

  objectStates.set(node.name, state);
}
