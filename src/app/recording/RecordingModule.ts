import type { StudioContext } from "../StudioContext";
import type { StudioModule } from "../StudioModule";
import { RecordingManager } from "./RecordingManager";

export class RecordingModule implements StudioModule {
  readonly name = "recording";

  readonly manager: RecordingManager;

  constructor(context: StudioContext) {
    this.manager = new RecordingManager(
      context.renderer,
      context.resize,
      context.setStatus,
    );
  }

  initialize() {
    // RecordingManager is ready after construction.
  }

  dispose() {
    if (this.manager.isRecording()) {
      this.manager.stop();
    }
  }
}
