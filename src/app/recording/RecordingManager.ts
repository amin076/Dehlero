import * as THREE from "three";
import type { RecordingAspect } from "../studioTypes";
import type {
  RecordingSize,
  RecordingStartOptions,
  RecordingState,
  RecordingTimelineOptions,
} from "./RecordingTypes";

export class RecordingManager {
  private recording: RecordingState | null = null;

  private renderer: THREE.WebGLRenderer;
  private resize: () => void;
  private setStatus: (message: string) => void;
  private onBeforeStart?: () => void;
  private onAfterStop?: () => void;

  constructor(
    renderer: THREE.WebGLRenderer,
    resize: () => void,
    setStatus: (message: string) => void,
    onBeforeStart?: () => void,
    onAfterStop?: () => void,
  ) {
    this.renderer = renderer;
    this.resize = resize;
    this.setStatus = setStatus;
    this.onBeforeStart = onBeforeStart;
    this.onAfterStop = onAfterStop;
  }

  isRecording() {
    return this.recording !== null;
  }

  getRecordingSize(aspect: RecordingAspect): RecordingSize {
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

  isSupported() {
    return (
      "captureStream" in this.renderer.domElement &&
      typeof MediaRecorder !== "undefined"
    );
  }

  start(options: RecordingStartOptions) {
    if (this.recording) {
      this.setStatus("Already recording");
      return;
    }

    if (!this.isSupported()) {
      this.setStatus("Recording is not supported in this browser");
      return;
    }

    this.onBeforeStart?.();

    const { aspect, seconds, fps, camera, restorePixelRatio } = options;
    const size = this.getRecordingSize(aspect);
    const restoreCameraAspect = camera.aspect;

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size.width, size.height, false);

    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();

    const canvas = this.renderer.domElement as HTMLCanvasElement & {
      captureStream: (fps?: number) => MediaStream;
    };

    const stream = canvas.captureStream(fps);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = () => {
      this.download(chunks, mimeType, aspect);
      stream.getTracks().forEach((track) => track.stop());
      this.restore();
      this.setStatus("Recording saved");
    };

    this.recording = {
      recorder,
      stream,
      chunks,
      stopTimer: window.setTimeout(() => this.stop(), seconds * 1000),
      restorePixelRatio,
      restoreCamera: camera,
      restoreCameraAspect,
    };

    recorder.start();
    this.setStatus(`Recording ${aspect} ${seconds}s`);
  }

  recordTimeline(options: RecordingTimelineOptions) {
    this.start(options);

    if (!this.isRecording()) return;

    options.onTimelineStart();
  }

  stop() {
    if (!this.recording) {
      this.setStatus("Recorder ready");
      return;
    }

    if (this.recording.recorder.state !== "inactive") {
      this.recording.recorder.stop();
    }
  }

  private restore() {
    if (!this.recording) return;

    window.clearTimeout(this.recording.stopTimer);

    this.renderer.setPixelRatio(this.recording.restorePixelRatio);

    this.recording.restoreCamera.aspect = this.recording.restoreCameraAspect;
    this.recording.restoreCamera.updateProjectionMatrix();

    this.recording = null;

    this.resize();
    this.onAfterStop?.();
  }

  private download(chunks: Blob[], mimeType: string, aspect: RecordingAspect) {
    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `dehlero-${aspect.replace(":", "x")}-${Date.now()}.webm`;
    link.click();

    URL.revokeObjectURL(url);
  }
}
