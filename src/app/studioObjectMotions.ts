import * as THREE from "three";
import type { SceneNode } from "../core/scene/SceneNode";
import type { MotionPreset, TimelineAnimation } from "./studioTypes";
import { easeInOutCubic, getFirstStandardMaterial } from "./studioMath";

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
    update(progress) {
      const eased = easeInOutCubic(progress);

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
      }
    },
    complete() {
      if (preset === "pulse") {
        object.scale.copy(startScale);
      }
    },
  };
}
