import type {
  CameraShot,
  MotionPreset,
  SavedTimelineClip,
  TimelineAnimation,
  TimelineDockItem,
} from "./studioTypes";

export function createTimelineAnimation(
  animation: Omit<
    TimelineAnimation,
    "id" | "elapsed" | "started" | "finished"
  >,
): TimelineAnimation {
  return {
    ...animation,
    id: crypto.randomUUID(),
    elapsed: 0,
    started: false,
    finished: false,
  };
}

export function getCameraShotAnimations(
  activeAnimations: TimelineAnimation[],
) {
  return activeAnimations
    .filter((animation) => animation.kind === "camera-shot")
    .sort((first, second) => first.delay - second.delay);
}

export function duplicateCameraShot({
  shots,
  shotId,
}: {
  shots: TimelineAnimation[];
  shotId: string;
}) {
  const sourceIndex = shots.findIndex((shot) => shot.id === shotId);

  if (sourceIndex < 0) {
    return {
      duplicatedShotId: null as string | null,
      cameraShotCursor: shots.reduce(
        (cursor, shot) => Math.max(cursor, shot.delay + shot.duration),
        0,
      ),
      timelinePosition: 0,
    };
  }

  const source = shots[sourceIndex];

  const duplicatedShot: TimelineAnimation = {
    ...source,
    id: crypto.randomUUID(),
    name: `${source.name} Copy`,
    elapsed: 0,
    started: false,
    finished: false,
    metadata: {
      ...source.metadata,
    },
  };

  shots.splice(sourceIndex + 1, 0, duplicatedShot);

  const order = applyCameraShotOrder(shots);

  return {
    duplicatedShotId: duplicatedShot.id,
    cameraShotCursor: order.cameraShotCursor,
    timelinePosition: order.timelinePosition,
  };
}

export function getTimelineDuration({
  cameraShotCursor,
  activeAnimations,
}: {
  cameraShotCursor: number;
  activeAnimations: TimelineAnimation[];
}) {
  return Math.max(
    cameraShotCursor,
    ...activeAnimations
      .filter((animation) => !animation.loop)
      .map((animation) => animation.delay + animation.duration),
    0,
  );
}

export function getCameraShotTimelineItems({
  shots,
  activeShotId,
}: {
  shots: TimelineAnimation[];
  activeShotId: string | null;
}): TimelineDockItem[] {
  return shots.map((animation) => ({
    id: animation.id,
    label: animation.name,
    cameraLabel: animation.metadata?.cameraLabel ?? "Main View",
    targetLabel: animation.metadata?.targetLabel ?? "Scene center",
    duration: animation.duration,
    start: animation.delay,
    kind: "camera-shot",
    active: animation.id === activeShotId,
    orbitDegrees: animation.orbitDegrees,
    distanceMultiplier: animation.distanceMultiplier,
    heightMultiplier: animation.heightMultiplier,
    fov: animation.fov,
  }));
}

export function getObjectMotionTimelineItems(
  activeAnimations: TimelineAnimation[],
): TimelineDockItem[] {
  return activeAnimations
    .filter((animation) => animation.kind === "object-motion")
    .map((animation) => ({
      id: animation.id,
      label: animation.name,
      cameraLabel: "Object",
      targetLabel: animation.metadata?.targetLabel ?? "Motion",
      duration: animation.duration,
      start: animation.delay,
      kind: "object-motion",
    }));
}

export function serializeTimeline(
  activeAnimations: TimelineAnimation[],
): SavedTimelineClip[] {
  return activeAnimations
    .filter(
      (animation) =>
        animation.kind === "camera-shot" ||
        animation.kind === "object-motion",
    )
    .sort((first, second) => first.delay - second.delay)
    .flatMap((animation): SavedTimelineClip[] => {
      if (animation.kind === "camera-shot" && animation.metadata?.shot) {
        return [
          {
            kind: "camera-shot",
            shot: animation.metadata.shot as CameraShot,
            start: animation.delay,
            duration: animation.duration,
            cameraName: animation.metadata.cameraLabel ?? "Main View",
            ...(animation.metadata.targetLabel &&
            animation.metadata.targetLabel !== "Scene center"
              ? { targetName: animation.metadata.targetLabel }
              : {}),
            ...(animation.orbitDegrees
              ? { orbitDegrees: animation.orbitDegrees }
              : {}),
            ...(animation.distanceMultiplier
              ? { distanceMultiplier: animation.distanceMultiplier }
              : {}),
          },
        ];
      }

      if (
        animation.kind === "object-motion" &&
        animation.metadata?.preset &&
        animation.metadata.targetLabel
      ) {
        return [
          {
            kind: "object-motion",
            preset: animation.metadata.preset as MotionPreset,
            start: animation.delay,
            duration: animation.duration,
            targetName: animation.metadata.targetLabel,
            loop: animation.loop,
          },
        ];
      }

      return [];
    });
}

export function clearTimelineState(activeAnimations: TimelineAnimation[]) {
  activeAnimations.splice(0, activeAnimations.length);

  return {
    cameraShotCursor: 0,
    timelinePosition: 0,
    timelinePlaying: false,
    activeShotId: null as string | null,
  };
}

export function applyCameraShotOrder(shots: TimelineAnimation[]) {
  let cameraShotCursor = 0;

  shots.forEach((shot) => {
    shot.delay = cameraShotCursor;
    shot.elapsed = 0;
    shot.started = false;
    shot.finished = false;
    cameraShotCursor += shot.duration;
  });

  return {
    cameraShotCursor,
    timelinePosition: 0,
  };
}

export function resetTimelineAnimations(
  activeAnimations: TimelineAnimation[],
) {
  activeAnimations.forEach((animation) => {
    animation.elapsed = 0;
    animation.started = false;
    animation.finished = false;
  });
}

export function updateTimelineAnimations({
  activeAnimations,
  delta,
}: {
  activeAnimations: TimelineAnimation[];
  delta: number;
}) {
  for (let index = activeAnimations.length - 1; index >= 0; index -= 1) {
    const animation = activeAnimations[index];

    if (animation.finished) continue;

    animation.elapsed += delta;

    if (animation.elapsed < animation.delay) continue;

    if (!animation.started) {
      animation.started = true;
      animation.start?.();
    }

    const localElapsed = animation.elapsed - animation.delay;
    const progress = Math.min(localElapsed / animation.duration, 1);

    animation.update(progress, delta);

    if (progress >= 1) {
      animation.complete?.();

      if (animation.loop) {
        animation.elapsed = 0;
      } else if (animation.kind === "camera-shot") {
        animation.finished = true;
      } else {
        activeAnimations.splice(index, 1);
      }
    }
  }
}
