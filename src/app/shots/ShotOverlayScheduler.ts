import { overlayService } from "../overlay/OverlayService";
import type { ShotOverlayCue } from "./ShotOverlayTypes";

export class ShotOverlayScheduler {
  private timeouts: number[] = [];

  play(overlays: ShotOverlayCue[]) {
    this.stop();

    for (const cue of overlays) {
      if (!cue.enabled) continue;

      switch (cue.kind) {
        case "title":
          this.scheduleTitle(cue);
          break;
      }
    }
  }

  stop() {
    for (const id of this.timeouts) {
      window.clearTimeout(id);
    }

    this.timeouts.length = 0;
    overlayService.hideTitle();
  }

  private scheduleTitle(
    cue: Extract<ShotOverlayCue, { kind: "title" }>,
  ) {
    const showId = window.setTimeout(() => {
      overlayService.showTitle({
        eyebrow: cue.eyebrow,
        title: cue.title,
        subtitle: cue.subtitle,
        durationMs: cue.timing.duration * 1000,
        preset: cue.variant,
        accentColor: cue.accentColor,
        textColor: cue.textColor,
        titleSize: cue.titleSize,
        subtitleSize: cue.subtitleSize,
        eyebrowSize: cue.eyebrowSize,
        maxWidth: cue.maxWidth,
        shadowStrength: cue.shadowStrength,
        glow: cue.glow,
      });
    }, cue.timing.startTime * 1000);

    this.timeouts.push(showId);

    const hideId = window.setTimeout(() => {
      overlayService.hideTitle();
    }, (cue.timing.startTime + cue.timing.duration) * 1000);

    this.timeouts.push(hideId);
  }
}