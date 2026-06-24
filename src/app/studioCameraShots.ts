import * as THREE from "three";
import type { SceneNode } from "../core/scene/SceneNode";
import type { CameraShot } from "./studioTypes";
import {
  easeInOutCubic,
  getObjectCenter,
  getObjectRadius,
} from "./studioMath";

export function getLookAtRotation(
  position: THREE.Vector3,
  target: THREE.Vector3,
  sourceCamera: THREE.PerspectiveCamera,
) {
  const previewCamera = sourceCamera.clone();
  previewCamera.position.copy(position);
  previewCamera.lookAt(target);
  return previewCamera.rotation.clone();
}

export function createCameraShotFrames(
  shot: CameraShot,
  duration: number,
  sourceCamera: THREE.PerspectiveCamera,
  targetNode: SceneNode | null,
  initial: {
    position: THREE.Vector3;
    fov: number;
  },
) {
  const target = targetNode
    ? {
        center: getObjectCenter(targetNode.root),
        radius: getObjectRadius(targetNode.root),
      }
    : {
        center: new THREE.Vector3(0, 0.75, 0),
        radius: 2.5,
      };

  const startOffset = initial.position.clone().sub(target.center);
  const orbitRadius = Math.max(startOffset.length(), target.radius * 3.2);
  const startAngle = Math.atan2(startOffset.z, startOffset.x);
  const direction = startOffset.clone().normalize();

  const closePosition = target.center
    .clone()
    .add(direction.clone().multiplyScalar(target.radius * 1.75));

  closePosition.y = target.center.y + target.radius * 0.72;

  const dollyPosition = target.center
    .clone()
    .add(direction.clone().multiplyScalar(target.radius * 2.25));

  const samples = shot === "orbit" ? [0, 0.25, 0.5, 0.75, 1] : [0, 1];

  return samples.map((progress) => {
    const eased = easeInOutCubic(progress);
    const position = initial.position.clone();
    let fov = initial.fov;

    if (shot === "orbit") {
      const angle = startAngle + Math.PI * 2 * progress;

      position.set(
        target.center.x + Math.cos(angle) * orbitRadius,
        initial.position.y,
        target.center.z + Math.sin(angle) * orbitRadius,
      );
    } else if (shot === "dolly-in") {
      position.lerpVectors(initial.position, dollyPosition, eased);
    } else if (shot === "close-up") {
      position.lerpVectors(initial.position, closePosition, eased);
    } else if (shot === "dolly-zoom") {
      position.lerpVectors(initial.position, closePosition, eased);
      fov = THREE.MathUtils.lerp(
        initial.fov,
        Math.max(initial.fov * 0.42, 12),
        eased,
      );
    }

    return {
      offset: duration * progress,
      position,
      rotation: getLookAtRotation(position, target.center, sourceCamera),
      fov,
    };
  });
}

export function getShotTarget(selected: SceneNode | null) {
  if (selected) {
    return {
      center: getObjectCenter(selected.root),
      radius: getObjectRadius(selected.root),
    };
  }

  return {
    center: new THREE.Vector3(0, 0.75, 0),
    radius: 2.5,
  };
}

export function calculateCameraShotState({
  shot,
  progress,
  center,
  radius,
  startPosition,
  startFov,
  startAngle,
  startHeight,
  orbitRadius,
  closePosition,
  dollyPosition,
}: {
  shot: CameraShot;
  progress: number;
  center: THREE.Vector3;
  radius: number;
  startPosition: THREE.Vector3;
  startFov: number;
  startAngle: number;
  startHeight: number;
  orbitRadius: number;
  closePosition: THREE.Vector3;
  dollyPosition: THREE.Vector3;
}) {
  const eased = easeInOutCubic(progress);
  const nextPosition = new THREE.Vector3();
  let nextFov = startFov;

  if (shot === "static") {
    nextPosition.copy(startPosition);
  } else if (shot === "orbit") {
    const angle = startAngle + Math.PI * 2 * progress;

    nextPosition.set(
      center.x + Math.cos(angle) * orbitRadius,
      startHeight,
      center.z + Math.sin(angle) * orbitRadius,
    );
  }

  if (shot === "dolly-in") {
    nextPosition.copy(startPosition).lerp(dollyPosition, eased);
  }

  if (shot === "close-up") {
    nextPosition.copy(startPosition).lerp(closePosition, eased);
    nextFov = THREE.MathUtils.lerp(startFov, 28, eased);
  }

  if (shot === "dolly-zoom") {
    nextPosition.copy(startPosition).lerp(dollyPosition, eased);
    nextFov = THREE.MathUtils.lerp(startFov, 62, eased);
  }

  return {
    nextPosition,
    nextFov,
    radius,
  };
}

export function createShotRuntimeState({
  shotCamera,
  selectedTarget,
  fallbackTarget,
}: {
  shotCamera: THREE.PerspectiveCamera;
  selectedTarget: SceneNode | null;
  fallbackTarget: {
    center: THREE.Vector3;
    radius: number;
  };
}) {
  const target = selectedTarget
    ? {
        center: getObjectCenter(selectedTarget.root),
        radius: getObjectRadius(selectedTarget.root),
      }
    : fallbackTarget;

  const center = target.center;
  const radius = target.radius;
  const startPosition = shotCamera.position.clone();
  const startFov = shotCamera.fov;
  const startOffset = startPosition.clone().sub(center);
  const orbitRadius = Math.max(startOffset.length(), radius * 3.2);
  const startAngle = Math.atan2(startOffset.z, startOffset.x);
  const startHeight = startPosition.y;
  const direction = startPosition.clone().sub(center).normalize();

  const closePosition = center
    .clone()
    .add(direction.clone().multiplyScalar(radius * 1.75));

  closePosition.y = center.y + radius * 0.72;

  const dollyPosition = center
    .clone()
    .add(direction.clone().multiplyScalar(radius * 2.25));

  return {
    center,
    radius,
    startPosition,
    startFov,
    startAngle,
    startHeight,
    orbitRadius,
    closePosition,
    dollyPosition,
  };
}
