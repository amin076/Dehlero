import type { StudioContext } from "./StudioContext";
import type { StudioModule } from "./StudioModule";

export class Studio {
  public readonly context: StudioContext;

  private modules: StudioModule[] = [];

  constructor(context: StudioContext) {
    this.context = context;
  }

  register(module: StudioModule) {
    this.modules.push(module);
    module.initialize?.(this.context);
  }

  update(delta: number) {
    this.modules.forEach((module) => {
      module.update?.(delta);
    });
  }

  dispose() {
    [...this.modules].reverse().forEach((module) => {
      module.dispose?.();
    });

    this.modules = [];
  }
}