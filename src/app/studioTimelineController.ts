import type { SceneNode } from "../core/scene/SceneNode";
import type {
  CameraShot,
  CameraShotRigOptions,
  MotionPreset,
  SavedTimelineClip,
  TimelineAnimation,
  TimelineDockItem,
} from "./studioTypes";
import {
  applyCameraShotOrder as applyCameraShotOrderData,
  clearTimelineState,
  createTimelineAnimation,
  getCameraShotAnimations as getCameraShotAnimationsFromState,
  getCameraShotTimelineItems as getCameraShotTimelineItemsFromState,
  getObjectMotionTimelineItems as getObjectMotionTimelineItemsFromState,
  getTimelineDuration as getTimelineDurationFromState,
  resetTimelineAnimations,
  serializeTimeline as serializeTimelineData,
  updateTimelineAnimations,
} from "./studioTimeline";

type TimelineDockLike = {
  refresh: (items: TimelineDockItem[], duration: number) => void;
  setPlayhead: (position: number, duration: number) => void;
};

export type TimelineControllerDependencies = {
  setStatus: (message: string) => void;
  refreshProductionShots: (shots: TimelineDockItem[]) => void;
  renderTheatreShotPane: () => void;
  getTimelineDock: () => TimelineDockLike | null;
  applyCameraShot: (
    shot: CameraShot,
    duration: number,
    options?: {
      cameraName?: string;
      delay?: number;
      silent?: boolean;
      targetName?: string;
      orbitDegrees?: number;
      distanceMultiplier?: number;
      heightMultiplier?: number;
      fov?: number;
    },
  ) => void;
  applyObjectMotion: (
    preset: MotionPreset,
    duration: number,
    options?: {
      delay?: number;
      loop?: boolean;
      silent?: boolean;
      targetNode?: SceneNode | null;
    },
  ) => void;
  findSceneNodeByName: (name?: string) => SceneNode | null;
};

export function createTimelineController({
  setStatus,
  refreshProductionShots,
  renderTheatreShotPane,
  getTimelineDock,
  applyCameraShot,
  applyObjectMotion,
  findSceneNodeByName,
}: TimelineControllerDependencies) {
  const activeAnimations: TimelineAnimation[] = [];

  let timelinePlaying = true;
  let stopRecordingWhenTimelineEnds = false;
  let timelinePosition = 0;
  let cameraShotCursor = 0;
  let activeShotId: string | null = null;

  function getAnimations() {
    return activeAnimations;
  }

  function isPlaying() {
    return timelinePlaying;
  }

  function setPlaying(value: boolean) {
    timelinePlaying = value;
  }

  function shouldStopRecordingWhenTimelineEnds() {
    return stopRecordingWhenTimelineEnds;
  }

  function setStopRecordingWhenTimelineEnds(value: boolean) {
    stopRecordingWhenTimelineEnds = value;
  }

  function getPosition() {
    return timelinePosition;
  }

  function setPosition(value: number) {
    timelinePosition = Math.max(value, 0);
  }

  function getActiveShotId() {
    return activeShotId;
  }

  function setActiveShotId(value: string | null) {
    activeShotId = value;
  }

  function getCameraShotCursor() {
    return cameraShotCursor;
  }

  function setCameraShotCursor(value: number) {
    cameraShotCursor = Math.max(value, 0);
  }

  function getCameraShotAnimations() {
    return getCameraShotAnimationsFromState(activeAnimations);
  }

  function getTimelineDuration() {
    return getTimelineDurationFromState({
      cameraShotCursor,
      activeAnimations,
    });
  }

  function getCameraShotTimelineItems(): TimelineDockItem[] {
    return getCameraShotTimelineItemsFromState({
      shots: getCameraShotAnimations(),
      activeShotId,
    });
  }

  function getObjectMotionTimelineItems(): TimelineDockItem[] {
    return getObjectMotionTimelineItemsFromState(activeAnimations);
  }

  function getAllTimelineItems(): TimelineDockItem[] {
    return [
      ...getCameraShotTimelineItems(),
      ...getObjectMotionTimelineItems(),
    ].sort((first, second) => first.start - second.start);
  }

  function refresh() {
    const shots = getCameraShotTimelineItems();
    refreshProductionShots(shots);
    getTimelineDock()?.refresh(getAllTimelineItems(), getTimelineDuration());
    renderTheatreShotPane();
  }

  function syncPlayhead(fallbackDuration = 10) {
    getTimelineDock()?.setPlayhead(
      timelinePosition,
      getTimelineDuration() || fallbackDuration,
    );
  }

  function serializeTimeline(): SavedTimelineClip[] {
    return serializeTimelineData(activeAnimations);
  }

  function addTimelineAnimation(
    animation: Omit<
      TimelineAnimation,
      "id" | "elapsed" | "started" | "finished"
    >,
  ) {
    const nextAnimation = createTimelineAnimation(animation);
    activeAnimations.push(nextAnimation);
    timelinePlaying = true;
    refresh();
    return nextAnimation;
  }

  function clearTimeline() {
    const nextState = clearTimelineState(activeAnimations);

    cameraShotCursor = nextState.cameraShotCursor;
    timelinePosition = nextState.timelinePosition;
    timelinePlaying = nextState.timelinePlaying;
    activeShotId = nextState.activeShotId;

    refresh();
    getTimelineDock()?.setPlayhead(0, 10);
  }

  function applyCameraShotOrder(shots: TimelineAnimation[]) {
    const nextState = applyCameraShotOrderData(shots);

    cameraShotCursor = nextState.cameraShotCursor;
    timelinePosition = nextState.timelinePosition;

    refresh();
  }

  function rebuildCameraShotTiming() {
    applyCameraShotOrder(getCameraShotAnimations());
  }

  function removeCameraShot(shotId: string) {
    const index = activeAnimations.findIndex(
      (animation) => animation.id === shotId,
    );

    if (index < 0) return;

    activeAnimations.splice(index, 1);

    if (activeShotId === shotId) {
      activeShotId = getCameraShotAnimations()[0]?.id ?? null;
    }

    rebuildCameraShotTiming();
    setStatus("Camera shot removed");
  }

  function moveCameraShot(shotId: string, direction: -1 | 1) {
    const shots = getCameraShotAnimations();
    const index = shots.findIndex((animation) => animation.id === shotId);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= shots.length) return;

    [shots[index], shots[targetIndex]] = [shots[targetIndex], shots[index]];

    applyCameraShotOrder(shots);
    setStatus("Camera shot order updated");
  }

  function selectCameraShot(shotId: string) {
    if (!getCameraShotAnimations().some((shot) => shot.id === shotId)) return;

    activeShotId = shotId;

    refresh();
    setStatus("Shot selected");
  }

  function duplicateCameraShot(shotId: string) {
    const source = getCameraShotAnimations().find((shot) => shot.id === shotId);

    if (!source || source.kind !== "camera-shot" || !source.metadata?.shot) {
      setStatus("Select a camera shot first");
      return;
    }

    applyCameraShot(source.metadata.shot as CameraShot, source.duration, {
      cameraName: source.metadata.cameraLabel ?? "Main View",
      targetName:
        source.metadata.targetLabel &&
        source.metadata.targetLabel !== "Scene center"
          ? source.metadata.targetLabel
          : undefined,
      orbitDegrees: source.orbitDegrees,
      distanceMultiplier: source.distanceMultiplier,
      heightMultiplier: source.heightMultiplier,
      fov: source.fov,
      silent: true,
    });

    const shots = getCameraShotAnimations();
    const duplicatedShot = shots[shots.length - 1];

    if (duplicatedShot) {
      duplicatedShot.name = `${source.name.replace(/ Copy( \d+)?$/, "")} Copy`;
      activeShotId = duplicatedShot.id;
    }

    rebuildCameraShotTiming();
    refresh();
    setStatus("Camera shot duplicated");
  }

  function updateCameraShotDuration(shotId: string, duration: number) {
    const shot = getCameraShotAnimations().find(
      (animation) => animation.id === shotId,
    );

    if (!shot) return;

    shot.duration = Math.max(duration, 0.5);

    rebuildCameraShotTiming();
    setStatus("Shot duration updated");
  }

  function updateCameraShotRigOptions(
    shotId: string,
    options: CameraShotRigOptions,
  ) {
    const shot = getCameraShotAnimations().find(
      (animation) => animation.id === shotId,
    );

    if (!shot) return;

    shot.orbitDegrees = options.orbitDegrees;
    shot.distanceMultiplier = options.distanceMultiplier;
    shot.heightMultiplier = options.heightMultiplier;
    shot.fov = options.fov;

    refresh();
    setStatus("Shot parameters updated");
  }

  function playTimeline() {
    const cameraShots = getCameraShotAnimations();

    if (cameraShots.length > 0 && cameraShots.every((shot) => shot.finished)) {
      rewindTimeline();
    }

    timelinePlaying = true;
    setStatus("Timeline playing");
  }

  function rewindTimeline() {
    resetTimelineAnimations(activeAnimations);

    timelinePosition = 0;
    syncPlayhead(getTimelineDuration());
    timelinePlaying = true;
  }

  function pauseTimeline() {
    timelinePlaying = false;
    setStatus("Timeline paused");
  }

  function stopTimeline() {
    stopRecordingWhenTimelineEnds = false;
    clearTimeline();
    setStatus("Timeline stopped");
  }

  function update(delta: number) {
    if (!timelinePlaying) {
      syncPlayhead();
      return false;
    }

    const timelineDuration = getTimelineDuration();

    timelinePosition =
      timelineDuration > 0
        ? Math.min(timelinePosition + delta, timelineDuration)
        : 0;

    updateTimelineAnimations({
      activeAnimations,
      delta,
    });

    syncPlayhead();

    return (
      stopRecordingWhenTimelineEnds &&
      timelineDuration > 0 &&
      timelinePosition >= timelineDuration
    );
  }

  function markRecordingStopHandled() {
    stopRecordingWhenTimelineEnds = false;
  }

  function restoreTimeline(timeline: SavedTimelineClip[] | undefined) {
    clearTimeline();

    if (!timeline || timeline.length === 0) return;

    timeline
      .slice()
      .sort((first, second) => first.start - second.start)
      .forEach((clip) => {
        if (clip.kind === "camera-shot") {
          applyCameraShot(clip.shot, clip.duration, {
            cameraName: clip.cameraName,
            delay: clip.start,
            silent: true,
            targetName: clip.targetName,
          });
          return;
        }

        const targetNode = findSceneNodeByName(clip.targetName);
        if (!targetNode) return;

        applyObjectMotion(clip.preset, clip.duration, {
          delay: clip.start,
          loop: clip.loop,
          silent: true,
          targetNode,
        });
      });

    timelinePlaying = false;
    rewindTimeline();
    timelinePlaying = false;
    refresh();
  }

  return {
    getAnimations,
    isPlaying,
    setPlaying,
    shouldStopRecordingWhenTimelineEnds,
    setStopRecordingWhenTimelineEnds,
    getPosition,
    setPosition,
    getActiveShotId,
    setActiveShotId,
    getCameraShotCursor,
    setCameraShotCursor,
    getCameraShotAnimations,
    getTimelineDuration,
    getCameraShotTimelineItems,
    getObjectMotionTimelineItems,
    getAllTimelineItems,
    refresh,
    syncPlayhead,
    serializeTimeline,
    addTimelineAnimation,
    clearTimeline,
    applyCameraShotOrder,
    rebuildCameraShotTiming,
    removeCameraShot,
    moveCameraShot,
    selectCameraShot,
    duplicateCameraShot,
    updateCameraShotDuration,
    updateCameraShotRigOptions,
    playTimeline,
    rewindTimeline,
    pauseTimeline,
    stopTimeline,
    update,
    markRecordingStopHandled,
    restoreTimeline,
  };
}

export type TimelineController = ReturnType<typeof createTimelineController>;
