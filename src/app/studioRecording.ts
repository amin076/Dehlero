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
  switch (aspect) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "16:9":
    default:
      return { width: 1920, height: 1080 };
  }
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
