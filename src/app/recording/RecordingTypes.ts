import * as THREE from "three";
import type { RecordingAspect } from "../studioTypes";

export type RecordingSize = {
  width: number;
  height: number;
};

export type RecordingState = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  stopTimer: number;
  restorePixelRatio: number;
  restoreCamera: THREE.PerspectiveCamera;
  restoreCameraAspect: number;
};

export type RecordingStartOptions = {
  aspect: RecordingAspect;
  seconds: number;
  fps: number;
  camera: THREE.PerspectiveCamera;
  restorePixelRatio: number;
};
