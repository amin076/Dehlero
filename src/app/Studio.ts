import type { StudioContext } from "./StudioContext";

export class Studio {
  public readonly context: StudioContext;

  constructor(context: StudioContext) {
    this.context = context;
  }

  initialize() {
    // Future home for manager startup.
  }

  dispose() {
    // Future home for cleanup.
  }
}
