/**
 * Arrival at a town, way station or landmark: the place to trade, rest, talk to
 * other travellers and forage before moving on.
 */

import { audio } from "../../engine/audio";
import { input } from "../../engine/input";
import { Scene, scenes } from "../../engine/scene";
import { C, SCREEN_H, SCREEN_W, screen } from "../../engine/screen";
import { Menu, blink, footer, panel, screenFrame } from "../../engine/ui";
import { drawVista } from "../../art/vistas";
import { LANDMARK_THEME } from "../data/music";
import { Landmark } from "../data/trail";
import { gatherTalk } from "../data/talk";
import { session } from "../session";
import { GameState, formatDate, log } from "../state";
import { ForageScene } from "./forage";
import { RestScene, SizeUpScene } from "./menus";
import { StoreScene } from "./store";
import { drawSupplyStrip, showPages } from "./common";

const LORE: Record<string, string> = {
  "pioneers-bluff":
    "Wagons are drawn up three deep along the square. Somepony is auctioning a stove nopony wants, and a mare with a clipboard is writing down every party that leaves so that somepony, somewhere, will know you went.",
  "marezy-meadow":
    "The grass here comes up to your knees and smells of honey. Wagon teams roll in it and refuse to get up. Two other parties are camped by the creek, and their fires smell of biscuit.",
  ponyville:
    "The market is small and extremely enthusiastic. Three separate ponies try to sell you cider, and one small filly offers to guard your wagon for an apple, which seems a fair trade.",
  "whitetail-station":
    "The trading post smells of pine and pipe smoke. A deer family keep the ledger, and they know to the mile where every wagon on this trail is. If they say the crossing ahead is bad, believe them.",
  "rambling-rock":
    "There is nothing here but stone and the sound of your own wheels complaining. A previous party has stacked cairns to mark the safe line. You add a stone to the last one.",
  "galloping-gorge":
    "You can hear the water long before you see it. The ferry stallion has read the same book for eleven years and would rather talk about that.",
  "dodge-junction":
    "Cherry trees in rows, a train that comes twice a week, and prices that make your eyes water. Everypony here is polite and nopony here is cheap.",
  "macintosh-hills":
    "Red hills roll away in every direction, and the wind carries a smell of hot dust and, faintly, apples. The team keeps stopping to sniff at it.",
  "san-palomino":
    "Flat white light, hard shadows, nothing moving. You water everypony twice and travel in the cool of the morning. The horizon does not appear to get any closer.",
  "ghastly-gorge":
    "Loose scree, narrow walls, and holes in the rock that everypony agrees not to look into. The wagon squeaks through with an inch on either side.",
  "sunkissed-springs":
    "Warm water, cold lemonade, and a mare who charges for both without apology. Everypony soaks their hooves and pretends not to be worried about the road ahead.",
};

export interface LandmarkOpts {
  onDone: () => void;
}

export class LandmarkScene implements Scene {
  readonly name = "landmark";
  private frame = 0;
  private menu = new Menu([]);

  constructor(
    private g: GameState,
    private landmark: Landmark,
    private opts: LandmarkOpts,
  ) {}

  enter(): void {
    audio.playSong(LANDMARK_THEME);
    audio.sfx("fanfare");
    this.refresh();
    if (!this.g.flags[`arrived:${this.landmark.id}`]) {
      this.g.flags[`arrived:${this.landmark.id}`] = true;
      log(this.g, `Reached ${this.landmark.name}.`);
      showPages([
        {
          title: `You have reached ${this.landmark.name}`,
          text: `${formatDate(this.g.date)}. ${Math.round(this.g.miles)} miles from Pioneer's Bluff, on day ${this.g.day} of your journey.`,
          sfx: "fanfare",
        },
        { title: this.landmark.name, text: this.landmark.blurb },
      ]);
    }
  }

  exit(): void {
    audio.stopMusic();
  }

  private refresh(): void {
    const items = [{ label: "Continue on the trail" }, { label: "Look around" }];
    if (this.landmark.store) items.push({ label: "Trade at the store" });
    if (this.landmark.talk) items.push({ label: "Talk to other ponies" });
    if (this.landmark.rest !== false) items.push({ label: "Rest a while" });
    items.push({ label: "Forage for food" });
    items.push({ label: "Size up the situation" });
    this.menu.setItems(items);
  }

  private labelAt(i: number): string {
    return this.menu.items[i]?.label ?? "";
  }

  update(dt: number): void {
    this.frame += dt * 60;
    const picked = this.menu.update();
    if (picked === null) return;
    const label = this.labelAt(picked);
    switch (label) {
      case "Continue on the trail":
        scenes.pop();
        this.opts.onDone();
        break;
      case "Look around":
        showPages([
          {
            title: this.landmark.name,
            text: LORE[this.landmark.id] ?? this.landmark.blurb,
          },
        ]);
        break;
      case "Trade at the store":
        scenes.push(
          new StoreScene(this.g, this.landmark, {
            onDone: () => this.refresh(),
          }),
        );
        break;
      case "Talk to other ponies": {
        const talk = gatherTalk(this.g, session.rng, 2);
        showPages(talk.map((t) => ({ title: t.speaker, text: `"${t.text}"` })));
        break;
      }
      case "Rest a while":
        scenes.push(new RestScene());
        break;
      case "Forage for food":
        scenes.push(new ForageScene(this.g, () => this.refresh()));
        break;
      case "Size up the situation":
        scenes.push(new SizeUpScene());
        break;
    }
  }

  draw(): void {
    const g = this.g;
    screenFrame(this.landmark.name.toUpperCase());
    drawVista(this.landmark.id, this.landmark.terrain, {
      top: 12,
      bottom: 104,
      frame: this.frame,
      rig: g.team,
    });
    screen.hline(0, 104, SCREEN_W, C.GREY);

    panel(6, 108, 178, 74, { fill: C.BLACK, border: C.DARKGREY, label: "landmark menu" });
    screen.text(12, 111, "You may:", C.CYAN);
    this.menu.draw({ x: 18, y: 122, color: C.GREY, cursorColor: C.WHITE, lineHeight: 8, maxLabel: 25 });

    panel(188, 108, SCREEN_W - 194, 74, { fill: C.BLACK, border: C.DARKGREY });
    screen.text(194, 112, formatDate(g.date), C.YELLOW);
    screen.text(194, 122, `day ${g.day}`, C.GREY);
    screen.text(194, 132, `${Math.round(g.miles)} miles`, C.GREY);
    screen.text(194, 142, `${Math.round(g.food)} baskets`, g.food < 20 ? C.BRIGHTRED : C.WHITE);
    screen.text(194, 152, `${Math.round(g.bits)} bits`, C.WHITE);
    screen.text(194, 162, `team of ${g.team}`, g.team === 0 ? C.BRIGHTRED : C.WHITE);
    if (this.landmark.priceMult && this.landmark.priceMult > 1) {
      screen.text(194, 172, `prices x${this.landmark.priceMult.toFixed(1)}`, C.BROWN);
    }

    drawSupplyStrip(g, 6, 185, SCREEN_W - 12);
    void blink;
    void footer;
    void input;
    void SCREEN_H;
  }
}
