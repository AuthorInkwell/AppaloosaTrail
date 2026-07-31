/**
 * Scene stack. Only the top scene updates; drawing starts at the lowest opaque
 * scene so modal popups (random events, confirmations) can sit over the map.
 */

export interface Scene {
  readonly name: string;
  /** When true, the scene below is drawn first. */
  transparent?: boolean;
  /** When true, global single-letter shortcuts are suppressed. */
  capturesText?: boolean;
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
  draw(): void;
}

class SceneStack {
  private stack: Scene[] = [];

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  get depth(): number {
    return this.stack.length;
  }

  push(scene: Scene): void {
    this.stack.push(scene);
    scene.enter?.();
  }

  pop(): void {
    const s = this.stack.pop();
    s?.exit?.();
  }

  /** Replace the top scene. */
  swap(scene: Scene): void {
    this.pop();
    this.push(scene);
  }

  /** Clear everything and start fresh (used by "return to title"). */
  reset(scene: Scene): void {
    while (this.stack.length) this.pop();
    this.push(scene);
  }

  /** Pop until the named scene is on top (no-op if it is not in the stack). */
  popTo(name: string): void {
    if (!this.stack.some((s) => s.name === name)) return;
    while (this.stack.length > 1 && this.top?.name !== name) this.pop();
  }

  has(name: string): boolean {
    return this.stack.some((s) => s.name === name);
  }

  update(dt: number): void {
    this.top?.update(dt);
  }

  draw(): void {
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start]?.transparent) start--;
    for (let i = start; i < this.stack.length; i++) this.stack[i]!.draw();
  }
}

export const scenes = new SceneStack();
