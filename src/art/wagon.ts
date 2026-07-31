/** Composite drawing for the wagon and its team, including rolling wheels. */

import { C, Color, screen, spriteSize } from "../engine/screen";
import {
  PONY,
  PONY_HORNED,
  PONY_PACK,
  PONY_WINGED,
  TEAM_MEMBER,
  WAGON_BODY,
  WHEEL_BIG_A,
  WHEEL_BIG_B,
  WHEEL_SMALL_A,
  WHEEL_SMALL_B,
} from "./sprites";

export interface CoatColors {
  coat: Color;
  mane: Color;
}

/** A small spread of pastel-ish coats within the EGA palette. */
export const COATS: CoatColors[] = [
  { coat: C.PINK, mane: C.MAGENTA },
  { coat: C.BRIGHTCYAN, mane: C.BRIGHTBLUE },
  { coat: C.YELLOW, mane: C.BROWN },
  { coat: C.WHITE, mane: C.PINK },
  { coat: C.BRIGHTGREEN, mane: C.GREEN },
  { coat: C.BROWN, mane: C.YELLOW },
  { coat: C.GREY, mane: C.BLUE },
  { coat: C.BRIGHTRED, mane: C.YELLOW },
];

export function coatFor(index: number): CoatColors {
  return COATS[index % COATS.length]!;
}

export function ponyRemap(index: number): Record<string, Color> {
  const c = coatFor(index);
  return { C: c.coat, M: c.mane, H: C.DARKGREY, E: C.BLACK };
}

export type PonyKind = "plain" | "winged" | "horned" | "pack";

export function ponySprite(kind: PonyKind) {
  switch (kind) {
    case "winged":
      return PONY_WINGED;
    case "horned":
      return PONY_HORNED;
    case "pack":
      return PONY_PACK;
    default:
      return PONY;
  }
}

export function drawPony(
  x: number,
  baseY: number,
  index: number,
  kind: PonyKind = "plain",
  opts: { flipX?: boolean; bob?: number } = {},
): void {
  const sprite = ponySprite(kind);
  const { h } = spriteSize(sprite);
  screen.sprite(sprite, x, baseY - h + (opts.bob ?? 0), { remap: ponyRemap(index), flipX: opts.flipX });
}

const TEAM_HAT_COLORS = [C.YELLOW, C.BRIGHTRED, C.BRIGHTGREEN, C.BRIGHTCYAN, C.WHITE, C.PINK];
const TEAM_HIDES = [C.BROWN, C.GREY, C.DARKGREY, C.BROWN, C.YELLOW, C.GREY];

/**
 * Draws the team ahead of the wagon. Returns the x of the leftmost hoof so
 * callers know how wide the whole rig ended up.
 */
export function drawTeam(rightX: number, baseY: number, count: number, frame: number): number {
  const { w } = spriteSize(TEAM_MEMBER);
  const spacing = w - 3;
  let x = rightX;
  for (let i = 0; i < count; i++) {
    x -= spacing;
    const bob = Math.floor(Math.sin((frame * 0.22 + i * 1.7) % (Math.PI * 2)) * 1.4);
    screen.sprite(TEAM_MEMBER, x, baseY - 16 + bob, {
      remap: {
        C: TEAM_HIDES[i % TEAM_HIDES.length]!,
        A: TEAM_HAT_COLORS[i % TEAM_HAT_COLORS.length]!,
        K: i % 2 === 0 ? C.RED : C.BLUE,
        H: C.DARKGREY,
        "0": C.BLACK,
      },
    });
  }
  return x;
}

/**
 * Draws the wagon with its front-right corner near `x`. `frame` drives the
 * wheel animation; `jolt` lifts the body a pixel for rough ground.
 */
export function drawWagon(x: number, baseY: number, frame: number, jolt = 0): void {
  const body = spriteSize(WAGON_BODY);
  const bodyY = baseY - 9 - body.h + jolt;
  const rolling = Math.floor(frame / 4) % 2 === 0;
  const bigWheel = rolling ? WHEEL_BIG_A : WHEEL_BIG_B;
  const smallWheel = rolling ? WHEEL_SMALL_A : WHEEL_SMALL_B;

  // Shadow first so the wheels sit in it.
  screen.ellipse(x + body.w / 2, baseY + 1, body.w / 2 - 1, 2, C.DARKGREY);
  screen.sprite(WAGON_BODY, x, bodyY);
  screen.sprite(bigWheel, x + 4, baseY - 9);
  screen.sprite(smallWheel, x + body.w - 12, baseY - 8);
}

/** Full rig: team, then wagon, drawn so the wagon's rear sits at `x`. */
export function drawRig(x: number, baseY: number, team: number, frame: number, jolt = 0): void {
  const body = spriteSize(WAGON_BODY);
  drawWagon(x, baseY, frame, jolt);
  if (team > 0) drawTeam(x - 2, baseY, team, frame);
  else {
    // With no team the ponies pull the wagon themselves.
    drawPony(x - 18, baseY, 0, "plain", { bob: Math.floor(Math.sin(frame * 0.3) * 1.2) });
    drawPony(x - 32, baseY, 1, "plain", { bob: Math.floor(Math.sin(frame * 0.3 + 1) * 1.2) });
  }
  void body;
}

export function rigWidth(team: number): number {
  const body = spriteSize(WAGON_BODY);
  const member = spriteSize(TEAM_MEMBER);
  return body.w + Math.max(2, team) * (member.w - 3);
}
