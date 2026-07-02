import * as THREE from "three";
import {
  applyAiCommandEnvelope,
  updateAiAnimations,
} from "../ai/applyAiCommand";
import type { DehleroCommandEnvelope } from "../ai/commandTypes";
import type { RecordingAspect } from "./studioTypes";

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

type AgentRuntimeOptions = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  controls?: CameraControlsLike;

  startRecording: (
    aspect: RecordingAspect,
    seconds: number,
    fps: number,
  ) => void;

  stopRecording: () => void;

  recordTimeline: (
    aspect: RecordingAspect,
    seconds: number,
    fps: number,
  ) => void;

  playTimeline: () => void;

  stopTimeline: () => void;
};

type RuntimeCommand =
  | { type: "startRecording"; aspect?: RecordingAspect; seconds?: number; fps?: number }
  | { type: "stopRecording" }
  | { type: "recordTimeline"; aspect?: RecordingAspect; seconds?: number; fps?: number }
  | { type: "playTimeline" }
  | { type: "stopTimeline" }
  | { type: "wait"; seconds?: number };

type StudioAgentRuntime = {
  update: () => void;
};

function sleep(seconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, seconds * 1000));
}

function isRuntimeCommand(command: { type: string }): command is RuntimeCommand {
  return [
    "startRecording",
    "stopRecording",
    "recordTimeline",
    "playTimeline",
    "stopTimeline",
    "wait",
  ].includes(command.type);
}

export function startStudioAgentRuntime(
  options: AgentRuntimeOptions,
): StudioAgentRuntime {
  let lastText = "";
  let running = false;

  const aiContext = {
    scene: options.scene,
    camera: options.camera,
    controls: options.controls,
  };

  async function runEnvelope(envelope: DehleroCommandEnvelope) {
    if (running) return;
    running = true;

    try {
      for (const command of envelope.commands as Array<{ type: string }>) {
        if (isRuntimeCommand(command)) {
          if (command.type === "startRecording") {
            options.startRecording(
              command.aspect ?? "9:16",
              command.seconds ?? 10,
              command.fps ?? 60,
            );
          }

          if (command.type === "stopRecording") {
            options.stopRecording();
          }

          if (command.type === "recordTimeline") {
            options.recordTimeline(
              command.aspect ?? "9:16",
              command.seconds ?? 10,
              command.fps ?? 60,
            );
          }

          if (command.type === "playTimeline") {
            options.playTimeline();
          }

          if (command.type === "stopTimeline") {
            options.stopTimeline();
          }

          if (command.type === "wait") {
            await sleep(command.seconds ?? 1);
          }
        } else {
          applyAiCommandEnvelope(aiContext, {
            dehleroCommand: true,
            version: "0.1",
            commands: [command as never],
          });
        }
      }
    } finally {
      running = false;
    }
  }

  async function poll() {
    try {
      const res = await fetch(`/ai/latest-command.json?t=${Date.now()}`);
      if (!res.ok) return;

      const text = await res.text();
      if (!text.trim() || text === lastText) return;

      lastText = text;

      const envelope = JSON.parse(text) as DehleroCommandEnvelope;

      if (envelope.dehleroCommand === true) {
        await runEnvelope(envelope);
      }
    } catch (error) {
      console.warn("Studio Agent Runtime failed:", error);
    }
  }

  window.setInterval(() => {
    void poll();
  }, 1000);

  void poll();

  return {
    update() {
      updateAiAnimations(aiContext);
    },
  };
}
