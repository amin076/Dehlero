import {
  getSafeAreaRect,
  type RecordingAspect,
} from "./overlayMath";

import type {
  OverlayController,
  OverlayListener,
  OverlayState,
} from "./OverlayTypes";

export function createOverlayController(
  initialViewportWidth = 1,
  initialViewportHeight = 1,
): OverlayController {
  const listeners = new Set<OverlayListener>();

  const state: OverlayState = {
    enabled: true,
    recording: false,
    showSafeArea: true,

    aspect: "shorts",

    viewportWidth: initialViewportWidth,
    viewportHeight: initialViewportHeight,

    safeArea: getSafeAreaRect(
      initialViewportWidth,
      initialViewportHeight,
      "shorts",
    ),
  };

  function notify() {
    for (const listener of listeners) {
      listener();
    }
  }

  function recalcSafeArea() {
    state.safeArea = getSafeAreaRect(
      state.viewportWidth,
      state.viewportHeight,
      state.aspect,
    );
  }

  return {
    getState() {
      return state;
    },

    setViewport(width: number, height: number) {
      const nextWidth = Math.max(1, width);
      const nextHeight = Math.max(1, height);

      if (
        state.viewportWidth === nextWidth &&
        state.viewportHeight === nextHeight
      ) {
        return;
      }

      state.viewportWidth = nextWidth;
      state.viewportHeight = nextHeight;
      recalcSafeArea();
      notify();
    },

    setAspect(aspect: RecordingAspect) {
      if (state.aspect === aspect) {
        return;
      }

      state.aspect = aspect;
      recalcSafeArea();
      notify();
    },

    setEnabled(enabled: boolean) {
      if (state.enabled === enabled) {
        return;
      }

      state.enabled = enabled;
      notify();
    },

    setRecording(recording: boolean) {
      if (state.recording === recording) {
        return;
      }

      state.recording = recording;
      notify();
    },

    setShowSafeArea(show: boolean) {
      if (state.showSafeArea === show) {
        return;
      }

      state.showSafeArea = show;
      notify();
    },

    subscribe(listener: OverlayListener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}