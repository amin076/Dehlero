import * as THREE from "three";
import { ease } from "./CinematicCurves";
import type { EaseType } from "./ShotTypes";

/**
 * Interpolates between two Vector3 values.
 */
export function lerpVector(
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
): THREE.Vector3 {

  return new THREE.Vector3(

    THREE.MathUtils.lerp(a.x, b.x, t),

    THREE.MathUtils.lerp(a.y, b.y, t),

    THREE.MathUtils.lerp(a.z, b.z, t),

  );

}

/**
 * Interpolates between two Vector3 values using easing.
 */
export function easeVector(
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  curve: EaseType = "smoothstep",
): THREE.Vector3 {

  return lerpVector(a, b, ease(curve, t));

}

/**
 * Interpolates a field-of-view value.
 */
export function interpolateFov(
  start: number,
  end: number,
  t: number,
  curve: EaseType = "smoothstep",
): number {

  return THREE.MathUtils.lerp(

    start,

    end,

    ease(curve, t),

  );

}

/**
 * Smooth camera look-at interpolation.
 */
export function interpolateLookTarget(
  current: THREE.Vector3,
  target: THREE.Vector3,
  t: number,
  curve: EaseType = "smoothstep",
): THREE.Vector3 {

  return easeVector(current, target, t, curve);

}

/**
 * Builds a circular orbit around a target.
 */
export function orbitPosition(

  center: THREE.Vector3,

  radius: number,

  angle: number,

  height = 0,

): THREE.Vector3 {

  return new THREE.Vector3(

    center.x + Math.cos(angle) * radius,

    center.y + height,

    center.z + Math.sin(angle) * radius,

  );

}

/**
 * Returns a fly-by position.
 */
export function flyBy(

  start: THREE.Vector3,

  end: THREE.Vector3,

  t: number,

): THREE.Vector3 {

  return easeVector(

    start,

    end,

    t,

    "smootherstep",

  );

}

/**
 * Camera shake offset.
 */
export function shakeOffset(

  elapsed: number,

  amplitude: number,

  frequency: number,

): THREE.Vector3 {

  const x = Math.sin(elapsed * frequency) * amplitude;

  const y = Math.cos(elapsed * frequency * 1.2) * amplitude * 0.7;

  const z = Math.sin(elapsed * frequency * 0.6) * amplitude * 0.5;

  return new THREE.Vector3(x, y, z);

}

/**
 * Keeps camera behind a moving object.
 */
export function followPosition(

  target: THREE.Vector3,

  direction: THREE.Vector3,

  distance: number,

  height: number,

): THREE.Vector3 {

  return target
    .clone()
    .sub(direction.clone().normalize().multiplyScalar(distance))
    .add(new THREE.Vector3(0, height, 0));

}

/**
 * Creates a cinematic arc.
 */
export function arcPosition(

  start: THREE.Vector3,

  end: THREE.Vector3,

  t: number,

  arcHeight: number,

): THREE.Vector3 {

  const p = easeVector(

    start,

    end,

    t,

    "smootherstep",

  );

  p.y += Math.sin(t * Math.PI) * arcHeight;

  return p;

}

/**
 * Creates a slow floating movement.
 */
export function floatingOffset(

  elapsed: number,

  amount = 0.05,

): THREE.Vector3 {

  return new THREE.Vector3(

    Math.sin(elapsed * 0.6) * amount,

    Math.cos(elapsed * 0.8) * amount,

    Math.sin(elapsed * 0.4) * amount,

  );

}