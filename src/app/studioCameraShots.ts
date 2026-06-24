import * as THREE from "three";
import type { SceneNode } from "../core/scene/SceneNode";
import type { CameraShot, CameraShotRigOptions } from "./studioTypes";
import { easeInOutCubic, getObjectCenter, getObjectRadius } from "./studioMath";

const ORBIT_DISTANCE_MULTIPLIER = 4.8;
const CLOSE_DISTANCE_MULTIPLIER = 3.2;
const DOLLY_IN_DISTANCE_MULTIPLIER = 4.0;
const DOLLY_OUT_DISTANCE_MULTIPLIER = 7.0;
const HERO_DISTANCE_MULTIPLIER = 5.2;

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

function getSafeDirection(position: THREE.Vector3, center: THREE.Vector3) {
  const direction = position.clone().sub(center);

  if (direction.lengthSq() < 0.0001) {
    return new THREE.Vector3(0, 0.25, 1).normalize();
  }

  return direction.normalize();
}

function getCameraPositionFromDirection({
  center,
  direction,
  radius,
  multiplier,
  heightFactor = 0.45,
}: {
  center: THREE.Vector3;
  direction: THREE.Vector3;
  radius: number;
  multiplier: number;
  heightFactor?: number;
}) {
  return center
    .clone()
    .add(direction.clone().multiplyScalar(radius * multiplier))
    .add(new THREE.Vector3(0, radius * heightFactor, 0));
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

  const direction = getSafeDirection(initial.position, target.center);
  const sideDirection = new THREE.Vector3(
    -direction.z,
    0,
    direction.x,
  ).normalize();

  const startOffset = initial.position.clone().sub(target.center);
  const orbitRadius = Math.max(
    startOffset.length(),
    target.radius * ORBIT_DISTANCE_MULTIPLIER,
  );
  const startAngle = Math.atan2(startOffset.z, startOffset.x);

  const closePosition = getCameraPositionFromDirection({
    center: target.center,
    direction,
    radius: target.radius,
    multiplier: CLOSE_DISTANCE_MULTIPLIER,
  });

  const dollyInPosition = getCameraPositionFromDirection({
    center: target.center,
    direction,
    radius: target.radius,
    multiplier: DOLLY_IN_DISTANCE_MULTIPLIER,
  });

  const dollyOutPosition = getCameraPositionFromDirection({
    center: target.center,
    direction,
    radius: target.radius,
    multiplier: DOLLY_OUT_DISTANCE_MULTIPLIER,
  });

  const heroPosition = getCameraPositionFromDirection({
    center: target.center,
    direction,
    radius: target.radius,
    multiplier: HERO_DISTANCE_MULTIPLIER,
    heightFactor: 0.85,
  }).add(sideDirection.clone().multiplyScalar(target.radius * 1.4));

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
    }

    if (shot === "dolly-in") {
      position.lerpVectors(initial.position, dollyInPosition, eased);
    }

    if (shot === "dolly-out") {
      position.lerpVectors(initial.position, dollyOutPosition, eased);
    }

    if (shot === "close-up") {
      position.lerpVectors(initial.position, closePosition, eased);
      fov = THREE.MathUtils.lerp(initial.fov, 34, eased);
    }

    if (shot === "dolly-zoom") {
      position.lerpVectors(initial.position, dollyInPosition, eased);
      fov = THREE.MathUtils.lerp(initial.fov, 58, eased);
    }

    if (shot === "pan-left") {
      position
        .copy(initial.position)
        .add(
          sideDirection.clone().multiplyScalar(-target.radius * 2.2 * eased),
        );
    }

    if (shot === "pan-right") {
      position
        .copy(initial.position)
        .add(sideDirection.clone().multiplyScalar(target.radius * 2.2 * eased));
    }

    if (shot === "crane-up") {
      position.copy(initial.position);
      position.y += target.radius * 2.2 * eased;
    }

    if (shot === "crane-down") {
      position.copy(initial.position);
      position.y -= target.radius * 1.6 * eased;
    }

    if (shot === "hero") {
      position.lerpVectors(initial.position, heroPosition, eased);
      fov = THREE.MathUtils.lerp(initial.fov, 30, eased);
    }

    return {
      offset: duration * progress,
      position,
      rotation: getLookAtRotation(position, target.center, sourceCamera),
      fov,
    };
  });
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
  options = {},
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
  options?: CameraShotRigOptions;
}) {
  const eased = easeInOutCubic(progress);
  const nextPosition = new THREE.Vector3();
  let nextFov = startFov;
  const manualDistance = options.distanceMultiplier;
  const manualHeight = options.heightMultiplier;
  const manualFov = options.fov;
  const manualOrbitDegrees = options.orbitDegrees ?? 360;

  const orbitMultiplier = manualDistance ?? ORBIT_DISTANCE_MULTIPLIER;
  const closeMultiplier = manualDistance ?? CLOSE_DISTANCE_MULTIPLIER;
  const dollyInMultiplier = manualDistance ?? DOLLY_IN_DISTANCE_MULTIPLIER;
  const dollyOutMultiplier = manualDistance ?? DOLLY_OUT_DISTANCE_MULTIPLIER;
  const heroMultiplier = manualDistance ?? HERO_DISTANCE_MULTIPLIER;
  const heightFactor = manualHeight ?? 0.45;
  const direction = getSafeDirection(startPosition, center);
  const sideDirection = new THREE.Vector3(
    -direction.z,
    0,
    direction.x,
  ).normalize();

  const safeClosePosition = getCameraPositionFromDirection({
    center,
    direction,
    radius,
    multiplier: closeMultiplier,
    heightFactor,
  });

  const safeDollyInPosition = getCameraPositionFromDirection({
    center,
    direction,
    radius,
    multiplier: dollyInMultiplier,
    heightFactor,
  });

  const safeDollyOutPosition = getCameraPositionFromDirection({
    center,
    direction,
    radius,
    multiplier: dollyOutMultiplier,
    heightFactor,
  });

  const heroPosition = getCameraPositionFromDirection({
    center,
    direction,
    radius,
    multiplier: heroMultiplier,
    heightFactor: manualHeight ?? 0.85,
  }).add(sideDirection.clone().multiplyScalar(radius * 1.4));

  if (shot === "static") {
    nextPosition.copy(startPosition);
  }

  if (shot === "orbit") {
    const angle =
      startAngle + THREE.MathUtils.degToRad(manualOrbitDegrees) * progress;

    nextPosition.set(
      center.x +
        Math.cos(angle) * Math.max(orbitRadius, radius * orbitMultiplier),
      startHeight,
      center.z +
        Math.sin(angle) *
          Math.max(orbitRadius, radius * ORBIT_DISTANCE_MULTIPLIER),
    );
  }

  if (shot === "dolly-in") {
    nextPosition.copy(startPosition).lerp(safeDollyInPosition, eased);
  }

  if (shot === "dolly-out") {
    nextPosition.copy(startPosition).lerp(safeDollyOutPosition, eased);
  }

  if (shot === "close-up") {
    nextPosition.copy(startPosition).lerp(safeClosePosition, eased);
    nextFov = THREE.MathUtils.lerp(startFov, manualFov ?? 34, eased);
  }

  if (shot === "dolly-zoom") {
    nextPosition.copy(startPosition).lerp(safeDollyInPosition, eased);
    nextFov = THREE.MathUtils.lerp(startFov, manualFov ?? 58, eased);
  }

  if (shot === "pan-left") {
    nextPosition
      .copy(startPosition)
      .add(sideDirection.clone().multiplyScalar(-radius * 2.2 * eased));
  }

  if (shot === "pan-right") {
    nextPosition
      .copy(startPosition)
      .add(sideDirection.clone().multiplyScalar(radius * 2.2 * eased));
  }

  if (shot === "crane-up") {
    nextPosition.copy(startPosition);
    nextPosition.y += radius * 2.2 * eased;
  }

  if (shot === "crane-down") {
    nextPosition.copy(startPosition);
    nextPosition.y -= radius * 1.6 * eased;
  }

  if (shot === "hero") {
    nextPosition.copy(startPosition).lerp(heroPosition, eased);
    nextFov = THREE.MathUtils.lerp(startFov, manualFov ?? 30, eased);
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
  const orbitRadius = Math.max(
    startOffset.length(),
    radius * ORBIT_DISTANCE_MULTIPLIER,
  );
  const startAngle = Math.atan2(startOffset.z, startOffset.x);
  const startHeight = startPosition.y;
  const direction = getSafeDirection(startPosition, center);

  const closePosition = getCameraPositionFromDirection({
    center,
    direction,
    radius,
    multiplier: CLOSE_DISTANCE_MULTIPLIER,
  });

  const dollyPosition = getCameraPositionFromDirection({
    center,
    direction,
    radius,
    multiplier: DOLLY_IN_DISTANCE_MULTIPLIER,
  });

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
