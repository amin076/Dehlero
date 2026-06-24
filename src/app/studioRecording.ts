import * as THREE from "three";
import type { RecordingAspect } from "./studioTypes";

export type RecordingState = {
  recorder: MediaRecorder;
  chunks: Blob[];
  stopTimer: number;
  restorePixelRatio: number;
  restoreCamera: THREE.PerspectiveCamera;
  restoreCameraAspect: number;
};

export function getRecordingSize(aspect: RecordingAspect) {
  return aspect === "9:16"
    ? { width: 720, height: 1280 }
    : { width: 1280, height: 720 };
}

export function createRecordingDownload({
  chunks,
  mimeType,
  aspect,
}: {
  chunks: Blob[];
  mimeType: string;
  aspect: RecordingAspect;
}) {
  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `dehlero-${aspect.replace(":", "x")}-${Date.now()}.webm`;
  link.click();

  URL.revokeObjectURL(url);
}

export function isRecordingSupported(canvas: HTMLCanvasElement) {
  return "captureStream" in canvas && typeof MediaRecorder !== "undefined";
}
