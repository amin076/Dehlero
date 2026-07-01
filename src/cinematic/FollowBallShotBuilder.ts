import * as THREE from "three";

import { ShotBuilder } from "./ShotBuilder";

export interface FollowBallShotOptions {

  id?: string;

  duration?: number;

  ball: THREE.Object3D;

  lookAhead?: THREE.Vector3;

  followDistance?: number;

  height?: number;

  startFov?: number;

  endFov?: number;

}

export function createFollowBallShot({

  id = "followBall",

  duration = 5,

  ball,

  lookAhead = new THREE.Vector3(0, 0.25, 0),

  followDistance = 1.8,

  height = 0.45,

  startFov = 34,

  endFov = 24,

}: FollowBallShotOptions) {

  const shot = ShotBuilder.create(

    id,

    "ballFollow",

    duration,

  );

  const start = ball.position.clone();

  const direction = new THREE.Vector3(0, 0, 1);

  const KEYFRAMES = 12;

  for (let i = 0; i <= KEYFRAMES; i++) {

    const t = i / KEYFRAMES;

    const simulatedBall = start.clone().add(

      direction.clone().multiplyScalar(

        t * 6,

      ),

    );

    simulatedBall.y +=

      Math.sin(t * Math.PI) * 1.6;

    const camera = simulatedBall.clone()

      .add(

        new THREE.Vector3(

          -followDistance,

          height,

          followDistance,

        ),

      );

    const target = simulatedBall

      .clone()

      .add(lookAhead);

    shot.keyframe(

      duration * t,

      camera,

      target,

      THREE.MathUtils.lerp(

        startFov,

        endFov,

        t,

      ),

      "smootherstep",

    );

  }

  return shot

    .shake(

      0.015,

      18,

    )

    .dof(

      followDistance,

      0.018,

      0.45,

    )

    .emotion(

      "tension",

      9,

    )

    .note(

      "Cinematic follow-ball shot",

    )

    .build();

}