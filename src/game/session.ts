/** The single in-progress run, plus the RNG the systems draw from. */

import { Rng } from "../engine/rng";
import { GameState } from "./state";

class Session {
  game: GameState | null = null;
  rng = new Rng();

  start(g: GameState): void {
    this.game = g;
    this.rng = new Rng((g.seed + g.day * 104729) >>> 0);
  }

  get current(): GameState {
    if (!this.game) throw new Error("No game in progress");
    return this.game;
  }

  clear(): void {
    this.game = null;
  }
}

export const session = new Session();
