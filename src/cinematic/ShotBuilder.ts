import * as THREE from "three";

import type {
  CinematicShot,
  CameraKeyframe,
  EaseType,
  ShotType,
} from "./ShotTypes";

export class ShotBuilder {

  private readonly shot: CinematicShot;

  constructor(
    id: string,
    type: ShotType,
    duration: number,
  ) {

    this.shot = {

      id,

      type,

      duration,

      keyframes: [],

    };

  }

  static create(

    id: string,

    type: ShotType,

    duration: number,

  ) {

    return new ShotBuilder(

      id,

      type,

      duration,

    );

  }

  keyframe(

    time: number,

    position: THREE.Vector3,

    target: THREE.Vector3,

    fov = 40,

    ease: EaseType = "smoothstep",

  ) {

    const frame: CameraKeyframe = {

      time,

      position: position.clone(),

      target: target.clone(),

      fov,

      ease,

    };

    this.shot.keyframes.push(frame);

    return this;

  }

  title(

    title: string,

    subtitle = "",

  ) {

    this.shot.overlay = {

      title,

      subtitle,

      fadeIn: 0.4,

      fadeOut: 0.5,

      opacity: 1,

    };

    return this;

  }

  shake(

    amplitude = 0.02,

    frequency = 20,

  ) {

    this.shot.shake = {

      enabled: true,

      amplitude,

      frequency,

    };

    return this;

  }

  dof(

    focusDistance = 5,

    aperture = 0.03,

    blur = 0.25,

  ) {

    this.shot.dof = {

      enabled: true,

      focusDistance,

      aperture,

      blur,

    };

    return this;

  }

  emotion(

    emotion: string,

    intensity = 1,

  ) {

    if (!this.shot.metadata) {

      this.shot.metadata = {};

    }

    this.shot.metadata.emotion = emotion;

    this.shot.metadata.intensity = intensity;

    return this;

  }

  note(text: string) {

    if (!this.shot.metadata) {

      this.shot.metadata = {};

    }

    this.shot.metadata.notes = text;

    return this;

  }

  build(): CinematicShot {

    this.shot.keyframes.sort(

      (a, b) => a.time - b.time,

    );

    return this.shot;

  }

}