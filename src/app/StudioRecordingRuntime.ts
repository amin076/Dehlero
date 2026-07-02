import type * as THREE from "three";
import { RecordingManager } from "./recording";
import { startStudioAgentRuntime } from "./studioAgentRuntime";
import type { RecordingAspect } from "./studioTypes";
import type { TimelineController } from "./studioTimelineController";
import type { createOverlayManager } from "./overlay/OverlayManager";

type CameraControlsLike = {
  enabled: boolean;
  setLookAt: (
    positionX: number,
    positionY: number,
    positionZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    enableTransition?: boolean,
  ) => Promise<void> | void;
};

type StudioRecordingRuntimeOptions = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: CameraControlsLike;
  renderer: THREE.WebGLRenderer;
  overlayManager: ReturnType<typeof createOverlayManager>;
  timelineController: TimelineController;
  resize: () => void;
  getActiveRenderCamera: () => THREE.PerspectiveCamera;
  getRendererPixelRatio: () => number;
  setStatus: (message: string) => void;
  toOverlayAspect: (aspect: RecordingAspect) => "landscape" | "shorts";
  enterRecordViewportMode: () => void;
  exitRecordViewportMode: () => void;
  hasTheatreAnimation: () => Promise<boolean> | boolean;
  playDirectorTimeline: () => void;
  stopDirectorTimeline: () => void;
};

export function createStudioRecordingRuntime(
  options: StudioRecordingRuntimeOptions,
) {
  const recordingManager = new RecordingManager(
    options.renderer,
    options.resize,
    options.setStatus,
    () => {
      options.enterRecordViewportMode();
      options.overlayManager.setRecording(true);
      options.timelineController.rewindTimeline();
      void options.hasTheatreAnimation();
    },
    () => {
      options.overlayManager.setRecording(false);
      options.exitRecordViewportMode();
    },
  );

  function startRecording(
    aspect: RecordingAspect,
    seconds: number,
    fps: number,
  ) {
    options.overlayManager.setAspect(options.toOverlayAspect(aspect));
    options.overlayManager.showSafeArea(true);
    recordingManager.start({
      aspect,
      seconds,
      fps,
      camera: options.getActiveRenderCamera(),
      restorePixelRatio: options.getRendererPixelRatio(),
    });
  }

  function stopRecording() {
    recordingManager.stop();
  }

  function recordTimeline(
    aspect: RecordingAspect,
    seconds: number,
    fps: number,
  ) {
    options.overlayManager.setAspect(options.toOverlayAspect(aspect));
    options.overlayManager.showSafeArea(true);

    const timelineDuration = options.timelineController.getTimelineDuration();
    const safeDuration = Math.max(timelineDuration + 2, seconds, 1);

    options.timelineController.setStopRecordingWhenTimelineEnds(true);

    recordingManager.recordTimeline({
      aspect,
      seconds: safeDuration,
      fps,
      camera: options.getActiveRenderCamera(),
      restorePixelRatio: options.getRendererPixelRatio(),
      onTimelineStart: () => {
        options.playDirectorTimeline();
      },
    });
  }

  startStudioAgentRuntime({
    scene: options.scene,
    camera: options.camera,
    controls: options.controls,
    startRecording,
    stopRecording,
    recordTimeline,
    playTimeline: options.playDirectorTimeline,
    stopTimeline: options.stopDirectorTimeline,
  });

  return {
    recordingManager,
    isRecording: () => recordingManager.isRecording(),
    startRecording,
    stopRecording,
    recordTimeline,
  };
}
