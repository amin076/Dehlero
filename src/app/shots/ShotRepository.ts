import type { ShotDefinition } from "./ShotTypes";

export class ShotRepository {
  private shots: ShotDefinition[] = [];

  getAll() {
    return this.shots;
  }

  getById(id: string) {
    return this.shots.find((shot) => shot.id === id);
  }

  add(shot: ShotDefinition) {
    this.shots.push(shot);
  }

  remove(id: string) {
    this.shots = this.shots.filter((shot) => shot.id !== id);
  }

  duplicate(id: string) {
    const shot = this.getById(id);
    if (!shot) return null;

    const clone: ShotDefinition = {
      ...structuredClone(shot),
      id: `shot-${crypto.randomUUID()}`,
      name: `${shot.name} Copy`,
    };

    this.shots.push(clone);

    return clone;
  }

  move(id: string, direction: -1 | 1) {
    const index = this.shots.findIndex((s) => s.id === id);

    if (index < 0) return;

    const next = index + direction;

    if (next < 0 || next >= this.shots.length) return;

    [this.shots[index], this.shots[next]] = [
      this.shots[next],
      this.shots[index],
    ];
  }

  update(id: string, updater: (shot: ShotDefinition) => void) {
    const shot = this.getById(id);
    if (!shot) return;

    updater(shot);
  }

  clear() {
    this.shots = [];
  }
}
