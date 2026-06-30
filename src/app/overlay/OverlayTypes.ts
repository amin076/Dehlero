import type { RecordingAspect, SafeAreaRect } from "./overlayMath";

export interface OverlayState {
  enabled: boolean;
  recording: boolean;
  showSafeArea: boolean;

  aspect: RecordingAspect;

  viewportWidth: number;
  viewportHeight: number;

  safeArea: SafeAreaRect;
}

export interface OverlayController {
  getState(): OverlayState;

  setViewport(width: number, height: number): void;

  setAspect(aspect: RecordingAspect): void;

  setEnabled(enabled: boolean): void;

  setRecording(recording: boolean): void;

  setShowSafeArea(show: boolean): void;

  subscribe(listener: () => void): () => void;
}

export type OverlayListener = () => void;