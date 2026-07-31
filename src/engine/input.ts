/**
 * Keyboard input, sampled once per frame. The original game was driven entirely
 * from the number row and RETURN, so that is the primary interaction model;
 * arrow keys are the modern convenience layer.
 */

const PREVENT = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "Enter",
  "Backspace",
  "Tab",
  "Slash",
  "Quote",
]);

class Input {
  private downKeys = new Set<string>();
  private pressedKeys = new Set<string>();
  private queuedPress = new Set<string>();
  private queuedText = "";
  private frameText = "";
  private gestureListeners: Array<() => void> = [];
  private gestureFired = false;

  attach(target: Window = window): void {
    target.addEventListener("keydown", (e) => this.onKeyDown(e));
    target.addEventListener("keyup", (e) => this.onKeyUp(e));
    target.addEventListener("blur", () => {
      this.downKeys.clear();
    });
  }

  /** Runs once on the first key press, so audio can start inside a gesture. */
  onFirstGesture(fn: () => void): void {
    if (this.gestureFired) fn();
    else this.gestureListeners.push(fn);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!this.gestureFired) {
      this.gestureFired = true;
      for (const fn of this.gestureListeners) fn();
      this.gestureListeners = [];
    }
    const names = this.namesFor(e);
    const isRepeat = e.repeat;
    for (const n of names) {
      if (!isRepeat) this.queuedPress.add(n);
      this.downKeys.add(n);
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) this.queuedText += e.key;
    else if (e.key === "Backspace") this.queuedText += "\b";
  }

  private onKeyUp(e: KeyboardEvent): void {
    for (const n of this.namesFor(e)) this.downKeys.delete(n);
  }

  private namesFor(e: KeyboardEvent): string[] {
    const names: string[] = [e.code];
    if (e.key.length === 1) names.push(e.key.toLowerCase());
    else names.push(e.key);
    return names;
  }

  beginFrame(): void {
    this.pressedKeys = this.queuedPress;
    this.queuedPress = new Set();
    this.frameText = this.queuedText;
    this.queuedText = "";
  }

  down(key: string): boolean {
    return this.downKeys.has(key);
  }

  pressed(...keys: string[]): boolean {
    return keys.some((k) => this.pressedKeys.has(k));
  }

  /** True for RETURN / SPACE, the universal "go ahead" in the original. */
  confirm(): boolean {
    return this.pressed("Enter", "NumpadEnter", "Space", " ");
  }

  cancel(): boolean {
    return this.pressed("Escape");
  }

  /** Digit that was pressed this frame, or null. */
  digit(): number | null {
    for (let n = 0; n <= 9; n++) {
      if (this.pressed(String(n), `Digit${n}`, `Numpad${n}`)) return n;
    }
    return null;
  }

  anyPressed(): boolean {
    return this.pressedKeys.size > 0;
  }

  /** Printable characters typed this frame; "\b" marks a backspace. */
  text(): string {
    return this.frameText;
  }

  axisX(): number {
    return (
      (this.down("ArrowRight") || this.down("KeyD") ? 1 : 0) - (this.down("ArrowLeft") || this.down("KeyA") ? 1 : 0)
    );
  }

  axisY(): number {
    return (this.down("ArrowDown") || this.down("KeyS") ? 1 : 0) - (this.down("ArrowUp") || this.down("KeyW") ? 1 : 0);
  }
}

export const input = new Input();
