import type {
  CameraOption,
  CameraShot,
  CameraShotRigOptions,
  MotionPreset,
  RecordingAspect,
  ShotListItem,
} from "../studioTypes";

export function createProductionPanel({
  root,
  addShot,
  applyObjectMotion,
  applyCameraShot,
  playTimeline,
  pauseTimeline,
  stopTimeline,
  playTheatreSequence,
  restoreTheatreStudio,
  restoreTheatreStudioWithShots,
  bakeShotsToTheatre,
  startRecording,
  stopRecording,
  viewSelectedCamera,
  viewMainCamera,
  removeCameraShot,
  moveCameraShot,
  selectCameraShot,
  updateCameraShotDuration,
}: {
  root: HTMLElement;
  addShot: (duration: number) => void;
  applyObjectMotion: (preset: MotionPreset, duration: number) => void;
  applyCameraShot: (
    shot: CameraShot,
    duration: number,
    options?: CameraShotRigOptions,
  ) => void;
  playTimeline: () => void;
  pauseTimeline: () => void;
  stopTimeline: () => void;
  playTheatreSequence: () => void;
  restoreTheatreStudio: () => void;
  restoreTheatreStudioWithShots: () => void;
  bakeShotsToTheatre: () => void;
  startRecording: (
    aspect: RecordingAspect,
    seconds: number,
    fps: number,
  ) => void;
  stopRecording: () => void;
  viewSelectedCamera: (cameraId: string) => void;
  viewMainCamera: () => void;
  removeCameraShot: (shotId: string) => void;
  moveCameraShot: (shotId: string, direction: -1 | 1) => void;
  selectCameraShot: (shotId: string) => void;
  updateCameraShotDuration: (shotId: string, duration: number) => void;
}) {
  const panel = document.createElement("aside");
  panel.className = "production-panel";

  panel.innerHTML = `
    <div class="panel-title">Motion & Recording</div>

    <div class="production-section production-section-primary" data-tool-section="playback">
      <div class="production-section-title">Playback</div>

      <div class="shot-rig-options">
        <label>
          Orbit Angle
          <input id="shot-orbit-degrees" type="number" min="15" max="720" step="15" value="360" />
        </label>

        <label>
          Distance
          <input id="shot-distance" type="number" min="1" max="12" step="0.25" value="3.2" />
        </label>
      </div>

      <div class="production-grid three">
        <button id="timeline-play" type="button">Play</button>
        <button id="timeline-pause" type="button">Pause</button>
        <button id="timeline-stop" type="button">Stop</button>
      </div>

      <div class="production-grid three">
        <button id="theatre-play" type="button">Theatre</button>
        <button id="theatre-open" type="button">Blank Theatre</button>
        <button id="theatre-shots" type="button">Theatre + Shots</button>
      </div>

      <button id="theatre-bake" type="button">
        Bake Shots to Theatre Keyframes
      </button>
    </div>

    <label data-tool-section="shots">
      Duration
      <input id="motion-duration" type="number" min="0.5" step="0.5" value="4" />
    </label>

    <div class="production-section" data-tool-section="shots">
      <div class="production-section-title">Object Motion</div>

      <div class="production-grid">
        <button type="button" data-motion="spin">Spin</button>
        <button type="button" data-motion="pulse">Pulse</button>
        <button type="button" data-motion="float">Float</button>
        <button type="button" data-motion="color-shift">Color</button>
      </div>
    </div>

    <div class="production-section" data-tool-section="shots">
      <div class="production-section-heading">
        <div class="production-section-title">Shot Director</div>
        <button id="add-shot" class="compact-button" type="button">Add Shot</button>
      </div>

      <div class="production-grid">
        <button type="button" data-shot="orbit">Orbit</button>
        <button type="button" data-shot="dolly-in">Dolly</button>
        <button type="button" data-shot="close-up">Close Up</button>
        <button type="button" data-shot="dolly-zoom">Dolly Zoom</button>
      </div>

      <div id="shot-list" class="shot-list"></div>
    </div>

    <div class="production-section" data-tool-section="camera">
      <div class="production-section-title">Render Camera</div>

      <label>
        Camera
        <select id="render-camera"></select>
      </label>

      <div class="production-grid two">
        <button id="view-camera" type="button">View Camera</button>
        <button id="view-main-camera" type="button">Main View</button>
      </div>
    </div>

    <div class="production-section" data-tool-section="record">
      <div class="production-section-title">Record Video</div>

      <div class="recording-options">
        <label>
          Aspect
          <select id="record-aspect">
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>
        </label>

        <label>
          Seconds
          <input id="record-seconds" type="number" min="1" step="1" value="8" />
        </label>

        <label>
          FPS
          <input id="record-fps" type="number" min="12" max="60" step="1" value="30" />
        </label>
      </div>

      <div class="production-grid two">
        <button id="record-start" type="button">Start</button>
        <button id="record-stop" type="button">Stop</button>
      </div>

      <div id="record-status" class="asset-status">Recorder ready</div>
    </div>
  `;

  const durationInput =
    panel.querySelector<HTMLInputElement>("#motion-duration")!;
  const aspectInput = panel.querySelector<HTMLSelectElement>("#record-aspect")!;
  const secondsInput =
    panel.querySelector<HTMLInputElement>("#record-seconds")!;
  const fpsInput = panel.querySelector<HTMLInputElement>("#record-fps")!;
  const renderCameraInput =
    panel.querySelector<HTMLSelectElement>("#render-camera")!;
  const shotList = panel.querySelector<HTMLDivElement>("#shot-list")!;
  const status = panel.querySelector<HTMLDivElement>("#record-status")!;
  const orbitDegreesInput =
    panel.querySelector<HTMLInputElement>("#shot-orbit-degrees")!;
  const distanceInput =
    panel.querySelector<HTMLInputElement>("#shot-distance")!;

  const getDuration = () => Math.max(Number(durationInput.value) || 4, 0.5);

  const getShotRigOptions = (): CameraShotRigOptions => ({
    orbitDegrees: Math.max(Number(orbitDegreesInput.value) || 360, 15),
    distanceMultiplier: Math.max(Number(distanceInput.value) || 3.2, 1),
  });

  panel.querySelectorAll<HTMLButtonElement>("[data-motion]").forEach((button) => {
    button.onclick = () => {
      applyObjectMotion(button.dataset.motion as MotionPreset, getDuration());
    };
  });

  panel.querySelectorAll<HTMLButtonElement>("[data-shot]").forEach((button) => {
    button.onclick = () => {
      viewSelectedCamera(renderCameraInput.value);
      applyCameraShot(
        button.dataset.shot as CameraShot,
        getDuration(),
        getShotRigOptions(),
      );
    };
  });

  panel.querySelector<HTMLButtonElement>("#timeline-play")!.onclick =
    playTimeline;
  panel.querySelector<HTMLButtonElement>("#timeline-pause")!.onclick =
    pauseTimeline;
  panel.querySelector<HTMLButtonElement>("#timeline-stop")!.onclick =
    stopTimeline;
  panel.querySelector<HTMLButtonElement>("#theatre-play")!.onclick =
    playTheatreSequence;
  panel.querySelector<HTMLButtonElement>("#theatre-open")!.onclick =
    restoreTheatreStudio;
  panel.querySelector<HTMLButtonElement>("#theatre-shots")!.onclick =
    restoreTheatreStudioWithShots;
  panel.querySelector<HTMLButtonElement>("#theatre-bake")!.onclick =
    bakeShotsToTheatre;

  panel.querySelector<HTMLButtonElement>("#add-shot")!.onclick = () => {
    addShot(getDuration());
  };

  panel.querySelector<HTMLButtonElement>("#view-camera")!.onclick = () => {
    viewSelectedCamera(renderCameraInput.value);
  };

  panel.querySelector<HTMLButtonElement>("#view-main-camera")!.onclick = () => {
    renderCameraInput.value = "main";
    viewMainCamera();
  };

  panel.querySelector<HTMLButtonElement>("#record-stop")!.onclick =
    stopRecording;

  panel.querySelector<HTMLButtonElement>("#record-start")!.onclick = () => {
    viewSelectedCamera(renderCameraInput.value);

    startRecording(
      aspectInput.value as RecordingAspect,
      Math.max(Number(secondsInput.value) || 8, 1),
      Math.max(Number(fpsInput.value) || 30, 12),
    );
  };

  shotList.onclick = (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-shot-row]",
    );

    if (
      row?.dataset.shotRow &&
      !(event.target as HTMLElement).closest("button")
    ) {
      selectCameraShot(row.dataset.shotRow);
      return;
    }

    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button",
    );

    if (!button?.dataset.shotId) return;

    if (button.dataset.shotAction === "up") {
      moveCameraShot(button.dataset.shotId, -1);
      return;
    }

    if (button.dataset.shotAction === "down") {
      moveCameraShot(button.dataset.shotId, 1);
      return;
    }

    if (button.dataset.shotAction === "delete") {
      removeCameraShot(button.dataset.shotId);
    }
  };

  shotList.onchange = (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>(
      "input[data-shot-duration]",
    );

    if (!input?.dataset.shotDuration) return;

    updateCameraShotDuration(
      input.dataset.shotDuration,
      Math.max(Number(input.value) || 0.5, 0.5),
    );
  };

  root.appendChild(panel);

  return {
    getSelectedCameraId() {
      return renderCameraInput.value || "main";
    },

    refreshCameras(options: CameraOption[], selectedId: string) {
      renderCameraInput.innerHTML = "";

      options.forEach((option) => {
        const element = document.createElement("option");
        element.value = option.id;
        element.textContent = option.label;
        renderCameraInput.appendChild(element);
      });

      renderCameraInput.value = options.some(
        (option) => option.id === selectedId,
      )
        ? selectedId
        : "main";
    },

    refreshShots(shots: ShotListItem[]) {
      shotList.innerHTML = "";

      if (shots.length === 0) {
        const empty = document.createElement("div");
        empty.className = "shot-empty";
        empty.textContent = "No camera shots";
        shotList.appendChild(empty);
        return;
      }

      shots.forEach((shot, index) => {
        const row = document.createElement("div");
        row.className = `shot-row${shot.active ? " is-active" : ""}`;
        row.dataset.shotRow = shot.id;

        const details = document.createElement("div");
        details.className = "shot-details";

        const title = document.createElement("strong");
        title.textContent = `${index + 1}. ${shot.label}`;

        const meta = document.createElement("span");
        meta.textContent = `${shot.cameraLabel} -> ${shot.targetLabel} | ${shot.duration}s`;

        const duration = document.createElement("input");
        duration.type = "number";
        duration.min = "0.5";
        duration.step = "0.5";
        duration.value = String(shot.duration);
        duration.title = "Shot duration";
        duration.dataset.shotDuration = shot.id;
        duration.className = "shot-duration";

        const actions = document.createElement("div");
        actions.className = "shot-actions";

        [
          ["up", "Up"],
          ["down", "Down"],
          ["delete", "Del"],
        ].forEach(([action, label]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.shotAction = action;
          button.dataset.shotId = shot.id;
          button.textContent = label;
          actions.appendChild(button);
        });

        details.append(title, meta, duration);
        row.append(details, actions);
        shotList.appendChild(row);
      });
    },

    setStatus(message: string) {
      status.textContent = message;
    },
  };
}
