import * as THREE from "three";

import { ProgramClock } from "./ProgramClock";

export type AstronautMood =
  | "idle"
  | "ready"
  | "kick"
  | "celebrate"
  | "lookAtSaturn";

export class AstronautDirector {
  private readonly astronaut: THREE.Object3D;
  private readonly clock: ProgramClock;

  private baseY = 0;
  private mood: AstronautMood = "idle";
  private lookTarget: THREE.Vector3 | null = null;

  constructor(astronaut: THREE.Object3D, clock: ProgramClock) {
    this.astronaut = astronaut;
    this.clock = clock;
    this.baseY = astronaut.position.y;
  }

  update(delta: number): void {
    const t = this.clock.getElapsed();

    this.applyBreathing(t);
    this.applyMoodMotion(t, delta);
    this.applyLookTarget(delta);
  }

  idle(): this {
    this.mood = "idle";
    this.lookTarget = null;
    return this;
  }

  ready(): this {
    this.mood = "ready";
    return this;
  }

  kick(): this {
    this.mood = "kick";
    return this;
  }

  celebrate(): this {
    this.mood = "celebrate";
    this.lookTarget = null;
    return this;
  }

  lookAt(target: THREE.Object3D | THREE.Vector3): this {
    this.lookTarget =
      target instanceof THREE.Object3D
        ? target.position.clone()
        : target.clone();

    return this;
  }

  lookAtSaturn(saturn: THREE.Object3D): this {
    this.mood = "lookAtSaturn";
    return this.lookAt(saturn);
  }

  pointTo(target: THREE.Object3D | THREE.Vector3): this {
    return this.lookAt(target);
  }

  resetBaseY(): this {
    this.baseY = this.astronaut.position.y;
    return this;
  }

  getObject(): THREE.Object3D {
    return this.astronaut;
  }

  private applyBreathing(t: number): void {
    this.astronaut.position.y =
      this.baseY + Math.sin(t * 1.2) * 0.004;
  }

  private applyMoodMotion(t: number, delta: number): void {
    if (this.mood === "idle") {
      this.astronaut.rotation.z =
        THREE.MathUtils.lerp(
          this.astronaut.rotation.z,
          Math.sin(t * 0.7) * 0.025,
          delta * 3,
        );
    }

    if (this.mood === "ready") {
      this.astronaut.rotation.x =
        THREE.MathUtils.lerp(
          this.astronaut.rotation.x,
          -0.12,
          delta * 4,
        );
      this.astronaut.rotation.z =
        THREE.MathUtils.lerp(
          this.astronaut.rotation.z,
          Math.sin(t * 4) * 0.035,
          delta * 4,
        );
    }

    if (this.mood === "kick") {
      this.astronaut.rotation.x =
        THREE.MathUtils.lerp(
          this.astronaut.rotation.x,
          -0.45 + Math.sin(t * 10) * 0.12,
          delta * 7,
        );
      this.astronaut.rotation.z =
        THREE.MathUtils.lerp(
          this.astronaut.rotation.z,
          0.28,
          delta * 7,
        );
    }

    if (this.mood === "celebrate") {
      this.astronaut.rotation.y += delta * 0.45;
      this.astronaut.position.y =
        this.baseY + Math.abs(Math.sin(t * 3)) * 0.025;
    }

    if (this.mood === "lookAtSaturn") {
      this.astronaut.rotation.z =
        THREE.MathUtils.lerp(
          this.astronaut.rotation.z,
          0.08,
          delta * 2,
        );
    }
  }

  private applyLookTarget(delta: number): void {
    if (!this.lookTarget) return;

    const current = new THREE.Quaternion();
    current.copy(this.astronaut.quaternion);

    const temp = this.astronaut.clone();
    temp.lookAt(this.lookTarget);

    this.astronaut.quaternion.slerp(
      temp.quaternion,
      Math.min(1, delta * 2.5),
    );
  }
}