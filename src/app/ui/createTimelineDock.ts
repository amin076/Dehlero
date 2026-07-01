import * as THREE from "three";
import type { TimelineDockItem } from "../studioTypes";

export function createTimelineDock({
  root,
  playTimeline,
  pauseTimeline,
  stopTimeline,
}: {
  root: HTMLElement;
  playTimeline: () => void;
  pauseTimeline: () => void;
  stopTimeline: () => void;
  restoreTheatreStudio?: () => void;
}) {
  const dock = document.createElement("aside");
  dock.className = "timeline-dock";

  dock.innerHTML = `
    <div class="timeline-dock-header">
      <div>
        <div class="timeline-dock-title">Shot Sequence</div>
        <div id="timeline-dock-status" class="timeline-dock-status">No clips yet</div>
      </div>

      <div id="timeline-time" class="timeline-time">0.00s</div>

      <div class="timeline-dock-controls">
        <button id="dock-play" type="button">Play</button>
        <button id="dock-pause" type="button">Pause</button>
        <button id="dock-stop" type="button">Stop</button>
      </div>
    </div>

    <div class="timeline-dock-body">
      <div class="timeline-ruler" id="timeline-ruler"></div>

      <div class="timeline-tracks" id="timeline-tracks">
        <div class="timeline-playhead" id="timeline-playhead"></div>

        <div class="timeline-track-row">
          <div class="timeline-track-label">Camera Shots</div>
          <div class="timeline-track" data-track="camera-shot">
            <div class="timeline-empty">Add camera shots to build a sequence</div>
          </div>
        </div>

        <div class="timeline-track-row">
          <div class="timeline-track-label">Object Motion</div>
          <div class="timeline-track" data-track="object-motion">
            <div class="timeline-empty">Select object and add motion</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const status = dock.querySelector<HTMLDivElement>("#timeline-dock-status")!;
  const timeReadout = dock.querySelector<HTMLDivElement>("#timeline-time")!;
  const ruler = dock.querySelector<HTMLDivElement>("#timeline-ruler")!;
  const tracks = dock.querySelector<HTMLDivElement>("#timeline-tracks")!;
  const playhead = dock.querySelector<HTMLDivElement>("#timeline-playhead")!;

  let timelineDuration = 10;

  dock.querySelector<HTMLButtonElement>("#dock-play")!.onclick = playTimeline;
  dock.querySelector<HTMLButtonElement>("#dock-pause")!.onclick = pauseTimeline;
  dock.querySelector<HTMLButtonElement>("#dock-stop")!.onclick = stopTimeline;

  function renderRuler(totalDuration: number) {
    ruler.innerHTML = "";

    const tickCount = Math.max(Math.ceil(totalDuration), 1);

    for (let second = 0; second <= tickCount; second += 1) {
      const tick = document.createElement("div");
      tick.className = "timeline-tick";
      tick.style.left = `${(second / tickCount) * 100}%`;
      tick.textContent = `${second}s`;
      ruler.appendChild(tick);
    }
  }

  function setPlayhead(position: number, totalDuration = timelineDuration) {
    const normalizedTotal = Math.max(totalDuration, 0.1);
    const percent =
      THREE.MathUtils.clamp(position / normalizedTotal, 0, 1) * 100;
    const trackOffset = 98;

    playhead.style.left = `calc(${trackOffset}px + ${percent}% - ${
      (percent / 100) * trackOffset
    }px)`;

    timeReadout.textContent = `${position.toFixed(2)}s`;
  }

  root.appendChild(dock);

  return {
    refresh(items: TimelineDockItem[], totalDuration: number) {
      timelineDuration = Math.max(totalDuration, 10);
      renderRuler(timelineDuration);

      tracks.querySelectorAll(".timeline-track").forEach((track) => {
        track
          .querySelectorAll(".timeline-clip, .timeline-empty")
          .forEach((node) => {
            node.remove();
          });
      });

      if (items.length === 0) {
        tracks
          .querySelectorAll<HTMLDivElement>(".timeline-track")
          .forEach((track) => {
            const empty = document.createElement("div");
            empty.className = "timeline-empty";

            empty.textContent =
              track.dataset.track === "camera-shot"
                ? "Add camera shots to build a sequence"
                : "Select object and add motion";

            track.appendChild(empty);
          });

        status.textContent = "No clips yet";
        setPlayhead(0);
        return;
      }

      items.forEach((item) => {
        const track = tracks.querySelector<HTMLDivElement>(
          `.timeline-track[data-track="${item.kind}"]`,
        );

        if (!track) return;

        const clip = document.createElement("div");
        clip.className = `timeline-clip timeline-clip-${item.kind}`;
        clip.style.left = `${(item.start / timelineDuration) * 100}%`;
        clip.style.width = `${Math.max(
          (item.duration / timelineDuration) * 100,
          4,
        )}%`;
        clip.title = `${item.label} | ${item.cameraLabel} -> ${item.targetLabel}`;

        const label = document.createElement("strong");
        label.textContent = item.label;

        const meta = document.createElement("span");
        meta.textContent = `${item.start}s - ${item.start + item.duration}s`;

        clip.append(label, meta);
        track.appendChild(clip);
      });

      tracks
        .querySelectorAll<HTMLDivElement>(".timeline-track")
        .forEach((track) => {
          if (track.querySelector(".timeline-clip")) return;

          const empty = document.createElement("div");
          empty.className = "timeline-empty";

          empty.textContent =
            track.dataset.track === "camera-shot"
              ? "Add camera shots to build a sequence"
              : "Select object and add motion";

          track.appendChild(empty);
        });

      status.textContent = `${items.length} clip${
        items.length === 1 ? "" : "s"
      } | ${totalDuration}s`;

      setPlayhead(0);
    },

    setPlayhead,
  };
}