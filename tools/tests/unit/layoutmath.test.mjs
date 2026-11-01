// Unit tests for the layout's maths (app/layoutmath.js): no browser, just numbers — run with `npm run test:unit`.
import { pairGap } from "../../../app/tokens.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fitInBox,
  toolColumnW,
  pageGeometry,
  stackColumnW,
  framePlacement,
  pageInsets,
  fades,
  MORPH,
  shapeSteps,
  shapeBox,
  upgradeLayoutPrefs,
  promptSlotH,
  cardAnchorTop,
  cardHeightMode,
  cardPlacement,
  MMIN,
  PWMIN,
  CARDMAX,
  arrange,
  rubber,
  limits,
  trade,
  growRoom,
  paneDefault,
  layoutPrefsV4,
  PAGE_IDS,
  QUEUEMAX,
} from "../../../app/layoutmath.js";

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} ≠ ${b}`);
const wide = { pw: 680, rw: 660, iw: null }; // the default sizes

test("a picture fits its box: the side that hits first decides", () => {
  assert.deepEqual(fitInBox("3:4", 300, 300), { w: 225, h: 300 }); // a tall picture in a square: full height
  assert.deepEqual(fitInBox("16:9", 320, 1000), { w: 320, h: 180 }); // a wide one in a tall box: full width
});

test("the edit buttons' column grows a column when the picture is too short for them", () => {
  // 40 px buttons, the tight gap (8) between them and from the picture
  assert.equal(toolColumnW(600, 6), 56); // tall: one column (8 + 48)
  assert.equal(toolColumnW(100, 6), 152); // two buttons per column → three columns
  assert.equal(toolColumnW(20, 6), 296); // never less than one button per column
});

/* the pair side by side (v0.7c, 2026-11-02): the group may reach the room's ends (the window less its area gap); the only
   other room kept is the edit buttons' clearance, beside the picture on its outer side; the prompt has no cap */
const geo = (/** @type {any} */ m, /** @type {any} */ L = wide) => pageGeometry({ minR: 420, gen: false, ...m }, L);

test("a wide window: your widths as set, the pair centred with even margins", () => {
  const g = geo({ W: 1477 });
  assert.equal(g.pw, 680);
  assert.equal(g.rw, 660);
  near(g.mL, g.mR, "the margins are even");
  near(g.mL + g.pw + pairGap() + g.rw + g.mR, 1477, "everything adds up to the room");
});

test("the prompt has no cap of its own: up to the room (it was 900 px)", () => {
  assert.equal(geo({ W: 2500 }, { ...wide, pw: 1400 }).pw, 1400);
});

test("too narrow: both give way in proportion, the margins go first (to the room's ends)", () => {
  const g = geo({ W: 1000 });
  assert.ok(g.pw < 680 && g.rw < 660, "both shrank");
  near(g.pw / g.rw, 680 / 660, "in proportion");
  near(g.mL, 0, "no margins left");
});

test("very narrow: each stops at its own minimum", () => {
  const g = geo({ W: 700 });
  assert.equal(g.pw, PWMIN);
  assert.equal(g.rw, 420);
});

test("a picture page: the area takes what the prompt leaves, up to your cap; the clearance both sides at rest", () => {
  const g = geo({ W: 1800, gen: true, clear: 36 });
  assert.equal(g.pw, 680, "the prompt keeps its width");
  near(g.rw, 1800 - 72 - 680 - pairGap(), "the area: the rest, less the buttons' clearance each side");
  near(g.mL, 36, "the clearance both sides: the plate's centre line stays put while you browse");
  near(g.mR, 36);
  const capped = geo({ W: 1800, gen: true, clear: 36 }, { ...wide, iw: 700 });
  assert.equal(capped.rw, 700, "your cap");
  near(capped.mL, capped.mR, "capped: centred");
  near(geo({ W: 2400, gen: true, clear: 36 }, { ...wide, pw: 1400 }).pw, 1400, "no 900 px cap on the prompt");
});

test("a panel keeps no clearance: centred, or to the room's ends", () => {
  const g = geo({ W: 680 + 660 + pairGap() + 30, clear: 0 });
  near(g.mL, g.mR, "centred");
});

test("Vertical: the column is as wide as a 16:9 picture at its height, within the tab bar, the prompt and the window", () => {
  assert.equal(stackColumnW(2000, 420, 600, 450, 36), 800, "450 × 16/9 — the buttons take no room in it");
  assert.equal(stackColumnW(2000, 420, 1000, 450, 36), 1000, "never narrower than the prompt box");
  assert.equal(stackColumnW(700, 420, 600, 450, 36), 628, "never wider than the window less the buttons' clearance");
  assert.equal(
    stackColumnW(2000, 420, 600, 450, 36, true),
    1928,
    "Generating: the whole width (the ratio sets the picture's)",
  );
});

test("the picture and its button column sit centred together; the column away from the prompt", () => {
  const a = { areaW: 1000, areaH: 800, w: 600, h: 450, tb: 52, row: 66, heldTop: null, stacked: false };
  const right = framePlacement({ ...a, toolsLeft: false }); // prompt on the left: the column on the picture's right
  assert.equal(right.left, 174); // (1000 − 600 − 52) / 2
  assert.equal(right.toolsX, 774, "the column right after the picture");
  const left = framePlacement({ ...a, toolsLeft: true }); // prompt on the right: the column on the left
  assert.equal(left.toolsX, 174);
  assert.equal(left.left, 226, "the picture after the column");
  assert.equal(right.top, (800 - 450 - 66) / 2, "centred above the status row's room");
});

test("a held top or bottom edge keeps the picture's top where it was", () => {
  const a = { areaW: 1000, areaH: 800, w: 600, h: 300, tb: 52, row: 66, stacked: false, toolsLeft: false };
  assert.equal(framePlacement({ ...a, heldTop: 40 }).top, 40);
});

test("Vertical: the picture itself is on the centre line", () => {
  const p = framePlacement({
    areaW: 1000,
    areaH: 800,
    w: 600,
    h: 450,
    tb: 52,
    row: 66,
    heldTop: null,
    stacked: true,
    toolsLeft: false,
  });
  assert.equal(p.left, 200);
  assert.equal(p.top, 0, "at the top of its room: the spare height goes under the prompt");
});

test("older saved layouts become today's: shares of the window → px, once", () => {
  assert.deepEqual(upgradeLayoutPrefs({ pw: 0.4, rw: 0.5, iw: null, ih: 0.8, v: 2 }, 1500), {
    pw: 600,
    rw: 750,
    iw: null,
    ih: 0.8,
    v: 3,
  });
  const today = { pw: 680, rw: 660, iw: null, v: 3 };
  assert.equal(upgradeLayoutPrefs(today, 1500), today, "today's format is left alone");
  assert.equal(upgradeLayoutPrefs({ pw: 680, rw: 660, iw: null }, 1500).v, 3, "no version: already px, just labelled");
  assert.equal(upgradeLayoutPrefs(undefined, 1500), undefined, "nothing saved: nothing to do");
});

/* ---------- the prompt card ---------- */
const anchors = { it: 100, ib: 700, cy: 400 }; // picture top 100, status line 700, centre 400

test("Vertical: the prompt box grows with your draft up to ~40 %, or takes the height you dragged it to", () => {
  assert.equal(promptSlotH(130, 0, 1000, 150), 150, "automatic, a line of text: the box's least height");
  assert.equal(promptSlotH(260, 0, 1000, 150), 260, "automatic, longer: as tall as the text");
  assert.equal(promptSlotH(900, 0, 1000, 150), 400, "automatic, past ~40 % of the window: it scrolls");
  assert.equal(promptSlotH(130, 600, 1000, 150), 600, "yours: the height you set, however short the text");
  assert.equal(promptSlotH(900, 600, 1000, 150), 600, "yours: the text scrolls inside it");
  assert.equal(promptSlotH(900, 900, 1000, 150), 700, "never above 70 % of the window");
  assert.equal(promptSlotH(100, 120, 1000, 150), 150, "never below the box's least height");
});

test("the card rests at the picture's top, centre or status line — inside the column", () => {
  assert.equal(cardAnchorTop("top", 300, 900, anchors), 100);
  assert.equal(cardAnchorTop("mid", 300, 900, anchors), 250, "centred on the picture");
  assert.equal(cardAnchorTop("bot", 300, 900, anchors), 400, "its bottom on the status line");
  assert.equal(cardAnchorTop("bot", 300, 900, { ...anchors, ib: 1200 }), 600, "never past the column's end");
  assert.equal(
    cardAnchorTop("mid", 300, 900, { it: null, ib: null, cy: null }),
    300,
    "no picture: the column's centre",
  );
});

test("height modes: Full = the column, Match = picture top to status line; too short → its least height, centred", () => {
  assert.deepEqual(cardHeightMode("full", 900, 40, 200, anchors), { top: 0, H: 860 });
  assert.deepEqual(cardHeightMode("match", 900, 40, 200, anchors), { top: 100, H: 560 });
  assert.deepEqual(cardHeightMode("match", 900, 40, 200, { it: 300, ib: 400, cy: 350 }), { top: 230, H: 200 });
});

test("the card: your height or its text's, within the room", () => {
  const c = { colH: 900, CH: 40, pos: "mid", frozen: false, prevTop: null, prevBottom: null, a: anchors };
  assert.equal(cardPlacement({ ...c, pph: 0, naturalH: 300 }).H, 300, "the text's");
  assert.equal(cardPlacement({ ...c, pph: 500, naturalH: 300 }).H, 500, "yours");
  assert.equal(cardPlacement({ ...c, pph: 100, naturalH: 300 }).H, 240, "yours, never under 240");
  assert.equal(cardPlacement({ ...c, pph: 0, naturalH: 2000 }).H, 860, "never more than the room");
});

test("frozen while you work: the top stays put and only the bottom grows (a bottom card grows upward)", () => {
  const c = { colH: 900, CH: 40, pph: 0, naturalH: 500, frozen: true, a: anchors };
  const mid = cardPlacement({ ...c, pos: "mid", prevTop: 200, prevBottom: 540 });
  assert.equal(mid.top, 200, "the top where it was");
  assert.equal(mid.bottom, 540, "the remembered bottom isn't moved");
  const bot = cardPlacement({ ...c, pos: "bot", prevTop: 200, prevBottom: 740 });
  assert.equal(bot.top + bot.H + 40, 740, "a bottom card keeps its bottom: it grew upward");
  const free = cardPlacement({ ...c, frozen: false, pos: "mid", prevTop: 200, prevBottom: 540 });
  assert.equal(free.top, 130, "not frozen: back to its resting place (centred on the picture)");
});

test("shapeSteps: a box changing shape crops first, swaps, then reveals (the one choreography)", () => {
  // a 1:1 empty frame into a 16:9 picture: the height shrinks, the width grows
  const o = { l: 0, t: 0, w: 600, h: 600 },
    n = { l: -100, t: 131, w: 800, h: 450 },
    st = shapeSteps(o, n);
  assert.ok(st.A > 0 && st.B > 0 && st.T === st.A + st.S + st.B);
  assert.deepEqual(st.q(st.A), [0, 1], "by the swap the shrinking axis is done and the growing one hasn't started");
  assert.deepEqual(st.q(st.T), [1, 1]);
  const atSwap = shapeBox(o, n, st.q(st.A));
  assert.equal(atSwap.h, 450, "when the new contents come in the box is already their height (no band above or below)");
  assert.equal(atSwap.w, 600);
  assert.equal(atSwap.l + atSwap.w / 2, 300, "…and each axis keeps its centre until it moves");
  // only a crop: one move, and the swap after it
  const c = shapeSteps({ w: 800, h: 600 }, { w: 400, h: 300 });
  assert.equal(c.B, 0);
  assert.deepEqual(c.q(c.A), [1, 1]);
  // the same size: nothing moves but the swap
  const s = shapeSteps({ w: 500, h: 500 }, { w: 500, h: 500 });
  assert.equal(s.T, s.S);
  assert.ok(s.S >= 180, "…a swap on its own is a real cross-fade, not an 80 ms cut");
});

/* ---------- every page's insets (2026-10-31): room only while what it holds is there ---------- */
const idle = { running: false, waiting: false, paused: false, ready: true, news: false, shown: false };

test("panels keep no room: Queue, LoRAs and PNG Info fill their plate", () => {
  assert.deepEqual(pageInsets("panel", { ...idle, running: true, shown: true }), { row: false, tools: false });
});

test("the Gallery keeps the buttons' column and never the status row, rendering or not", () => {
  assert.deepEqual(pageInsets("gallery", idle), { row: false, tools: true });
  assert.deepEqual(pageInsets("gallery", { ...idle, running: true, waiting: true }), { row: false, tools: true });
});

test("Generating, empty and idle: the whole plate", () => {
  assert.deepEqual(pageInsets("generating", idle), { row: false, tools: false });
});

test("Generating while rendering: the row, no buttons' column", () => {
  assert.deepEqual(pageInsets("generating", { ...idle, running: true }), { row: true, tools: false });
});

test("Generating between two queued jobs: nothing changes — the row stays, no column for the result between them", () => {
  const between = { ...idle, waiting: true, shown: true }; // job 1 done (its result on show), job 2 not started yet
  assert.deepEqual(
    pageInsets("generating", between),
    pageInsets("generating", { ...idle, running: true, shown: true }),
  );
  assert.deepEqual(pageInsets("generating", between), { row: true, tools: false });
});

test("Generating after the last job: the row goes, the result gets its buttons' column", () => {
  assert.deepEqual(pageInsets("generating", { ...idle, shown: true }), { row: false, tools: true });
});

test("a paused queue keeps its row (it says so); waiting jobs with the generator down don't", () => {
  assert.equal(pageInsets("generating", { ...idle, waiting: true, paused: true }).row, true);
  assert.equal(pageInsets("generating", { ...idle, waiting: true, ready: false }).row, false);
});

test('a result behind your reference keeps the row ("#N finished")', () => {
  assert.deepEqual(pageInsets("generating", { ...idle, news: true, shown: true }), { row: true, tools: false });
});

test("one fade for contents everywhere: out ends at the swap, in starts there, both MORPH.fade long", () => {
  const F = MORPH.fade;
  const same = fades(shapeSteps({ w: 100, h: 100 }, { w: 100, h: 100 }));
  assert.deepEqual([same.out.delay, same.in.delay], [0, 0], "the same shape: a cross-fade from the start");
  const both = shapeSteps({ w: 100, h: 200 }, { w: 200, h: 100 }), // a crop and a reveal
    f = fades(both);
  assert.equal(f.out.delay + f.out.duration, both.A + both.S, "out ends at the swap");
  assert.equal(f.in.delay, both.A, "in starts at the swap");
  assert.equal(f.out.duration, F);
  assert.equal(f.in.duration, F);
  const grow = fades(shapeSteps({ w: 100, h: 100 }, { w: 200, h: 200 })); // only a reveal: the swap comes first
  assert.equal(grow.out.delay, 0, "the swap sooner than a fade: out from the first frame");
  const crop = shapeSteps({ w: 200, h: 200 }, { w: 100, h: 100 }); // only a crop: in runs past the shape change
  assert.equal(fades(crop).T, Math.max(crop.T, crop.A + F), "the change lasts until its fade-in ends");
});

/** today's side-by-side pair as an arrangement: the prompt, then the page (null = takes the room left) */
const pair = (
  /** @type {number} */ W,
  /** @type {number} */ pw,
  /** @type {number | null} */ rw,
  minR = 420,
  margin = MMIN,
) =>
  arrange({
    panes: [
      { size: pw, lo: PWMIN, hi: CARDMAX },
      { size: rw, lo: minR, hi: W },
    ],
    gap: pairGap(),
    start: 0,
    length: W,
    margin,
    anchor: "center",
  });

test("model: pageGeometry is arrange (one group maths for every layout)", () => {
  for (const [W, gen, L] of /** @type {const} */ ([
    [1800, false, wide],
    [2400, false, { pw: 700, rw: 900, iw: null }],
    [1800, true, wide],
    [1200, false, { pw: 680, rw: 900, iw: null }],
  ])) {
    const g = pageGeometry({ W, gen, minR: 420, clear: 0 }, L),
      a = pair(W, L.pw, gen ? null : L.rw, 420, 0);
    near(a.panes[0].size, g.pw, `${W} ${gen} prompt width`);
    near(a.panes[1].size, g.rw, `${W} ${gen} page width`);
    near(a.start, g.mL, `${W} ${gen} left margin`);
    near(W - a.end, g.mR, `${W} ${gen} right margin`);
  }
});

test("model: too little room shrinks in proportion, never below a pane's least", () => {
  const a = pair(1000, 680, 900);
  assert.ok(a.panes[0].size >= PWMIN && a.panes[1].size >= 420, "both at least their least");
  near(a.end - a.start, 1000 - 2 * MMIN, "the group fills the room less its margins");
  const tight = pair(700, 680, 900); // can't fit: both at their least, overflowing, centred
  near(tight.panes[0].size, PWMIN, "prompt at its least");
  near(tight.panes[1].size, 420, "page at its least");
  near(tight.start + tight.end, 700, "centred");
});

test("model: a pin holds one side still; nothing else changes size", () => {
  const rest = pair(1800, 680, 660);
  /* the page's outer edge dragged 100 px out: its inner side (by the divider) is pinned where it was */
  const inner = rest.panes[1].start;
  const a = arrange({
    panes: [
      { size: 680, lo: PWMIN, hi: CARDMAX },
      { size: 760, lo: 420, hi: 1800 },
    ],
    gap: pairGap(),
    start: 0,
    length: 1800,
    margin: MMIN,
    anchor: "center",
    pin: { i: 1, side: "start", at: inner },
  });
  near(a.panes[1].start, inner, "the pinned side stayed");
  near(a.panes[1].start + a.panes[1].size, rest.panes[1].start + 660 + 100, "the dragged side moved 100");
  near(a.panes[0].start, rest.panes[0].start, "the prompt stayed glued: it didn't move");
  near(a.panes[0].size, 680, "and kept its size");
});

test("model: the start anchor (Vertical): the group sits a margin from the top, the spare room at the end", () => {
  const a = arrange({
    panes: [
      { size: 500, lo: 200, hi: 900 },
      { size: 160, lo: 100, hi: 600 },
    ],
    gap: 20,
    start: 100,
    length: 1000,
    margin: 12,
    anchor: "start",
  });
  near(a.panes[0].start, 112, "the picture one margin under the bar");
  near(a.panes[1].start, 112 + 500 + 20, "the prompt glued one gap under it");
  near(a.end, 112 + 500 + 20 + 160, "the spare room is at the bottom");
});

test("model: the rubber band answers back past a limit, never past its stretch, never backwards", () => {
  assert.equal(rubber(500, 400, 600, 300), 500, "inside the limits: as asked");
  let last = 600;
  for (const x of [610, 650, 800, 2000, 1e6]) {
    const r = rubber(x, 400, 600, 300);
    assert.ok(r > last - 1e-9 && r < x, `${x}: further, but less than asked`);
    assert.ok(r < 600 + 300, `${x}: never past the stretch`);
    last = r;
  }
  assert.ok(rubber(300, 400, 600, 300) < 400 && rubber(300, 400, 600, 300) > 100, "below the least, the same way");
  near(rubber(700, 650, 650, 300) - 650, 650 - rubber(600, 650, 650, 300), "a fixed size answers back both ways alike");
});

test("model: the divider trades — one grows by what the other gives, within both panes' limits", () => {
  const la = { lo: 360, hi: 900 },
    lb = { lo: 420, hi: 1800 };
  near(trade(100, 680, 660, la, lb), 100, "inside the limits: the whole move");
  near(trade(-100, 680, 660, la, lb), -100, "the other way too");
  const past = trade(400, 680, 660, la, lb); // the page would drop to 260, under its 420: past the limit at +240
  assert.ok(past > 240 && past < 400, "past the page's least: resistance");
});

test("model: growRoom is the room between the group and the window's edge", () => {
  const a = pair(1800, 680, 660);
  near(growRoom(a, "end", 0, 1800), 1800 - a.end, "toward the end");
  near(growRoom(a, "start", 0, 1800), a.start, "toward the start");
});

test("model: limits — one place for every pane's least and largest", () => {
  const c = { orient: /** @type {const} */ ("side"), roomW: 1800, roomH: 950, minR: 420 };
  assert.deepEqual(limits("box", "w", c), { lo: PWMIN, hi: 1800 }, "the prompt: up to the room (no 900 cap)");
  assert.deepEqual(limits("queue", "w", c), { lo: 420, hi: QUEUEMAX });
  assert.deepEqual(limits("loras", "w", c), { lo: 420, hi: 1800 });
  const png = limits("png", "w", c);
  assert.equal(png.lo, png.hi, "PNG Info: a fixed width");
  assert.equal(png.lo, Math.round((950 * 2) / 3), "its default: a 2:3 plate");
  assert.deepEqual(limits("box", "w", { ...c, roomW: 300 }), { lo: 300, hi: 300 }, "a tiny room: never lo > hi");
  assert.equal(
    limits("box", "h", { ...c, orient: "vert", least: 120, winH: 1000 }).hi,
    700,
    "Vertical: 70 % of the window",
  );
});

test("model: defaults — panels 2:3 side by side, 1:1 in Vertical; picture pages uncapped", () => {
  assert.deepEqual(paneDefault("queue", "side", { w: 1800, h: 900 }), { w: 600, h: 900 });
  assert.deepEqual(paneDefault("loras", "vert", { w: 1800, h: 700 }), { w: 700, h: 700 });
  assert.deepEqual(paneDefault("generating", "side", { w: 1800, h: 900 }), { w: null, h: null });
  assert.deepEqual(paneDefault("box", "side", { w: 1800, h: 900 }), { w: 680, h: null });
});

test("model: saved layouts v3 → v4 — every old size lands on its pane, each page its own", () => {
  const v4 = layoutPrefsV4(
    { pw: 700, rw: 640, iw: 900, ih: 0.5, vih: 0.8, sw: 820, v: 3 },
    { roomH: 1000, vroomH: 600 },
  );
  assert.equal(v4.v, 4);
  assert.deepEqual(v4.side.box, { w: 700, h: null }, "the box's height is never kept: it hugs its text");
  assert.deepEqual(v4.vert.box, { w: 820, h: null });
  assert.deepEqual(v4.side.pages.generating, { w: 900, h: 500 }, "a height cap: a share of the room → px");
  assert.deepEqual(v4.side.pages.gallery, { w: 900, h: 500 }, "the Gallery had the same cap");
  assert.notEqual(v4.side.pages.gallery, v4.side.pages.generating, "but its own from now on");
  assert.deepEqual(v4.side.pages.queue, { w: 640, h: null });
  assert.notEqual(v4.side.pages.loras, v4.side.pages.queue, "the Queue and LoRAs: each its own");
  assert.deepEqual(v4.side.pages.png, { w: null, h: null }, "PNG Info: its default");
  assert.deepEqual(v4.vert.pages.generating, { w: null, h: 480 });
  assert.deepEqual(Object.keys(v4.vert.pages), [...PAGE_IDS]);
  assert.equal(layoutPrefsV4(v4, { roomH: 1, vroomH: 1 }), v4, "v4 passes through");
  assert.deepEqual(
    layoutPrefsV4(null, { roomH: 1000, vroomH: 600 }).side.box,
    { w: null, h: null },
    "nothing saved: defaults",
  );
});
