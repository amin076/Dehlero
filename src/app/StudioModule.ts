import type { StudioContext } from "./StudioContext";

export interface StudioModule {
  readonly name: string;

  initialize?(context: StudioContext): void;

  update?(delta: number): void;

  dispose?(): void;
}
