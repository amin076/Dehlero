export type RecordingAspect =
  | "shorts"
  | "landscape"
  | "square"
  | "fourFive";

export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SafeAreaRect extends Rect2D {
  aspect: RecordingAspect;
  ratio: number;
}

export const RECORDING_ASPECT_RATIOS: Record<RecordingAspect, number> = {
  shorts: 9 / 16,
  landscape: 16 / 9,
  square: 1,
  fourFive: 4 / 5,
};

export function fitAspect(
  viewportWidth: number,
  viewportHeight: number,
  targetRatio: number,
): Rect2D {
  const safeViewportWidth = Math.max(1, viewportWidth);
  const safeViewportHeight = Math.max(1, viewportHeight);
  const safeTargetRatio = Math.max(0.001, targetRatio);

  const viewportRatio = safeViewportWidth / safeViewportHeight;

  if (viewportRatio > safeTargetRatio) {
    const height = safeViewportHeight;
    const width = height * safeTargetRatio;

    return {
      x: (safeViewportWidth - width) / 2,
      y: 0,
      width,
      height,
    };
  }

  const width = safeViewportWidth;
  const height = width / safeTargetRatio;

  return {
    x: 0,
    y: (safeViewportHeight - height) / 2,
    width,
    height,
  };
}

export function getSafeAreaRect(
  viewportWidth: number,
  viewportHeight: number,
  aspect: RecordingAspect,
): SafeAreaRect {
  const ratio = RECORDING_ASPECT_RATIOS[aspect];
  const rect = fitAspect(viewportWidth, viewportHeight, ratio);

  return {
    ...rect,
    aspect,
    ratio,
  };
}

export function insetRect(rect: Rect2D, insetPercent: number): Rect2D {
  const insetX = rect.width * insetPercent;
  const insetY = rect.height * insetPercent;

  return {
    x: rect.x + insetX,
    y: rect.y + insetY,
    width: Math.max(0, rect.width - insetX * 2),
    height: Math.max(0, rect.height - insetY * 2),
  };
}

export function rectToCssVars(rect: Rect2D) {
  return {
    "--safe-x": `${rect.x}px`,
    "--safe-y": `${rect.y}px`,
    "--safe-w": `${rect.width}px`,
    "--safe-h": `${rect.height}px`,
  } as Record<string, string>;
}
