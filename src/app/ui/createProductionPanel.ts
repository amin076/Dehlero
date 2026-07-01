/**
 * Production Panel replacement for Dehlero.
 *
 * Usage:
 * 1) Replace src/app/ui/createProductionPanel.ts with this file.
 * 2) If desired, pass shotRepository and shotOverlayScheduler from createStudioApp
 *    to unlock repository persistence and live overlay preview/playback.
 * 3) Run: npm run build
 *
 * Notes:
 * - This module keeps the existing callback-driven integration used by createStudioApp.
 * - The Overlay tab edits a title draft and maps it to the canonical ShotTitleCue model.
 * - Pause/Stop wrappers stop the ShotOverlayScheduler so title overlays do not linger.
 */

import type {
  CameraOption,
  CameraShot,
  CameraShotRigOptions,
  MotionPreset,
  ObjectMotionMode,
  RecordingAspect,
} from "../studioTypes";
import type { ShotDefinition, ShotType } from "../shots/ShotTypes";
import { createShotDefinition } from "../shots/createShotDefinition";
import type { ShotRepository } from "../shots/ShotRepository";
import type { ShotOverlayScheduler } from "../shots/ShotOverlayScheduler";
import type {
  ShotOverlayPlacement,
  ShotOverlayVariant,
  ShotTitleCue,
} from "../shots/ShotOverlayTypes";

type ProductionShotItem = {
  id: string;
  label: string;
  duration: number;
  cameraLabel?: string;
  targetLabel?: string;
  start?: number;
  active?: boolean;
  /**
   * Optional: if createStudioApp later surfaces the original CameraShot value,
   * the panel will preserve a more accurate ShotType mapping.
   */
  shot?: CameraShot;
  orbitDegrees?: number;
  distanceMultiplier?: number;
  heightMultiplier?: number;
  fov?: number;
};

type OverlayStylePreset = "Documentary" | "Minimal" | "Broadcast" | "Trailer";

type OverlayPlacement =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type InspectorTab = "camera" | "overlay" | "animation" | "audio";

export type TitleOverlayDraft = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  delay: number;
  duration: number;
  stylePreset: OverlayStylePreset;
  placement: OverlayPlacement;
  titleSize: number;
  subtitleSize: number;
  eyebrowSize: number;
  maxWidth: number;
  textColor: string;
  accentColor: string;
  shadowStrength: number;
};

export type ShotDraft = {
  shotType: ShotType;
  duration: number;
  rig: CameraShotRigOptions;
  overlay: TitleOverlayDraft;
};

export type CreateProductionPanelOptions = {
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
  recordTimeline: (
    aspect: RecordingAspect,
    seconds: number,
    fps: number,
  ) => void;
  viewSelectedCamera: (cameraId: string) => void;
  viewMainCamera: () => void;
  removeCameraShot: (shotId: string) => void;
  moveCameraShot: (shotId: string, direction: -1 | 1) => void;
  selectCameraShot: (shotId: string) => void;
  duplicateCameraShot: (shotId: string) => void;
  previewCameraShot: (shotId: string) => void;
  updateCameraShotDuration: (shotId: string, duration: number) => void;
  updateCameraShotRigOptions: (
    shotId: string,
    options: CameraShotRigOptions,
  ) => void;
  /**
   * Optional repository integration. When supplied, "Save to Shot" and
   * "Add Title Cue to Shot" persist into the canonical ShotDefinition store.
   */
  shotRepository?: ShotRepository;
  /**
   * Optional live overlay integration. When supplied, overlay previews and
   * pause/stop cleanup use the project's ShotOverlayScheduler.
   */
  shotOverlayScheduler?: ShotOverlayScheduler;
  /**
   * Optional scene integration. If createStudioApp exposes richer selection
   * metadata later, the inspector meta block will show it automatically.
   */
  getSelectedTargetName?: () => string | null;
  captureObjectMotionStart?: () => void;
  captureObjectMotionEnd?: () => void;
  addCustomObjectMotion?: (duration: number, motionMode?: ObjectMotionMode) => void;
};

type PanelApi = {
  getSelectedCameraId: () => string;
  refreshCameras: (cameras: CameraOption[], activeId: string) => void;
  refreshShots: (shots: ProductionShotItem[]) => void;
  setRecordingState: (recording: boolean, message?: string) => void;
  setStatus: (message: string) => void;
  destroy: () => void;
};

const QUICK_SHOTS: ReadonlyArray<readonly [CameraShot, string]> = [
  ["orbit", "Orbit"],
  ["dolly-in", "Dolly In"],
  ["dolly-out", "Dolly Out"],
  ["close-up", "Close Up"],
  ["dolly-zoom", "Dolly Zoom"],
  ["pan-left", "Pan Left"],
  ["pan-right", "Pan Right"],
  ["crane-up", "Crane Up"],
  ["crane-down", "Crane Down"],
  ["hero", "Hero"],
];

const STYLE_PRESETS: readonly OverlayStylePreset[] = [
  "Documentary",
  "Minimal",
  "Broadcast",
  "Trailer",
];

const PLACEMENTS: readonly OverlayPlacement[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

/**
 * Intentionally left empty until motion presets are exposed in a more editor-
 * friendly way from the project surface.
 */
const MOTION_PRESETS: ReadonlyArray<readonly [MotionPreset, string]> = [];

export function createProductionPanel(
  opts: CreateProductionPanelOptions,
): PanelApi {
  const {
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
    recordTimeline,
    viewSelectedCamera,
    viewMainCamera,
    removeCameraShot,
    moveCameraShot,
    selectCameraShot,
    duplicateCameraShot,
    previewCameraShot,
    updateCameraShotDuration,
    updateCameraShotRigOptions,
    shotRepository,
    shotOverlayScheduler,
    getSelectedTargetName,
    captureObjectMotionStart,
    captureObjectMotionEnd,
    addCustomObjectMotion,
  } = opts;

  const panel = document.createElement("aside");
  panel.className = "production-panel production-panel-v3";
  panel.innerHTML = markup();
  root.appendChild(panel);

  const el = {
    status: qs<HTMLDivElement>(panel, "[data-role=status]"),
    recordStatus: qs<HTMLDivElement>(panel, "[data-role=record-status]"),
    duration: qs<HTMLInputElement>(panel, "#pp-duration"),
    renderCamera: qs<HTMLSelectElement>(panel, "#pp-render-camera"),
    recAspect: qs<HTMLSelectElement>(panel, "#pp-record-aspect"),
    recSeconds: qs<HTMLInputElement>(panel, "#pp-record-seconds"),
    recFps: qs<HTMLInputElement>(panel, "#pp-record-fps"),
    rigOrbit: qs<HTMLInputElement>(panel, "#pp-rig-orbit"),
    rigDistance: qs<HTMLInputElement>(panel, "#pp-rig-distance"),
    rigHeight: qs<HTMLInputElement>(panel, "#pp-rig-height"),
    rigFov: qs<HTMLInputElement>(panel, "#pp-rig-fov"),
    shotList: qs<HTMLDivElement>(panel, "[data-role=shot-list]"),
    shotEmpty: qs<HTMLDivElement>(panel, "[data-role=shot-empty]"),
    meta: qs<HTMLDivElement>(panel, "[data-role=inspector-meta]"),
    tabs: qs<HTMLDivElement>(panel, "[data-role=inspector-tabs]"),
    body: qs<HTMLDivElement>(panel, "[data-role=inspector-body]"),
  };

  let cameras: CameraOption[] = [];
  let shots: ProductionShotItem[] = [];
  let selectedShotId: string | null = null;
  let activeTab: InspectorTab = "overlay";
  const draftById = new Map<string, ShotDraft>();
  let overlayClipboard: TitleOverlayDraft | null = null;

  function playTimelineSafe(): void {
    playTimeline();
  }

  function pauseTimelineSafe(): void {
    pauseTimeline();
    shotOverlayScheduler?.stop();
  }

  function stopTimelineSafe(): void {
    stopTimeline();
    shotOverlayScheduler?.stop();
  }

  bindTopLevel();
  bindShotList();
  bindInspectorInputs();
  renderShotList();
  renderInspector();

  return {
    getSelectedCameraId(): string {
      return el.renderCamera.value || "main";
    },
    refreshCameras(next: CameraOption[], activeId: string): void {
      cameras = Array.isArray(next) ? next : [];
      const keep = activeId || "main";
      el.renderCamera.innerHTML =
        `<option value="main">Main View</option>` +
        cameras
          .map(
            (camera) =>
              `<option value="${escAttr(camera.id)}">${esc(camera.label)}</option>`,
          )
          .join("");
      el.renderCamera.value = Array.from(el.renderCamera.options).some(
        (option) => option.value === keep,
      )
        ? keep
        : "main";
      renderInspector();
    },
    refreshShots(next: ProductionShotItem[]): void {
      shots = Array.isArray(next) ? next.slice() : [];
      syncDrafts();

      const activeShot = shots.find((shot) => shot.active);
      if (activeShot) {
        selectedShotId = activeShot.id;
      }

      if (selectedShotId && !shots.some((shot) => shot.id === selectedShotId)) {
        selectedShotId = null;
      }
      if (!selectedShotId && shots[0]) {
        selectedShotId = shots[0].id;
      }
      renderShotList();
      renderInspector();
    },
    setRecordingState(recording: boolean, message?: string): void {
      panel.dataset.recording = recording ? "true" : "false";
      el.recordStatus.textContent =
        message ?? (recording ? "Recording..." : "Recorder ready");
    },
    setStatus(message: string): void {
      setStatus(message);
    },
    destroy(): void {
      panel.remove();
    },
  };

  function bindTopLevel(): void {
    on("#pp-play", () => {
      playTimelineSafe();
      setStatus("Timeline playing");
    });

    on("#pp-pause", () => {
      pauseTimelineSafe();
      setStatus("Timeline paused");
    });

    on("#pp-stop", () => {
      stopTimelineSafe();
      setStatus("Timeline stopped");
    });

    on("#pp-shot-add", () => {
      addShot(shotDuration());
      setStatus("Static shot added");
    });

    on("#pp-camera-main", () => {
      el.renderCamera.value = "main";
      viewMainCamera();
      renderInspector();
      setStatus("Viewing main camera");
    });

    on("#pp-motion-start", () => {
      captureObjectMotionStart?.();
      setStatus("Object motion start captured");
    });

    on("#pp-motion-end", () => {
      captureObjectMotionEnd?.();
      setStatus("Object motion end captured");
    });

    on("#pp-motion-add-transform", () => {
      addCustomObjectMotion?.(shotDuration(), "move-rotate-scale");
      setStatus("Object motion clip added");
    });

    on("#pp-motion-add-move", () => {
      addCustomObjectMotion?.(shotDuration(), "move");
      setStatus("Move motion clip added");
    });

    on("#pp-motion-add-rotate", () => {
      addCustomObjectMotion?.(shotDuration(), "rotate");
      setStatus("Rotate motion clip added");
    });

    on("#pp-motion-add-scale", () => {
      addCustomObjectMotion?.(shotDuration(), "scale");
      setStatus("Scale motion clip added");
    });

    on("#pp-theatre-play", () => {
      playTheatreSequence();
      setStatus("Theatre sequence started");
    });

    on("#pp-theatre-open", () => {
      restoreTheatreStudio();
      setStatus("Theatre opened");
    });

    on("#pp-theatre-open-shots", () => {
      restoreTheatreStudioWithShots();
      setStatus("Theatre opened with shots");
    });

    on("#pp-theatre-bake", () => {
      bakeShotsToTheatre();
      setStatus("Shots baked to Theatre");
    });

    on("#pp-record-start", () => {
      startRecording(recordAspect(), recordSeconds(), recordFps());
      el.recordStatus.textContent = "Recording viewport...";
    });

    on("#pp-record-stop", () => {
      stopRecording();
      el.recordStatus.textContent = "Recorder stopped";
    });

    on("#pp-record-timeline", () => {
      recordTimeline(recordAspect(), recordSeconds(), recordFps());
      el.recordStatus.textContent = "Recording timeline...";
    });

    el.renderCamera.onchange = () => {
      viewSelectedCamera(el.renderCamera.value);
      renderInspector();
      setStatus(`Viewing camera: ${cameraLabel(el.renderCamera.value)}`);
    };

    [el.rigOrbit, el.rigDistance, el.rigHeight, el.rigFov].forEach((input) => {
      input.onchange = () => {
        if (!selectedShotId) return;
        const draft = ensureDraft(selectedShotId);
        draft.rig = rigOptions();
        updateCameraShotRigOptions(selectedShotId, draft.rig);
        syncRepo(selectedShotId);
        renderInspector();
      };
    });

    panel
      .querySelectorAll<HTMLButtonElement>("[data-camera-shot]")
      .forEach((button) => {
        button.onclick = () => {
          const shot = button.dataset.cameraShot as CameraShot | undefined;
          if (!shot) return;
          viewSelectedCamera(el.renderCamera.value);
          applyCameraShot(shot, shotDuration(), rigOptions());
          setStatus(`Queued shot: ${button.textContent ?? shot}`);
        };
      });

    panel
      .querySelectorAll<HTMLButtonElement>("[data-motion]")
      .forEach((button) => {
        button.onclick = () => {
          const preset = button.dataset.motion as MotionPreset | undefined;
          if (!preset) return;
          applyObjectMotion(preset, shotDuration());
          setStatus(`Applied motion: ${button.textContent ?? preset}`);
        };
      });

    el.tabs.onclick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-tab]",
      );
      if (!button?.dataset.tab) return;
      activeTab = button.dataset.tab as InspectorTab;
      renderInspector();
    };
  }

  function bindShotList(): void {
    el.shotList.onclick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLElement>("[data-shot-row]");
      const shotId = row?.dataset.shotRow;
      if (!shotId) return;

      if (target.closest("[data-action=preview]")) {
        previewShot(shotId, false);
        return;
      }

      if (target.closest("[data-action=duplicate]")) {
        duplicateCameraShot(shotId);
        setStatus("Shot duplicated");
        return;
      }

      if (target.closest("[data-action=delete]")) {
        removeCameraShot(shotId);
        shotRepository?.remove(shotId);
        draftById.delete(shotId);
        setStatus("Shot removed");
        return;
      }

      if (target.closest("[data-action=up]")) {
        moveCameraShot(shotId, -1);
        setStatus("Shot moved up");
        return;
      }

      if (target.closest("[data-action=down]")) {
        moveCameraShot(shotId, 1);
        setStatus("Shot moved down");
        return;
      }

      selectedShotId = shotId;
      selectCameraShot(shotId);
      renderShotList();
      renderInspector();
    };

    el.shotList.onchange = (event: Event) => {
      const target = event.target as HTMLElement;
      const rowDuration = target.closest<HTMLInputElement>(
        "input[data-shot-duration]",
      );
      if (!rowDuration?.dataset.shotDuration) return;

      const shotId = rowDuration.dataset.shotDuration;
      const value = positive(rowDuration.value, 4, 0.5);
      updateCameraShotDuration(shotId, value);

      const draft = ensureDraft(shotId);
      draft.duration = value;
      draft.overlay.duration = Math.min(
        Math.max(draft.overlay.duration, 0.1),
        Math.max(value, 0.1),
      );

      syncRepo(shotId);
      renderShotList();
      renderInspector();
    };
  }

  function bindInspectorInputs(): void {
    el.body.oninput = (event: Event) => {
      const target = event.target as HTMLElement;
      const overlayField = target.closest<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("[data-overlay-field]");

      // Avoid full re-render on keystroke so text editing feels stable.
      if (overlayField && selectedShotId) {
        patchOverlay(selectedShotId, overlayField, true);
      }
    };

    el.body.onchange = (event: Event) => {
      const target = event.target as HTMLElement;

      const cameraField = target.closest<HTMLInputElement>("[data-cam-field]");
      if (cameraField && selectedShotId) {
        applyCameraFieldChange(selectedShotId, cameraField);
        renderShotList();
        renderInspector();
        return;
      }

      const overlayField = target.closest<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("[data-overlay-field]");
      if (overlayField && selectedShotId) {
        patchOverlay(selectedShotId, overlayField, false);
        renderInspector();
      }
    };
  }

  function applyCameraFieldChange(
    shotId: string,
    input: HTMLInputElement,
  ): void {
    const field = input.dataset.camField as
      | "duration"
      | "orbitDegrees"
      | "distanceMultiplier"
      | "heightMultiplier"
      | "fov"
      | undefined;

    if (!field) return;

    const draft = ensureDraft(shotId);

    if (field === "duration") {
      const value = positive(input.value, 4, 0.5);
      draft.duration = value;
      draft.overlay.duration = Math.min(
        Math.max(draft.overlay.duration, 0.1),
        Math.max(value, 0.1),
      );
      updateCameraShotDuration(shotId, value);
    } else {
      const nextValue = num(input.value, defaultRigValue(field));
      draft.rig = { ...draft.rig, [field]: nextValue };
      updateCameraShotRigOptions(shotId, draft.rig);
    }

    syncRepo(shotId);
  }

  function renderShotList(): void {
    el.shotList.innerHTML = "";
    el.shotEmpty.hidden = shots.length > 0;

    shots.forEach((shot, index) => {
      const row = document.createElement("article");
      row.dataset.shotRow = shot.id;
      row.className = "production-shot-row";
      if (shot.id === selectedShotId) {
        row.dataset.selected = "true";
      }

      row.innerHTML = `
        <div class="pp-row-main">
          <strong>${index + 1}. ${esc(shot.label)}</strong>
          <span>
            ${esc(shot.cameraLabel ?? "Main View")}
            → ${esc(shot.targetLabel ?? "Scene center")}
            • ${fmt(shot.duration)}s
          </span>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value="${fmt(shot.duration)}"
            data-shot-duration="${escAttr(shot.id)}"
          />
        </div>
        <div class="pp-row-actions">
          <button type="button" data-action="preview">Preview</button>
          <button type="button" data-action="up">↑</button>
          <button type="button" data-action="down">↓</button>
          <button type="button" data-action="duplicate">⧉</button>
          <button type="button" data-action="delete">✕</button>
        </div>
      `;

      el.shotList.appendChild(row);
    });
  }

  function renderInspector(): void {
    const shot = currentShot();

    el.tabs.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.dataset.active =
        button.dataset.tab === activeTab ? "true" : "false";
    });

    if (!shot) {
      el.meta.innerHTML = `
        <strong>No shot selected</strong>
        <span>Select or add a shot to inspect it.</span>
      `;
      el.body.innerHTML = `<div class="pp-note">Inspector waiting for a shot.</div>`;
      wireInspectorButtons();
      return;
    }

    const draft = ensureDraft(shot.id, shot);
    const targetName =
      getSelectedTargetName?.() ?? shot.targetLabel ?? "Scene center";

    const shotStart = typeof shot.start === "number" ? shot.start : shotStartTime(shot.id);
    const shotEnd = shotStart + draft.duration;

    el.meta.innerHTML = `
      <strong>Selected Shot: ${esc(shot.label)}</strong>
      <span>${fmt(shotStart)}s → ${fmt(shotEnd)}s • ${esc(draft.shotType)}</span>
      <span>${esc(shot.cameraLabel ?? cameraLabel(el.renderCamera.value))} → ${esc(targetName)}</span>
      <span>Edits below apply only to this selected shot.</span>
    `;

    if (activeTab === "camera") {
      el.body.innerHTML = `
        <div class="pp-form-grid">
          ${cameraNumberField("Duration", "duration", draft.duration, 0.5, 0.5)}
          ${cameraNumberField("Orbit Angle", "orbitDegrees", draft.rig.orbitDegrees ?? 180, 0, 5)}
          ${cameraNumberField("Distance Multiplier", "distanceMultiplier", draft.rig.distanceMultiplier ?? 1, 0.1, 0.1)}
          ${cameraNumberField("Height Multiplier", "heightMultiplier", draft.rig.heightMultiplier ?? 1, 0.1, 0.1)}
          ${cameraNumberField("FOV", "fov", draft.rig.fov ?? 50, 1, 1)}
        </div>
        <div class="pp-note">
          Camera ${esc(shot.cameraLabel ?? cameraLabel(el.renderCamera.value))}
          targeting ${esc(targetName)}.
        </div>
      `;
    } else if (activeTab === "overlay") {
      const repositoryState = shotRepository
        ? "Repository persistence enabled"
        : "Repository not wired; edits remain in panel draft until createStudioApp passes shotRepository";

      const schedulerState = shotOverlayScheduler
        ? "Live overlay preview enabled"
        : "Live overlay preview unavailable until createStudioApp passes shotOverlayScheduler";

      el.body.innerHTML = `
        <div class="pp-note pp-selected-shot-note">
          <strong>Overlay for THIS Shot</strong><br />
          Editing here changes only <strong>${esc(shot.label)}</strong>. Other shots keep their own titles.
        </div>
        <div class="pp-form-grid">
          <label class="pp-field pp-field-checkbox">
            <span>Enable Title</span>
            <input
              type="checkbox"
              data-overlay-field="enabled"
              ${draft.overlay.enabled ? "checked" : ""}
            />
          </label>
          ${textField("Eyebrow", "eyebrow", draft.overlay.eyebrow)}
          ${textField("Title", "title", draft.overlay.title)}
          ${areaField("Subtitle", "subtitle", draft.overlay.subtitle)}
          ${overlayNumberField("Delay", "delay", draft.overlay.delay, 0, 0.1)}
          ${overlayNumberField("Duration", "duration", draft.overlay.duration, 0.1, 0.1)}
          ${selectField("Style Preset", "stylePreset", STYLE_PRESETS, draft.overlay.stylePreset)}
          ${selectField("Placement", "placement", PLACEMENTS, draft.overlay.placement)}
          ${overlayNumberField("Title Size", "titleSize", draft.overlay.titleSize, 18, 1)}
          ${overlayNumberField("Subtitle Size", "subtitleSize", draft.overlay.subtitleSize, 10, 1)}
          ${overlayNumberField("Eyebrow Size", "eyebrowSize", draft.overlay.eyebrowSize, 8, 1)}
          ${overlayNumberField("Text Width", "maxWidth", draft.overlay.maxWidth, 0.35, 0.01)}
          ${overlayNumberField("Shadow", "shadowStrength", draft.overlay.shadowStrength, 0, 0.05)}
          ${colorField("Text Color", "textColor", draft.overlay.textColor)}
          ${colorField("Accent Color", "accentColor", draft.overlay.accentColor)}
        </div>
        <div class="pp-action-grid">
          <button type="button" id="pp-overlay-preview">Preview This Shot Title</button>
          <button type="button" id="pp-overlay-save">Apply To This Shot</button>
          <button type="button" id="pp-overlay-reset">Reset This Shot</button>
          <button type="button" id="pp-overlay-copy">Copy Overlay</button>
          <button type="button" id="pp-overlay-paste">Paste Overlay</button>
        </div>
        <div class="pp-note">
          ${esc(repositoryState)}. ${esc(schedulerState)}.
          Each camera shot now owns its own overlay data.
        </div>
      `;
    } else if (activeTab === "animation") {
      el.body.innerHTML = `
        <div class="pp-action-grid">
          <button type="button" id="pp-inspector-preview">Preview Shot</button>
          <button type="button" id="pp-inspector-preview-overlay">Preview Shot + Overlay</button>
          <button type="button" id="pp-inspector-duplicate">Duplicate</button>
          <button type="button" id="pp-inspector-delete">Delete</button>
          <button type="button" id="pp-inspector-up">Move Up</button>
          <button type="button" id="pp-inspector-down">Move Down</button>
        </div>
        <div class="pp-note">
          Shot ID ${esc(shot.id)}. Animation actions use the existing timeline/controller callbacks
          supplied by createStudioApp rather than mutating timeline internals directly.
        </div>
      `;
    } else {
      el.body.innerHTML = `
        <div class="pp-note">
          Audio is currently a placeholder tab. Hook audio track/editor APIs here when the
          Director engine exposes them.
        </div>
      `;
    }

    wireInspectorButtons();
  }

  function wireInspectorButtons(): void {
    panel
      .querySelector<HTMLButtonElement>("#pp-inspector-preview")
      ?.addEventListener("click", () => {
        if (!selectedShotId) return;
        previewShot(selectedShotId, false);
      });

    panel
      .querySelector<HTMLButtonElement>("#pp-inspector-preview-overlay")
      ?.addEventListener("click", () => {
        if (!selectedShotId) return;
        previewShot(selectedShotId, true);
      });

    panel
      .querySelector<HTMLButtonElement>("#pp-inspector-duplicate")
      ?.addEventListener("click", () => {
        if (!selectedShotId) return;
        duplicateCameraShot(selectedShotId);
        setStatus("Shot duplicated");
      });

    panel
      .querySelector<HTMLButtonElement>("#pp-inspector-delete")
      ?.addEventListener("click", () => {
        if (!selectedShotId) return;
        removeCameraShot(selectedShotId);
        shotRepository?.remove(selectedShotId);
        draftById.delete(selectedShotId);
        setStatus("Shot removed");
      });

    panel
      .querySelector<HTMLButtonElement>("#pp-inspector-up")
      ?.addEventListener("click", () => {
        if (!selectedShotId) return;
        moveCameraShot(selectedShotId, -1);
        setStatus("Shot moved up");
      });

    panel
      .querySelector<HTMLButtonElement>("#pp-inspector-down")
      ?.addEventListener("click", () => {
        if (!selectedShotId) return;
        moveCameraShot(selectedShotId, 1);
        setStatus("Shot moved down");
      });

    panel
      .querySelector<HTMLButtonElement>("#pp-overlay-preview")
      ?.addEventListener("click", () => {
        if (!selectedShotId) return;
        previewOverlayOnly(selectedShotId);
      });

    panel
      .querySelector<HTMLButtonElement>("#pp-overlay-save")
      ?.addEventListener("click", () => {
        if (!selectedShotId) return;
        saveOverlayToShot(selectedShotId);
      });

    panel
      .querySelector<HTMLButtonElement>("#pp-overlay-reset")
      ?.addEventListener("click", () => {
        if (!selectedShotId) return;
        resetOverlayForShot(selectedShotId);
      });

    panel
      .querySelector<HTMLButtonElement>("#pp-overlay-copy")
      ?.addEventListener("click", () => {
        if (!selectedShotId) return;
        copyOverlayFromShot(selectedShotId);
      });

    panel
      .querySelector<HTMLButtonElement>("#pp-overlay-paste")
      ?.addEventListener("click", () => {
        if (!selectedShotId) return;
        pasteOverlayToShot(selectedShotId);
      });
  }

  function previewShot(shotId: string, withOverlay: boolean): void {
    previewCameraShot(shotId);

    if (!withOverlay) {
      setStatus("Shot preview played");
      return;
    }

    const draft = ensureDraft(shotId);
    if (!draft.overlay.enabled) {
      setStatus("Overlay is disabled for this shot");
      return;
    }

    if (!shotOverlayScheduler) {
      setStatus("Overlay scheduler not wired");
      return;
    }

    const cue = buildTitleCueFromDraft(draft);
    shotOverlayScheduler.stop();
    shotOverlayScheduler.play([cue]);
    setStatus("Shot + overlay preview played");
  }

  function previewOverlayOnly(shotId: string): void {
    const draft = ensureDraft(shotId);

    if (!draft.overlay.enabled) {
      setStatus("Enable Title to preview the overlay");
      return;
    }

    if (!shotOverlayScheduler) {
      setStatus("Overlay scheduler not wired");
      return;
    }

    const cue = buildTitleCueFromDraft(draft);
    shotOverlayScheduler.stop();
    shotOverlayScheduler.play([cue]);
    setStatus("Overlay preview played");
  }

  function saveOverlayToShot(shotId: string): void {
    addTitleCueToShot(shotId);

    if (shotRepository) {
      setStatus("Overlay applied to this selected shot only");
    } else {
      setStatus("Overlay applied to this selected shot draft");
    }
  }

  function resetOverlayForShot(shotId: string): void {
    const shot = shots.find((candidate) => candidate.id === shotId);
    const draft = ensureDraft(shotId, shot);
    draft.overlay = {
      ...createDefaultDraftFromShot(shot).overlay,
      enabled: false,
      eyebrow: "",
      title: "",
      subtitle: "",
    };
    syncRepo(shotId);
    shotOverlayScheduler?.stop();
    renderInspector();
    setStatus("Overlay reset for this shot only");
  }

  function copyOverlayFromShot(shotId: string): void {
    const draft = ensureDraft(shotId);
    overlayClipboard = cloneOverlayDraft(draft.overlay);
    setStatus("Overlay copied from selected shot");
  }

  function pasteOverlayToShot(shotId: string): void {
    if (!overlayClipboard) {
      setStatus("No overlay copied yet");
      return;
    }

    const draft = ensureDraft(shotId);
    draft.overlay = cloneOverlayDraft(overlayClipboard);
    syncRepo(shotId);
    renderInspector();
    setStatus("Overlay pasted to this shot only");
  }

  function addTitleCueToShot(shotId: string): void {
    const draft = ensureDraft(shotId);
    const cue = buildTitleCueFromDraft(draft);

    if (shotRepository) {
      shotRepository.update(shotId, (shotDefinition: ShotDefinition) => {
        shotDefinition.overlays = replaceOrAppendTitleCue(
          shotDefinition.overlays,
          cue,
        );
      });

      if (!shotRepository.getById(shotId)) {
        syncRepo(shotId);
      }

      // Re-run sync after cue insertion so the shot exists even when it was first
      // created from timeline state rather than the repository.
      syncRepo(shotId);
    } else {
      syncRepo(shotId);
    }

    shotOverlayScheduler?.stop();
    shotOverlayScheduler?.play([cue]);

    setStatus(
      shotRepository
        ? "Title cue added to shot and played"
        : "Title cue added to draft and played",
    );
  }

  function syncDrafts(): void {
    const keep = new Set<string>();

    shots.forEach((shot) => {
      keep.add(shot.id);

      const existingDraft = draftById.get(shot.id);
      if (existingDraft) {
        existingDraft.duration = Math.max(
          shot.duration || existingDraft.duration,
          0.5,
        );
        if (typeof shot.orbitDegrees === "number") {
          existingDraft.rig.orbitDegrees = shot.orbitDegrees;
        }
        if (typeof shot.distanceMultiplier === "number") {
          existingDraft.rig.distanceMultiplier = shot.distanceMultiplier;
        }
        if (typeof shot.heightMultiplier === "number") {
          existingDraft.rig.heightMultiplier = shot.heightMultiplier;
        }
        if (typeof shot.fov === "number") {
          existingDraft.rig.fov = shot.fov;
        }
        return;
      }

      ensureDraft(shot.id, shot);

      // Mirror timeline shots into the shot repository when that repository is
      // supplied by createStudioApp. This keeps the panel aligned with repo-based
      // editing without mutating timeline internals.
      if (shotRepository && !shotRepository.getById(shot.id)) {
        syncRepo(shot.id);
      }
    });

    [...draftById.keys()].forEach((id) => {
      if (!keep.has(id)) {
        draftById.delete(id);
      }
    });
  }

  function ensureDraft(
    id: string,
    shot?: Partial<ProductionShotItem>,
  ): ShotDraft {
    const existing = draftById.get(id);
    if (existing) {
      return existing;
    }

    const repoShot = shotRepository?.getById(id);
    const draft = repoShot
      ? draftFromShotDefinition(repoShot, shot)
      : createDefaultDraftFromShot(shot);

    draftById.set(id, draft);
    return draft;
  }

  function patchOverlay(
    shotId: string,
    field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    silent: boolean,
  ): void {
    const overlayKey = field.dataset.overlayField as
      | keyof TitleOverlayDraft
      | undefined;

    if (!overlayKey) return;

    const draft = ensureDraft(shotId);

    switch (overlayKey) {
      case "enabled":
        draft.overlay.enabled = (field as HTMLInputElement).checked;
        break;
      case "eyebrow":
        draft.overlay.eyebrow = field.value;
        break;
      case "title":
        draft.overlay.title = field.value;
        break;
      case "subtitle":
        draft.overlay.subtitle = field.value;
        break;
      case "delay":
        draft.overlay.delay = positive(field.value, 0, 0);
        break;
      case "duration":
        draft.overlay.duration = positive(field.value, 0.1, 0.1);
        break;
      case "titleSize":
        draft.overlay.titleSize = clamp(positive(field.value, 58, 18), 18, 140);
        break;
      case "subtitleSize":
        draft.overlay.subtitleSize = clamp(positive(field.value, 22, 10), 10, 72);
        break;
      case "eyebrowSize":
        draft.overlay.eyebrowSize = clamp(positive(field.value, 17, 8), 8, 48);
        break;
      case "maxWidth":
        draft.overlay.maxWidth = clamp(positive(field.value, 0.82, 0.35), 0.35, 0.96);
        break;
      case "shadowStrength":
        draft.overlay.shadowStrength = clamp(positive(field.value, 0.85, 0), 0, 1.5);
        break;
      case "textColor":
        draft.overlay.textColor = normalizeColor(field.value, "#ffffff");
        break;
      case "accentColor":
        draft.overlay.accentColor = normalizeColor(field.value, "#ffd24a");
        break;
      case "stylePreset":
        draft.overlay.stylePreset = field.value as OverlayStylePreset;
        break;
      case "placement":
        draft.overlay.placement = field.value as OverlayPlacement;
        break;
      default:
        break;
    }

    syncRepo(shotId);

    if (!silent) {
      setStatus("Overlay updated");
    }
  }

  function syncRepo(shotId: string): void {
    if (!shotRepository) return;

    const draft = draftById.get(shotId);
    if (!draft) return;

    const existing = shotRepository.getById(shotId);
    if (existing) {
      shotRepository.update(shotId, (shotDefinition: ShotDefinition) => {
        applyDraftToShotDefinition(shotDefinition, draft);
      });
      return;
    }

    const timelineShot = shots.find((candidate) => candidate.id === shotId);
    const definition = createShotDefinition(draft.shotType, draft.duration);
    definition.id = shotId;
    definition.name = timelineShot?.label || definition.name;
    applyDraftToShotDefinition(definition, draft);
    shotRepository.add(definition);
  }

  function currentShot(): ProductionShotItem | null {
    if (!selectedShotId) return null;
    return shots.find((shot) => shot.id === selectedShotId) ?? null;
  }

  function shotStartTime(shotId: string): number {
    let cursor = 0;
    for (const item of shots) {
      if (item.id === shotId) return cursor;
      cursor += Math.max(item.duration || 0, 0);
    }
    return 0;
  }

  function cloneOverlayDraft(overlay: TitleOverlayDraft): TitleOverlayDraft {
    return { ...overlay };
  }

  function rigOptions(): CameraShotRigOptions {
    return {
      orbitDegrees: num(el.rigOrbit.value, 180),
      distanceMultiplier: num(el.rigDistance.value, 1),
      heightMultiplier: num(el.rigHeight.value, 1),
      fov: num(el.rigFov.value, 50),
    };
  }

  function shotDuration(): number {
    return positive(el.duration.value, 4, 0.5);
  }

  function recordAspect(): RecordingAspect {
    return (el.recAspect.value || "16:9") as RecordingAspect;
  }

  function recordSeconds(): number {
    return positive(el.recSeconds.value, 8, 1);
  }

  function recordFps(): number {
    return Math.max(Math.round(positive(el.recFps.value, 30, 12)), 12);
  }

  function cameraLabel(id: string): string {
    return cameras.find((camera) => camera.id === id)?.label ?? "Main View";
  }

  function setStatus(message: string): void {
    el.status.textContent = message;
  }

  function on(selector: string, handler: () => void): void {
    const node = panel.querySelector<HTMLButtonElement>(selector);

    // Some legacy controls, especially old Theatre.js buttons, may be
    // intentionally removed from the markup while older binding code still
    // exists. Missing optional buttons must not crash the whole studio.
    if (!node) return;

    node.onclick = handler;
  }
}

function markup(): string {
  const shotButtons = QUICK_SHOTS.map(
    ([value, label]) =>
      `<button type="button" data-camera-shot="${value}">${label}</button>`,
  ).join("");

  const motionButtons = `
    <div class="production-section-title">Object Motion</div>
    <div class="pp-note">Select an object, capture Start, move/rotate/scale it, capture End, then add a motion clip.</div>
    <div class="pp-grid-3">
      <button type="button" id="pp-motion-start">Capture Start</button>
      <button type="button" id="pp-motion-end">Capture End</button>
      <button type="button" id="pp-motion-add-transform">Add Motion Clip</button>
    </div>
    <div class="pp-grid-3">
      <button type="button" id="pp-motion-add-move">Move Only</button>
      <button type="button" id="pp-motion-add-rotate">Rotate Only</button>
      <button type="button" id="pp-motion-add-scale">Scale Only</button>
    </div>
    ${MOTION_PRESETS.length
      ? `<div class="pp-grid-2">${MOTION_PRESETS.map(
          ([value, label]) =>
            `<button type="button" data-motion="${String(value)}">${label}</button>`,
        ).join("")}</div>`
      : ""}
  `;

  return `
    <div
      class="production-panel-shell"
      style="display:grid;gap:12px;padding:12px;color:#e5eefb;background:#0f172a;font:12px/1.45 Inter,system-ui,sans-serif;overflow:auto"
    >
      <div style="display:grid;gap:6px">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <strong>Production Panel</strong>
          <span style="opacity:.7">Shot Inspector</span>
        </div>
        <div data-role="status" class="asset-status">Ready</div>
      </div>

      <section class="production-section" style="display:grid;gap:8px">
        <div class="production-section-title">Timeline</div>
        <div class="pp-grid-3">
          <button type="button" id="pp-play">Play</button>
          <button type="button" id="pp-pause">Pause</button>
          <button type="button" id="pp-stop">Stop</button>
        </div>
      </section>

      <section class="production-section" style="display:grid;gap:8px">
        <div class="production-section-title">Create Shots</div>
        <label class="pp-field">
          <span>New Shot Duration</span>
          <input id="pp-duration" type="number" min="0.5" step="0.5" value="4" />
        </label>

        <div class="pp-form-grid">
          <label class="pp-field">
            <span>Orbit Angle</span>
            <input id="pp-rig-orbit" type="number" min="0" step="5" value="180" />
          </label>
          <label class="pp-field">
            <span>Distance Multiplier</span>
            <input id="pp-rig-distance" type="number" min="0.1" step="0.1" value="1" />
          </label>
          <label class="pp-field">
            <span>Height Multiplier</span>
            <input id="pp-rig-height" type="number" min="0.1" step="0.1" value="1" />
          </label>
          <label class="pp-field">
            <span>FOV</span>
            <input id="pp-rig-fov" type="number" min="1" step="1" value="50" />
          </label>
        </div>

        <div class="pp-grid-2">
          <button type="button" id="pp-shot-add">Add Static Shot</button>
          <button type="button" id="pp-camera-main">View Main Camera</button>
        </div>

        <div class="pp-grid-2">${shotButtons}</div>
        ${motionButtons}

        <div data-role="shot-empty" class="pp-note">
          No shots yet. Add or queue a shot to begin.
        </div>
        <div data-role="shot-list" class="shot-list"></div>
      </section>

      <section class="production-section" style="display:grid;gap:8px">
        <div class="production-section-title">Shot Inspector</div>
        <div data-role="inspector-meta" class="pp-note"></div>
        <div data-role="inspector-tabs" class="pp-tab-row">
          <button type="button" data-tab="camera">Camera</button>
          <button type="button" data-tab="overlay">Overlay</button>
          <button type="button" data-tab="animation">Animation</button>
          <button type="button" data-tab="audio">Audio</button>
        </div>
        <div data-role="inspector-body" class="pp-inspector-body"></div>
      </section>

      <section class="production-section" style="display:grid;gap:8px">
        <div class="production-section-title">Render Camera</div>
        <label class="pp-field">
          <span>Camera</span>
          <select id="pp-render-camera">
            <option value="main">Main View</option>
          </select>
        </label>
      </section>

      <section class="production-section" style="display:grid;gap:8px">
        <div class="production-section-title">Native Timeline</div>
        <div class="pp-note">Theatre is disabled. Use Play / Pause / Stop and the Overlay tab.</div>
      </section>

      <section class="production-section" style="display:grid;gap:8px">
        <div class="production-section-title">Recording</div>
        <label class="pp-field">
          <span>Aspect</span>
          <select id="pp-record-aspect">
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>
        </label>
        <div class="pp-form-grid">
          <label class="pp-field">
            <span>Seconds</span>
            <input id="pp-record-seconds" type="number" min="1" step="1" value="8" />
          </label>
          <label class="pp-field">
            <span>FPS</span>
            <input id="pp-record-fps" type="number" min="12" step="1" value="30" />
          </label>
        </div>
        <div class="pp-grid-3">
          <button type="button" id="pp-record-start">Start</button>
          <button type="button" id="pp-record-stop">Stop</button>
          <button type="button" id="pp-record-timeline">Record Timeline</button>
        </div>
        <div data-role="record-status" class="asset-status">Recorder ready</div>
      </section>
    </div>
  `;
}

function cameraNumberField(
  label: string,
  field:
    | "duration"
    | "orbitDegrees"
    | "distanceMultiplier"
    | "heightMultiplier"
    | "fov",
  value: number,
  min: number,
  step: number,
): string {
  return `
    <label class="pp-field">
      <span>${esc(label)}</span>
      <input
        type="number"
        min="${min}"
        step="${step}"
        value="${fmt(value)}"
        data-cam-field="${field}"
      />
    </label>
  `;
}

function textField(
  label: string,
  field: "eyebrow" | "title",
  value: string,
): string {
  return `
    <label class="pp-field">
      <span>${esc(label)}</span>
      <input
        type="text"
        value="${escAttr(value)}"
        data-overlay-field="${field}"
      />
    </label>
  `;
}

function areaField(label: string, field: "subtitle", value: string): string {
  return `
    <label class="pp-field">
      <span>${esc(label)}</span>
      <textarea rows="3" data-overlay-field="${field}">${esc(value)}</textarea>
    </label>
  `;
}

function overlayNumberField(
  label: string,
  field: "delay" | "duration" | "titleSize" | "subtitleSize" | "eyebrowSize" | "maxWidth" | "shadowStrength",
  value: number,
  min: number,
  step: number,
): string {
  return `
    <label class="pp-field">
      <span>${esc(label)}</span>
      <input
        type="number"
        min="${min}"
        step="${step}"
        value="${fmt(value)}"
        data-overlay-field="${field}"
      />
    </label>
  `;
}

function colorField(
  label: string,
  field: "textColor" | "accentColor",
  value: string,
): string {
  return `
    <label class="pp-field">
      <span>${esc(label)}</span>
      <input
        type="color"
        value="${escAttr(normalizeColor(value, field === "accentColor" ? "#ffd24a" : "#ffffff"))}"
        data-overlay-field="${field}"
      />
    </label>
  `;
}

function selectField<T extends string>(
  label: string,
  field: "stylePreset" | "placement",
  options: readonly T[],
  selected: T,
): string {
  return `
    <label class="pp-field">
      <span>${esc(label)}</span>
      <select data-overlay-field="${field}">
        ${options
          .map(
            (option) =>
              `<option value="${escAttr(option)}" ${
                option === selected ? "selected" : ""
              }>${esc(option)}</option>`,
          )
          .join("")}
      </select>
    </label>
  `;
}

function cameraShotToShotType(shot?: CameraShot): ShotType {
  switch (shot) {
    case "orbit":
      return "orbit";
    case "close-up":
      return "close-up";
    case "dolly-in":
    case "dolly-out":
    case "dolly-zoom":
      return "dolly";
    case "crane-up":
    case "crane-down":
      return "crane";
    default:
      return "static";
  }
}

function applyDraftToShotDefinition(
  shot: ShotDefinition,
  draft: ShotDraft,
): void {
  const mutableShot = shot as ShotDefinition & Record<string, unknown>;
  mutableShot.duration = draft.duration;

  switch (draft.shotType) {
    case "orbit":
      mutableShot.radius = numberOr(draft.rig.distanceMultiplier, 1) * 8;
      mutableShot.height = numberOr(draft.rig.heightMultiplier, 1) * 2.5;
      mutableShot.angleDeg = numberOr(draft.rig.orbitDegrees, 180);
      break;

    case "close-up":
      mutableShot.distance = numberOr(draft.rig.distanceMultiplier, 1) * 3;
      mutableShot.height = numberOr(draft.rig.heightMultiplier, 1) * 1.4;
      break;

    case "dolly":
      mutableShot.fromDistance = numberOr(draft.rig.distanceMultiplier, 1) * 10;
      mutableShot.toDistance = Math.max(
        numberOr(draft.rig.distanceMultiplier, 1) * 4,
        0.5,
      );
      break;

    case "crane":
      mutableShot.startHeight = Math.max(
        numberOr(draft.rig.heightMultiplier, 1) * 1.5,
        0.1,
      );
      mutableShot.endHeight = Math.max(
        numberOr(draft.rig.heightMultiplier, 1) * 8,
        0.1,
      );
      break;

    case "follow":
      mutableShot.distance = numberOr(draft.rig.distanceMultiplier, 1) * 6;
      mutableShot.height = numberOr(draft.rig.heightMultiplier, 1) * 2;
      break;

    case "theatre":
    case "programmatic":
    case "static":
    default:
      break;
  }

  const cue = buildTitleCueFromDraft(draft);
  mutableShot.overlays = replaceOrAppendTitleCue(shot.overlays, cue);
}

function replaceOrAppendTitleCue(
  overlays: ShotDefinition["overlays"],
  cue: ShotTitleCue,
): ShotDefinition["overlays"] {
  const next = overlays.filter((overlay) => overlay.kind !== "title");
  return [...next, cue] as ShotDefinition["overlays"];
}

function createDefaultDraftFromShot(
  shot?: Partial<ProductionShotItem>,
): ShotDraft {
  const shotType = cameraShotToShotType(shot?.shot);
  const definition = createShotDefinition(
    shotType,
    Math.max(shot?.duration || 4, 0.5),
  );

  const titleCue =
    definition.overlays.find(isTitleCue) ?? buildTitleCueFromDraftBase();

  const overlayDuration = clamp(
    titleCue.timing.duration || shot?.duration || 3.5,
    0.1,
    Math.max(shot?.duration || 8, 0.1),
  );

  return {
    shotType,
    duration: Math.max(shot?.duration || definition.duration || 4, 0.5),
    rig: {
      orbitDegrees: shot?.orbitDegrees ?? 180,
      distanceMultiplier: shot?.distanceMultiplier ?? 1,
      heightMultiplier: shot?.heightMultiplier ?? 1,
      fov: shot?.fov ?? 50,
    },
    overlay: {
      enabled: titleCue.enabled,
      eyebrow: titleCue.eyebrow ?? "",
      title: titleCue.title || shot?.label || definition.name,
      subtitle: titleCue.subtitle ?? "",
      delay: titleCue.timing.startTime ?? 0,
      duration: overlayDuration,
      stylePreset: fromShotOverlayVariant(titleCue.variant),
      placement: fromShotOverlayPlacement(titleCue.placement),
      titleSize: titleCue.titleSize ?? defaultTitleSize(fromShotOverlayVariant(titleCue.variant)),
      subtitleSize: titleCue.subtitleSize ?? defaultSubtitleSize(fromShotOverlayVariant(titleCue.variant)),
      eyebrowSize: titleCue.eyebrowSize ?? defaultEyebrowSize(fromShotOverlayVariant(titleCue.variant)),
      maxWidth: titleCue.maxWidth ?? defaultMaxWidth(fromShotOverlayVariant(titleCue.variant)),
      textColor: titleCue.textColor ?? "#ffffff",
      accentColor: titleCue.accentColor ?? defaultAccentColor(fromShotOverlayVariant(titleCue.variant)),
      shadowStrength: titleCue.shadowStrength ?? 0.85,
    },
  };
}

function draftFromShotDefinition(
  definition: ShotDefinition,
  shot?: Partial<ProductionShotItem>,
): ShotDraft {
  const titleCue = definition.overlays.find(isTitleCue);
  const baseDraft = createDefaultDraftFromShot(shot);

  const draft: ShotDraft = {
    shotType: definition.type,
    duration: Math.max(shot?.duration || definition.duration || 4, 0.5),
    rig: {
      orbitDegrees: shot?.orbitDegrees ?? 180,
      distanceMultiplier: shot?.distanceMultiplier ?? 1,
      heightMultiplier: shot?.heightMultiplier ?? 1,
      fov: shot?.fov ?? 50,
    },
    overlay: titleCue
      ? {
          enabled: titleCue.enabled,
          eyebrow: titleCue.eyebrow ?? "",
          title: titleCue.title || shot?.label || definition.name,
          subtitle: titleCue.subtitle ?? "",
          delay: titleCue.timing.startTime ?? 0,
          duration: clamp(
            titleCue.timing.duration,
            0.1,
            Math.max(shot?.duration || definition.duration || 8, 0.1),
          ),
          stylePreset: fromShotOverlayVariant(titleCue.variant),
          placement: fromShotOverlayPlacement(titleCue.placement),
          titleSize: titleCue.titleSize ?? defaultTitleSize(fromShotOverlayVariant(titleCue.variant)),
          subtitleSize: titleCue.subtitleSize ?? defaultSubtitleSize(fromShotOverlayVariant(titleCue.variant)),
          eyebrowSize: titleCue.eyebrowSize ?? defaultEyebrowSize(fromShotOverlayVariant(titleCue.variant)),
          maxWidth: titleCue.maxWidth ?? defaultMaxWidth(fromShotOverlayVariant(titleCue.variant)),
          textColor: titleCue.textColor ?? "#ffffff",
          accentColor: titleCue.accentColor ?? defaultAccentColor(fromShotOverlayVariant(titleCue.variant)),
          shadowStrength: titleCue.shadowStrength ?? 0.85,
        }
      : baseDraft.overlay,
  };

  switch (definition.type) {
    case "orbit":
      draft.rig.orbitDegrees = shot?.orbitDegrees ?? definition.angleDeg;
      draft.rig.distanceMultiplier =
        shot?.distanceMultiplier ?? definition.radius / 8;
      draft.rig.heightMultiplier =
        shot?.heightMultiplier ?? definition.height / 2.5;
      break;

    case "close-up":
      draft.rig.distanceMultiplier =
        shot?.distanceMultiplier ?? definition.distance / 3;
      draft.rig.heightMultiplier =
        shot?.heightMultiplier ?? definition.height / 1.4;
      break;

    case "dolly":
      draft.rig.distanceMultiplier =
        shot?.distanceMultiplier ?? definition.toDistance / 4;
      break;

    case "crane":
      draft.rig.heightMultiplier =
        shot?.heightMultiplier ?? definition.endHeight / 8;
      break;

    case "follow":
      draft.rig.distanceMultiplier =
        shot?.distanceMultiplier ?? definition.distance / 6;
      draft.rig.heightMultiplier =
        shot?.heightMultiplier ?? definition.height / 2;
      break;

    case "theatre":
    case "programmatic":
    case "static":
    default:
      break;
  }

  draft.rig.fov = shot?.fov ?? draft.rig.fov ?? 50;
  return draft;
}

function buildTitleCueFromDraft(draft: ShotDraft): ShotTitleCue {
  return {
    id: `title-${crypto.randomUUID()}`,
    enabled: draft.overlay.enabled,
    kind: "title",
    placement: toShotOverlayPlacement(draft.overlay.placement),
    variant: toShotOverlayVariant(draft.overlay.stylePreset),
    timing: {
      startTime: Math.max(draft.overlay.delay, 0),
      duration: Math.max(draft.overlay.duration, 0.1),
      fadeInMs: 650,
      fadeOutMs: 500,
    },
    eyebrow: draft.overlay.eyebrow,
    title: draft.overlay.title || "Untitled",
    subtitle: draft.overlay.subtitle,
    textColor: draft.overlay.textColor,
    accentColor: draft.overlay.accentColor,
    titleSize: draft.overlay.titleSize,
    subtitleSize: draft.overlay.subtitleSize,
    eyebrowSize: draft.overlay.eyebrowSize,
    maxWidth: draft.overlay.maxWidth,
    shadowStrength: draft.overlay.shadowStrength,
    glow: draft.overlay.stylePreset === "Trailer",
  };
}

function buildTitleCueFromDraftBase(): ShotTitleCue {
  return {
    id: `title-${crypto.randomUUID()}`,
    enabled: false,
    kind: "title",
    placement: "safe-bottom",
    variant: "trailer",
    timing: {
      startTime: 0,
      duration: 3.5,
      fadeInMs: 650,
      fadeOutMs: 500,
    },
    eyebrow: "",
    title: "Untitled",
    subtitle: "",
    textColor: "#ffffff",
    accentColor: "#ffd24a",
    titleSize: 58,
    subtitleSize: 22,
    eyebrowSize: 17,
    maxWidth: 0.82,
    shadowStrength: 0.85,
    glow: true,
  };
}

function toShotOverlayPlacement(
  placement: OverlayPlacement,
): ShotOverlayPlacement {
  switch (placement) {
    case "top-left":
    case "top-center":
    case "top-right":
      return "safe-top";

    case "bottom-left":
    case "bottom-right":
      return "lower-third";

    case "bottom-center":
    default:
      return "safe-bottom";
  }
}

function fromShotOverlayPlacement(
  placement: ShotOverlayPlacement,
): OverlayPlacement {
  switch (placement) {
    case "safe-top":
      return "top-center";
    case "lower-third":
      return "bottom-left";
    case "safe-bottom":
      return "bottom-center";
    case "safe-center":
    default:
      return "bottom-center";
  }
}

function toShotOverlayVariant(style: OverlayStylePreset): ShotOverlayVariant {
  switch (style) {
    case "Documentary":
      return "documentary";
    case "Minimal":
      return "minimal";
    case "Broadcast":
      return "broadcast";
    case "Trailer":
    default:
      return "trailer";
  }
}

function fromShotOverlayVariant(
  variant: ShotOverlayVariant,
): OverlayStylePreset {
  switch (variant) {
    case "documentary":
      return "Documentary";
    case "minimal":
      return "Minimal";
    case "broadcast":
    case "science":
      return "Broadcast";
    case "trailer":
    default:
      return "Trailer";
  }
}

function defaultRigValue(
  field: "orbitDegrees" | "distanceMultiplier" | "heightMultiplier" | "fov",
): number {
  switch (field) {
    case "orbitDegrees":
      return 180;
    case "distanceMultiplier":
    case "heightMultiplier":
      return 1;
    case "fov":
    default:
      return 50;
  }
}

function isTitleCue(
  cue: ShotDefinition["overlays"][number],
): cue is ShotTitleCue {
  return cue.kind === "title";
}

function qs<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) {
    throw new Error(`createProductionPanel: Missing ${selector}`);
  }
  return node;
}

function num(value: string, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function positive(value: string, fallback: number, min: number): number {
  return Math.max(num(value, fallback), min);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function fmt(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)));
}

function normalizeColor(value: string, fallback: string): string {
  const trimmed = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function defaultTitleSize(preset: OverlayStylePreset): number {
  switch (preset) {
    case "Minimal": return 38;
    case "Documentary": return 42;
    case "Broadcast": return 46;
    case "Trailer":
    default: return 58;
  }
}

function defaultSubtitleSize(preset: OverlayStylePreset): number {
  switch (preset) {
    case "Minimal": return 18;
    case "Documentary": return 20;
    case "Broadcast": return 21;
    case "Trailer":
    default: return 22;
  }
}

function defaultEyebrowSize(preset: OverlayStylePreset): number {
  switch (preset) {
    case "Minimal": return 12;
    case "Documentary": return 14;
    case "Broadcast": return 15;
    case "Trailer":
    default: return 17;
  }
}

function defaultMaxWidth(preset: OverlayStylePreset): number {
  switch (preset) {
    case "Minimal": return 0.70;
    case "Documentary": return 0.74;
    case "Broadcast": return 0.78;
    case "Trailer":
    default: return 0.82;
  }
}

function defaultAccentColor(preset: OverlayStylePreset): string {
  switch (preset) {
    case "Minimal": return "#ffffff";
    case "Documentary": return "#e8d6a8";
    case "Broadcast": return "#75b7ff";
    case "Trailer":
    default: return "#ffd24a";
  }
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escAttr(value: string): string {
  return esc(value).replaceAll("`", "&#96;");
}

export default createProductionPanel;