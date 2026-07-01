export type ShotOverlayKind =
  | "title"
  | "lower-third"
  | "watermark"
  | "subtitle";

export type ShotOverlayPlacement =
  | "safe-center"
  | "safe-top"
  | "safe-bottom"
  | "lower-third";

export type ShotOverlayVariant =
  | "trailer"
  | "documentary"
  | "minimal"
  | "science"
  | "broadcast";

export interface ShotOverlayTiming {
  startTime: number;
  duration: number;
  fadeInMs?: number;
  fadeOutMs?: number;
}

export interface BaseShotOverlayCue {
  id: string;
  enabled: boolean;
  kind: ShotOverlayKind;
  placement: ShotOverlayPlacement;
  variant: ShotOverlayVariant;
  timing: ShotOverlayTiming;
}

export interface ShotTitleCue extends BaseShotOverlayCue {
  kind: "title";
  eyebrow?: string;
  title: string;
  subtitle?: string;
  accentColor?: string;
  textColor?: string;
  titleSize?: number;
  subtitleSize?: number;
  eyebrowSize?: number;
  maxWidth?: number;
  shadowStrength?: number;
  glow?: boolean;
}

export type ShotOverlayCue = ShotTitleCue;

export function createDefaultTitleCue(): ShotTitleCue {
  return {
    id: `title-${crypto.randomUUID()}`,
    enabled: false,
    kind: "title",
    placement: "safe-center",
    variant: "trailer",
    timing: {
      startTime: 0,
      duration: 3.5,
      fadeInMs: 650,
      fadeOutMs: 500,
    },
    eyebrow: "Titan 3026",
    title: "World Cup",
    subtitle: "The first match beyond Earth",
    glow: true,
  };
}