import type { EaseType } from "./ShotTypes";

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function ease(type: EaseType, t: number): number {
  const x = clamp01(t);

  switch (type) {
    case "linear":
      return x;

    case "easeIn":
      return x * x;

    case "easeOut":
      return 1 - (1 - x) * (1 - x);

    case "easeInOut":
      return x < 0.5
        ? 2 * x * x
        : 1 - Math.pow(-2 * x + 2, 2) / 2;

    case "smoothstep":
      return x * x * (3 - 2 * x);

    case "smootherstep":
      return x * x * x * (x * (x * 6 - 15) + 10);

    default:
      return x;
  }
}

export function pulse(t: number, speed = 1): number {
  return 0.5 + 0.5 * Math.sin(t * speed * Math.PI * 2);
}

export function damp(
  current: number,
  target: number,
  lambda: number,
  delta: number,
): number {
  return lerp(current, target, 1 - Math.exp(-lambda * delta));
}

export function remap01(value: number, start: number, end: number): number {
  if (start === end) return 0;
  return clamp01((value - start) / (end - start));
}

export function pingPong01(t: number): number {
  const x = t % 2;
  return x < 1 ? x : 2 - x;
}

export function cinematicKick(t: number): number {
  const x = clamp01(t);

  if (x < 0.18) {
    return ease("easeIn", x / 0.18) * 0.18;
  }

  if (x < 0.34) {
    return 0.18 + ease("easeOut", (x - 0.18) / 0.16) * 0.62;
  }

  return 0.8 + ease("smootherstep", (x - 0.34) / 0.66) * 0.2;
}

export function dramaticHold(t: number): number {
  const x = clamp01(t);

  if (x < 0.7) {
    return ease("smoothstep", x / 0.7) * 0.75;
  }

  return 0.75 + ease("easeOut", (x - 0.7) / 0.3) * 0.25;
}