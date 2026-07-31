/**
 * Hand-authored pixel art. Each row is a string of hex palette digits ("."
 * transparent); letters are remap slots so one sprite can be recoloured per
 * character (coat "C", mane "M", hoof "H", eye "E", accessory "A").
 *
 * Everything faces right, which is the direction of travel on screen.
 */

import { C, Sprite } from "../engine/screen";

// ---------------------------------------------------------------------------
// The wagon
// ---------------------------------------------------------------------------

export const WAGON_BODY: Sprite = {
  data: [
    "..........88888888888888..........",
    ".......888ffffffffffffff888.......",
    ".....88ffffffffffffffffffff88.....",
    "....8ffffffffffffffffffffffff8....",
    "....8ffff7ffff7ffff7ffff7ffff8....",
    "....8ffff7ffff7ffff7ffff7ffff8....",
    "....8ffff7ffff7ffff7ffff7ffff8....",
    "....8fff77ff77ff77ff77ff77fff8....",
    "....87777777777777777777777778....",
    "....87777777777777777777777778....",
    "....888888888888888888888888888...",
    "..866666666666666666666666666668..",
    "..866666666666666666666666666668..",
    "..888888888888888888888888888888..",
    "..866666666666666666666666666668..",
    "..888888888888888888888888888888..",
  ],
};

export const WHEEL_BIG_A: Sprite = {
  data: [
    "...666...",
    ".66.6.66.",
    ".6..6..6.",
    "6...6...6",
    "666666666",
    "6...6...6",
    ".6..6..6.",
    ".66.6.66.",
    "...666...",
  ],
};

export const WHEEL_BIG_B: Sprite = {
  data: [
    "...666...",
    ".66...66.",
    ".66...66.",
    "6..6.6..6",
    "6...6...6",
    "6..6.6..6",
    ".66...66.",
    ".66...66.",
    "...666...",
  ],
};

export const WHEEL_SMALL_A: Sprite = {
  data: ["..666..", ".6.6.6.", "6..6..6", "6666666", "6..6..6", ".6.6.6.", "..666.."],
};

export const WHEEL_SMALL_B: Sprite = {
  data: ["..666..", ".66.66.", "6.6.6.6", "6..6..6", "6.6.6.6", ".66.66.", "..666.."],
};

// ---------------------------------------------------------------------------
// The Wagon Team: ox-adjacent draft creatures wearing hats and kerchiefs, so
// they read as hired help rather than livestock.
// ---------------------------------------------------------------------------

export const TEAM_MEMBER: Sprite = {
  data: [
    "..............AAAA..",
    ".............AAAAAA.",
    "..........AAAAAAAAAA",
    "...........7888888..",
    "..........78CCCCCC..",
    ".....88888CCC0CCCC..",
    "...8866CCCCCCCCCCC8.",
    "..8CCCCCCCCCKKCCCC8.",
    ".8CCCCCCCCCCKKC8888.",
    "8CCCCCCCCCCCCCCC....",
    ".8CCCCCCCCCCCCC8....",
    "..8888888888888.....",
    "...CC....CC...CC....",
    "...CC....CC...CC....",
    "...CC....CC...CC....",
    "...HH....HH...HH....",
  ],
  remap: { C: C.BROWN, H: C.DARKGREY, A: C.YELLOW, K: C.RED, "0": C.BLACK },
};

// ---------------------------------------------------------------------------
// Ponies
// ---------------------------------------------------------------------------

export const PONY: Sprite = {
  data: [
    ".........MMM....",
    "........MMMMM...",
    "........MCCCC...",
    ".......MCCECC...",
    "......MMCCCCCC..",
    ".....MMMCCCCC...",
    "...CCCCCCCCCC...",
    "..CCCCCCCCCCC...",
    ".MCCCCCCCCCCC...",
    "MMCCCCCCCCCCC...",
    "MMMCCCCCCCCC....",
    "...CC...CC......",
    "...CC...CC......",
    "...HH...HH......",
  ],
  remap: { C: C.PINK, M: C.MAGENTA, H: C.DARKGREY, E: C.BLACK },
};

/** Same pony with a saddlebag, used for the pony currently out foraging. */
export const PONY_PACK: Sprite = {
  data: [
    ".........MMM....",
    "........MMMMM...",
    "........MCCCC...",
    ".......MCCECC...",
    "......MMCCCCCC..",
    ".....MMMCCCCC...",
    "...CCAAACCCCC...",
    "..CCAAAAACCCC...",
    ".MCCAAAAACCCCC..",
    "MMCCCAAACCCCC...",
    "MMMCCCCCCCCC....",
    "...CC...CC......",
    "...CC...CC......",
    "...HH...HH......",
  ],
  remap: { C: C.PINK, M: C.MAGENTA, H: C.DARKGREY, E: C.BLACK, A: C.BROWN },
};

/** Pegasus variant: the same body with a wing tucked on the near side. */
export const PONY_WINGED: Sprite = {
  data: [
    ".........MMM....",
    "........MMMMM...",
    "........MCCCC...",
    ".......MCCECC...",
    "......MMCCCCCC..",
    ".....MMMCCCCC...",
    "...CCCCCCCCCC...",
    "..CCfffCCCCCC...",
    ".MCCfffffCCCCC..",
    "MMCCCfffCCCCC...",
    "MMMCCCCCCCCC....",
    "...CC...CC......",
    "...CC...CC......",
    "...HH...HH......",
  ],
  remap: { C: C.BRIGHTCYAN, M: C.WHITE, H: C.DARKGREY, E: C.BLACK },
};

/** Unicorn variant: horn added to the forelock. */
export const PONY_HORNED: Sprite = {
  data: [
    ".........f......",
    "........MfM.....",
    "........MMMM....",
    "........MCCCC...",
    ".......MCCECC...",
    "......MMCCCCCC..",
    ".....MMMCCCCC...",
    "...CCCCCCCCCC...",
    "..CCCCCCCCCCC...",
    ".MCCCCCCCCCCC...",
    "MMCCCCCCCCCCC...",
    "MMMCCCCCCCCC....",
    "...CC...CC......",
    "...HH...HH......",
  ],
  remap: { C: C.WHITE, M: C.PINK, H: C.DARKGREY, E: C.BLACK },
};

// ---------------------------------------------------------------------------
// Wildlife
// ---------------------------------------------------------------------------

export const DEER: Sprite = {
  data: [
    "......7...7.....",
    ".......7.7......",
    "........7.......",
    "........6666....",
    ".......66E666...",
    "......666666....",
    ".....66666......",
    "...66666666666..",
    "..666666666666..",
    ".8666666666666..",
    "..66666666666...",
    "...66...666.....",
    "...66...66......",
    "...88...88......",
  ],
  remap: { E: C.BLACK },
};

export const BIRD_A: Sprite = {
  data: [".88...88..", "..88888e..", "...888...."],
};

export const BIRD_B: Sprite = {
  data: ["..88888...", ".88...88e.", "...888...."],
};

export const TIMBERWOLF: Sprite = {
  data: [
    "..............666...",
    ".............66666..",
    "......6666666666C6..",
    "....66666666666666..",
    "..6666666666666666..",
    "6666666666666666668.",
    ".66666666666666666..",
    "..666666666666666...",
    "...666....6666......",
    "...66......666......",
    "...66......66.......",
    "...88......88.......",
  ],
  remap: { C: C.BRIGHTRED, "6": C.BROWN },
};

// ---------------------------------------------------------------------------
// Foraging pickups
// ---------------------------------------------------------------------------

export const BERRIES: Sprite = {
  data: ["..a..", ".c.c.", "ccccc", ".ccc.", "..c.."],
};

export const NUTS: Sprite = {
  data: [".....", ".666.", "66e66", ".666.", "..8.."],
};

export const GRASSES: Sprite = {
  data: ["a...a", ".a.a.", ".aaa.", "..a..", "..2.."],
};

export const APPLE: Sprite = {
  data: ["..2..", ".ccc.", "ccccc", "ccccc", ".ccc."],
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export const GRAVE: Sprite = {
  data: [
    "..7777777..",
    ".777777777.",
    "77777777777",
    "77778777777",
    "77778777777",
    "7778887777f",
    "77778777777",
    "77778777777",
    "77777777777",
    ".777777777.",
    "22222222222",
  ],
};

export const BASKET: Sprite = {
  data: ["..ccc...", ".c6e6c..", "666e666.", ".66666..", ".66666..", "..666...", "........", "........"],
};

export const COIN: Sprite = {
  data: ["..ee....", ".e66e...", "e6ee6e..", "e6ee6e..", "e6ee6e..", ".e66e...", "..ee....", "........"],
};

export const POTION: Sprite = {
  data: ["..77....", "..bb....", ".7bb7...", ".bddb...", "bdddddb.", "bdddddb.", ".bbbbb..", "........"],
};

export const CLOAK: Sprite = {
  data: ["..111...", ".11111..", "1111111.", "1111111.", "1111111.", "11f1f11.", "1111111.", ".11111.."],
};

export const WHEEL_ICON: Sprite = {
  data: ["..666...", ".6.6.6..", "6..6..6.", "6666666.", "6..6..6.", ".6.6.6..", "..666...", "........"],
};

export const SIGNPOST: Sprite = {
  data: [
    "6666666666..",
    "6ffffffff6..",
    "6f666666f6..",
    "6ffffffff6..",
    "6666666666..",
    "....66......",
    "....66......",
    "....66......",
    "....66......",
    "...8888.....",
  ],
};
