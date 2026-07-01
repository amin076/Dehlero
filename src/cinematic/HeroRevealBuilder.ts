import * as THREE from "three";

import { ShotBuilder } from "./ShotBuilder";

export interface HeroRevealOptions {

  id?: string;

  duration?: number;

  target: THREE.Object3D;

  startDistance?: number;

  endDistance?: number;

  startHeight?: number;

  endHeight?: number;

  startFov?: number;

  endFov?: number;

  title?: string;

  subtitle?: string;

}

export function createHeroReveal({

  id = "heroReveal",

  duration = 4,

  target,

  startDistance = 16,

  endDistance = 7,

  startHeight = 6,

  endHeight = 2,

  startFov = 24,

  endFov = 42,

  title,

  subtitle,

}: HeroRevealOptions) {

  const targetPos = target.position.clone();

  const start = targetPos.clone().add(
    new THREE.Vector3(
      -startDistance,
      startHeight,
      startDistance,
    ),
  );

  const end = targetPos.clone().add(
    new THREE.Vector3(
      -endDistance,
      endHeight,
      endDistance * 0.6,
    ),
  );

  const shot = ShotBuilder
    .create(
      id,
      "heroReveal",
      duration,
    );

  if (title) {

    shot.title(

      title,

      subtitle ?? "",

    );

  }

  return shot

    .keyframe(

      0,

      start,

      targetPos,

      startFov,

      "easeOut",

    )

    .keyframe(

      duration,

      end,

      targetPos,

      endFov,

      "smootherstep",

    )

    .shake(
      0.01,
      12,
    )

    .dof(
      endDistance,
      0.025,
      0.35,
    )

    .emotion(
      "epic",
      10,
    )

    .note(
      "Automatic hero reveal",
    )

    .build();

}