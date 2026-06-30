import * as THREE from "three";
import type { SceneNode } from "../core/scene/SceneNode";
import type { MotionPreset, TimelineAnimation } from "./studioTypes";
import { easeInOutCubic, getFirstStandardMaterial } from "./studioMath";

function triangleWave(progress: number) {
  return 1 - Math.abs(2 * progress - 1);
}

export const MOTION_PRESET_LABELS: ReadonlyArray<readonly [MotionPreset, string]> = [
  ["spin", "Spin"],
  ["pulse", "Pulse"],
  ["float", "Float"],
  ["color-shift", "Color Shift"],
  ["orbit-circular", "Circular Orbit"],
  ["orbit-elliptical", "Elliptical Orbit"],
  ["linear", "Linear Move"],
  ["accelerate", "Accelerate"],
  ["projectile", "Projectile"],
  ["fall", "Fall Down"],
  ["vibration", "Vibration"],
  ["pendulum", "Pendulum"],
  ["wave", "Wave"],
  ["spring", "Spring"],
  ["figure-eight", "Figure Eight"],
  ["camera-orbit", "Camera Orbit"],
];

export function createObjectMotionAnimation({
  node,
  preset,
  duration,
  delay,
  loop,
}: {
  node: SceneNode;
  preset: MotionPreset;
  duration: number;
  delay: number;
  loop: boolean;
}): Omit<TimelineAnimation, "id" | "elapsed" | "started" | "finished"> {
  const object = node.root;
  const startPosition = object.position.clone();
  const startRotation = object.rotation.clone();
  const startScale = object.scale.clone();
  const material = getFirstStandardMaterial(object);
  const startColor = material?.color.clone();
  const targetColor = new THREE.Color("#6ee7ff");

  const orbitCenter = startPosition.clone();
  const orbitRadius = Math.max(1.25, Math.abs(startPosition.x) + Math.abs(startPosition.z) * 0.25, 2.5);
  const ellipseA = Math.max(2.4, orbitRadius * 1.35);
  const ellipseB = Math.max(1.2, orbitRadius * 0.72);

  return {
    name: `${node.name} ${preset}`,
    kind: "object-motion",
    metadata: {
      preset,
      targetLabel: node.name,
    },
    delay,
    duration,
    loop,
    update(progress, delta) {
      const eased = easeInOutCubic(progress);
      const angle = progress * Math.PI * 2;

      if (preset === "spin") {
        object.rotation.y = startRotation.y + Math.PI * 2 * progress;
        return;
      }

      if (preset === "pulse") {
        const pulse = 1 + Math.sin(progress * Math.PI) * 0.45;

        object.scale.set(
          startScale.x * pulse,
          startScale.y * pulse,
          startScale.z * pulse,
        );

        return;
      }

      if (preset === "float") {
        object.position.y =
          startPosition.y + Math.sin(progress * Math.PI * 2) * 0.75;
        return;
      }

      if (preset === "color-shift" && material && startColor) {
        material.color.copy(startColor).lerp(targetColor, eased);
        material.needsUpdate = true;
        return;
      }

      if (preset === "orbit-circular" || preset === "camera-orbit") {
        object.position.set(
          orbitCenter.x + Math.cos(angle) * orbitRadius,
          startPosition.y,
          orbitCenter.z + Math.sin(angle) * orbitRadius,
        );

        if (preset === "camera-orbit") {
          object.lookAt(orbitCenter);
        }

        return;
      }

      if (preset === "orbit-elliptical") {
        object.position.set(
          orbitCenter.x + Math.cos(angle) * ellipseA,
          startPosition.y,
          orbitCenter.z + Math.sin(angle) * ellipseB,
        );
        return;
      }

      if (preset === "linear") {
        object.position.x = startPosition.x + 5 * eased;
        return;
      }

      if (preset === "accelerate") {
        object.position.x = startPosition.x + 6 * progress * progress;
        return;
      }

      if (preset === "projectile") {
        const horizontalSpeed = 5.5;
        const verticalSpeed = 4.2;
        const gravity = 9.8;
        const t = progress;
        object.position.x = startPosition.x + horizontalSpeed * t;
        object.position.y = startPosition.y + verticalSpeed * t - 0.5 * gravity * t * t;
        return;
      }

      if (preset === "fall") {
        object.position.y = startPosition.y - 5.5 * progress * progress;
        return;
      }

      if (preset === "vibration") {
        object.position.x = startPosition.x + Math.sin(angle * 8) * 0.18;
        object.position.y = startPosition.y + Math.cos(angle * 11) * 0.08;
        return;
      }

      if (preset === "pendulum") {
        object.rotation.z = startRotation.z + Math.sin(angle) * THREE.MathUtils.degToRad(28);
        return;
      }

      if (preset === "wave") {
        object.position.y = startPosition.y + Math.sin(angle * 3) * 0.65;
        object.rotation.z = startRotation.z + Math.sin(angle * 3) * 0.2;
        return;
      }

      if (preset === "spring") {
        const damp = Math.exp(-progress * 2.2);
        object.position.y = startPosition.y + Math.sin(angle * 5) * damp * 1.2;
        return;
      }

      if (preset === "figure-eight") {
        object.position.x = startPosition.x + Math.sin(angle) * 2.2;
        object.position.z = startPosition.z + Math.sin(angle * 2) * 1.1;
        object.position.y = startPosition.y + triangleWave(progress) * 0.35;
        return;
      }

      void delta;
    },
    complete() {
      if (preset === "pulse") {
        object.scale.copy(startScale);
      }
    },
  };
}
