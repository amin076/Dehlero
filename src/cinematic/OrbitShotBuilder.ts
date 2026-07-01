import * as THREE from "three";

import { ShotBuilder } from "./ShotBuilder";

export interface OrbitShotOptions {

  id?: string;

  duration?: number;

  target: THREE.Object3D;

  radius?: number;

  height?: number;

  startAngle?: number;

  endAngle?: number;

  fov?: number;

  title?: string;

  subtitle?: string;

}

export function createOrbitShot({

  id = "orbit",

  duration = 5,

  target,

  radius = 4,

  height = 1.5,

  startAngle = -Math.PI * 0.35,

  endAngle = Math.PI * 0.55,

  fov = 34,

  title,

  subtitle,

}: OrbitShotOptions) {

  const center = target.position.clone();

  const shot = ShotBuilder.create(
    id,
    "orbit",
    duration,
  );

  if (title) {

    shot.title(

      title,

      subtitle ?? "",

    );

  }

  const KEYFRAMES = 8;

  for (let i = 0; i <= KEYFRAMES; i++) {

    const t = i / KEYFRAMES;

    const angle = THREE.MathUtils.lerp(

      startAngle,

      endAngle,

      t,

    );

    const position = new THREE.Vector3(

      center.x + Math.cos(angle) * radius,

      center.y + height,

      center.z + Math.sin(angle) * radius,

    );

    shot.keyframe(

      duration * t,

      position,

      center,

      fov,

      "smootherstep",

    );

  }

  return shot

    .dof(

      radius,

      0.02,

      0.35,

    )

    .emotion(

      "cinematic",

      8,

    )

    .note(

      "Automatic orbit shot",

    )

    .build();

}