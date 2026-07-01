import * as THREE from "three";

/**
 * All cinematic shot types supported by Dehlero.
 * These are high-level camera intentions rather than
 * low-level position animations.
 */

export type ShotType =
  | "heroReveal"
  | "establishing"
  | "orbit"
  | "follow"
  | "lookAt"
  | "flyBy"
  | "pushIn"
  | "pullOut"
  | "craneUp"
  | "craneDown"
  | "handheld"
  | "dolly"
  | "whipPan"
  | "ballFollow"
  | "kickFollow"
  | "closeUp"
  | "wide"
  | "ending";

/**
 * Easing curves.
 */

export type EaseType =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "smoothstep"
  | "smootherstep";

/**
 * Optional camera shake.
 */

export interface CameraShake {

  enabled: boolean;

  amplitude: number;

  frequency: number;
}

/**
 * Optional depth of field.
 */

export interface DepthOfField {

  enabled: boolean;

  focusDistance: number;

  aperture: number;

  blur: number;
}

/**
 * One camera keyframe.
 */

export interface CameraKeyframe {

  time: number;

  position: THREE.Vector3;

  target: THREE.Vector3;

  fov: number;

  ease: EaseType;
}

/**
 * Text overlay.
 */

export interface ShotOverlay {

  title?: string;

  subtitle?: string;

  opacity?: number;

  fadeIn?: number;

  fadeOut?: number;
}

/**
 * One cinematic shot.
 */

export interface CinematicShot {

  id: string;

  type: ShotType;

  duration: number;

  keyframes: CameraKeyframe[];

  overlay?: ShotOverlay;

  shake?: CameraShake;

  dof?: DepthOfField;

  metadata?: {

    emotion?: string;

    intensity?: number;

    notes?: string;

  };

}

/**
 * Runtime context supplied by the program.
 */

export interface ShotContext {

  camera: THREE.PerspectiveCamera;

  scene: THREE.Scene;

  clock: THREE.Clock;

  delta: number;

}

/**
 * Every shot builder returns one CinematicShot.
 */

export interface ShotBuilder {

  build(): CinematicShot;

}