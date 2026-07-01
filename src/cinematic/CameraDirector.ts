import * as THREE from "three";

import type {
  CinematicShot,
  CameraKeyframe,
} from "./ShotTypes";

import {
  easeVector,
  interpolateFov,
} from "./CinematicMath";

export class CameraDirector {

  private readonly camera: THREE.PerspectiveCamera;

  private shot: CinematicShot | null = null;

  private elapsed = 0;

  private finished = true;

  constructor(camera: THREE.PerspectiveCamera) {

    this.camera = camera;

  }

  play(shot: CinematicShot) {

    this.shot = shot;

    this.elapsed = 0;

    this.finished = false;

    if (shot.keyframes.length > 0) {

      const first = shot.keyframes[0];

      this.camera.position.copy(first.position);

      this.camera.lookAt(first.target);

      this.camera.fov = first.fov;

      this.camera.updateProjectionMatrix();

    }

  }

  stop() {

    this.finished = true;

    this.shot = null;

  }

  isFinished() {

    return this.finished;

  }

  getCurrentShot() {

    return this.shot;

  }

  update(delta: number) {

    if (!this.shot) return;

    if (this.finished) return;

    this.elapsed += delta;

    const duration = this.shot.duration;

    if (this.elapsed >= duration) {

      this.applyLastFrame();

      this.finished = true;

      return;

    }

    this.evaluate();

  }

  private evaluate() {

    if (!this.shot) return;

    const frames = this.shot.keyframes;

    if (frames.length < 2) return;

    let previous = frames[0];
    let next = frames[1];

    for (let i = 0; i < frames.length - 1; i++) {

      if (
        this.elapsed >= frames[i].time &&
        this.elapsed <= frames[i + 1].time
      ) {

        previous = frames[i];

        next = frames[i + 1];

        break;

      }

    }

    const localDuration =
      next.time - previous.time;

    const localTime =
      this.elapsed - previous.time;

    const t =
      localDuration <= 0
        ? 1
        : localTime / localDuration;

    this.interpolate(previous, next, t);

  }

  private interpolate(
    a: CameraKeyframe,
    b: CameraKeyframe,
    t: number,
  ) {

    const position = easeVector(
      a.position,
      b.position,
      t,
      b.ease,
    );

    const target = easeVector(
      a.target,
      b.target,
      t,
      b.ease,
    );

    this.camera.position.copy(position);

    this.camera.lookAt(target);

    this.camera.fov = interpolateFov(
      a.fov,
      b.fov,
      t,
      b.ease,
    );

    this.camera.updateProjectionMatrix();

    if (this.shot?.shake?.enabled) {

      const shake = this.shot.shake;

      this.camera.position.x +=
        Math.sin(this.elapsed * shake.frequency) *
        shake.amplitude;

      this.camera.position.y +=
        Math.cos(this.elapsed * shake.frequency * 1.4) *
        shake.amplitude * 0.7;

      this.camera.position.z +=
        Math.sin(this.elapsed * shake.frequency * 0.7) *
        shake.amplitude * 0.5;

    }

  }

  private applyLastFrame() {

    if (!this.shot) return;

    const last =
      this.shot.keyframes[
        this.shot.keyframes.length - 1
      ];

    this.camera.position.copy(last.position);

    this.camera.lookAt(last.target);

    this.camera.fov = last.fov;

    this.camera.updateProjectionMatrix();

  }

}