// Unit tests for the single layout pass (app/layoutmath.js layoutPass; ux-review/16-layout-pass.md), at rest: the
// rules checked over a generated grid — every layout × page (six ratios and a panel) × window × box mode — not picked
// cases. Run with `npm run test:unit`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutPass, EDIT_TOOLS, HANDLE, PWMIN, RUBBER, picLeastH } from "../../../app/layoutmath.js";

const PICHMIN = picLeastH();

const GAP = { area: 20, pair: 20, bar: 12 },
  BAR = { w: 604, h: 52 },
  STRIP = 44,
  EPS = 0.5;
const WINDOWS = [
  [1280, 800],
  [1760, 1080],
  [2560, 1080],
  [3440, 1440],
];
const RATIOS = [3 / 4, 2 / 3, 1, 16 / 9, 21 / 9, 9 / 16];
const PANEL = { kind: "panel", w: 640, h: 900, lo: { w: 604, h: 240 }, hi: { w: 900, h: 5000 } };
const DOCKS = /** @type {const} */ (["left", "right", "below"]);
const MODES = /** @type {const} */ (["", "full", "match", "fit"]);

/** @param {object} o */
const state = o => ({
  W: 1760,
  H: 1080,
  dock: "left",
  page: { kind: "pic", ratio: 1 },
  box: { w: 680, wLo: PWMIN, text: 150, least: 108, hi: 600, mode: "", anchor: "top" },
  bar: BAR,
  strip: STRIP,
  gap: GAP,
  picLeast: PICHMIN,
  ...o,
});

/** every case of the grid */
function* grid() {
  for (const [W, H] of WINDOWS)
    for (const dock of DOCKS)
      for (const page of [...RATIOS.map(ratio => ({ kind: "pic", ratio })), PANEL])
        for (const mode of MODES) {
          if (mode === "fit" && dock !== "below") continue; // Fit is Vertical's (its cross axis is the width)
          if (mode === "match" && dock === "below") continue; // Match is side by side's
          const s = state({ W, H, dock, page, box: { ...state({}).box, mode } }),
            name = `${W}×${H} ${dock} ${page.kind === "pic" ? page.ratio.toFixed(2) : "panel"} ${mode || "normal"}`;
          yield { s, out: layoutPass(s), name };
        }
}

const right = r => r.x + r.w,
  bottom = r => r.y + r.h,
  overlap = (a, b) =>
    Math.min(right(a), right(b)) - Math.max(a.x, b.x) > EPS &&
    Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y) > EPS;

test("nothing overlaps: the tab bar, the page's pane, the prompt box", () => {
  for (const { out, name } of grid()) {
    assert.ok(!overlap(out.page, out.box), `${name}: the page and the box`);
    assert.ok(!overlap(out.bar, out.page), `${name}: the bar and the page`);
    assert.ok(!overlap(out.bar, out.box), `${name}: the bar and the box`);
  }
});

test("everything inside the window, one area gap from its edges", () => {
  for (const { s, out, name } of grid())
    for (const [part, r] of Object.entries({ page: out.page, box: out.box, bar: out.bar })) {
      assert.ok(r.x >= GAP.area - EPS && right(r) <= s.W - GAP.area + EPS, `${name}: ${part} across`);
      assert.ok(r.y >= GAP.area - EPS && bottom(r) <= s.H - GAP.area + EPS, `${name}: ${part} down`);
    }
});

test("side by side the pair you see is centred; the buttons' strip takes room only where the margin has none", () => {
  for (const { s, out, name } of grid()) {
    if (s.dock === "below" || !out.pic) continue;
    const l = Math.min(out.box.x, out.pic.x) - GAP.area,
      r = s.W - GAP.area - Math.max(right(out.box), right(out.pic)),
      margin = Math.min(l, r);
    if (margin >= STRIP - EPS) assert.ok(Math.abs(l - r) <= EPS, `${name}: centred (${l} | ${r})`);
    else
      assert.ok(Math.abs((s.dock === "left" ? r : l) - STRIP) <= EPS, `${name}: no room: the strip takes just its own`);
  }
});

test("the pane between them keeps one gap", () => {
  for (const { s, out, name } of grid()) {
    const d =
      s.dock === "below"
        ? out.box.y - bottom(out.page)
        : s.dock === "left"
          ? out.page.x - right(out.box)
          : out.box.x - right(out.page);
    assert.ok(Math.abs(d - GAP.pair) <= EPS, `${name}: the gap ${d}`);
  }
});

test("a picture at 100 % is its largest, and its largest touches the room on its binding side", () => {
  for (const { s, out, name } of grid()) {
    if (!out.pic) continue;
    if (s.dock !== "below") assert.ok(Math.abs(out.pic.w - out.largest.w) <= EPS, `${name}: by default, its largest`);
    assert.ok(Math.abs(out.pic.w / out.pic.h - s.page.ratio) < 1e-6, `${name}: its ratio`);
    const CH = s.H - GAP.area - (GAP.area + BAR.h + GAP.bar),
      roomW = s.W - 2 * GAP.area - 2 * STRIP - (s.dock === "below" ? 0 : out.box.w + GAP.pair), // side by side too: the strip's room both sides (B15)
      roomH = s.dock === "below" ? CH - GAP.pair - out.box.h : CH;
    const atW = Math.abs(out.pic.w - roomW) <= EPS,
      atH = Math.abs(out.pic.h - roomH) <= EPS;
    assert.ok(atW || atH, `${name}: touches the room (w ${out.pic.w} of ${roomW}, h ${out.pic.h} of ${roomH})`);
    assert.ok(out.pic.w <= roomW + EPS && out.pic.h <= roomH + EPS, `${name}: never past it`);
  }
});

test("every ratio in the Gallery shows at its own largest (a scale, not a px cap)", () => {
  for (const dock of DOCKS) {
    const at = RATIOS.map(ratio => layoutPass(state({ dock, page: { kind: "pic", ratio, scale: 1 } })));
    for (const o of at) assert.ok(Math.abs(o.pic.w - o.largest.w) <= EPS, `${dock}: at its largest`);
    /* a scale kept from one picture means the same share for the next, whatever its ratio */
    const half = RATIOS.map(ratio => layoutPass(state({ dock, page: { kind: "pic", ratio, scale: 0.6 } })));
    /* (never under its least height: a 21:9's 60 % is, since the least became the buttons' column, DD-2026-11-07-2) */
    half.forEach((o, i) =>
      assert.ok(
        Math.abs(o.pic.w - Math.max(0.6 * at[i].pic.w, PICHMIN * RATIOS[i])) <= EPS,
        `${dock}: 60 % of its own largest`,
      ),
    );
  }
});

test("a scale never takes a picture under its least height", () => {
  const o = layoutPass(state({ page: { kind: "pic", ratio: 1, scale: 0.01 } }));
  assert.ok(Math.abs(o.pic.h - PICHMIN) <= EPS, `its least: ${o.pic.h}`);
  assert.ok(Math.abs(o.kept.scale - PICHMIN / o.largest.h) < 1e-9, "…and that's what's kept");
});

test("the tab bar: its own row, centred over the picture or panel, inside the window (Q1: A)", () => {
  for (const { s, out, name } of grid()) {
    const over = out.pic || out.page,
      centred = Math.abs(out.bar.x + BAR.w / 2 - (over.x + over.w / 2)) <= EPS,
      atEdge = Math.abs(out.bar.x - GAP.area) <= EPS || Math.abs(right(out.bar) - (s.W - GAP.area)) <= EPS;
    assert.ok(centred || atEdge, `${name}: centred, or held inside the window`);
    assert.equal(out.bar.y, GAP.area, `${name}: the top row`);
    assert.ok(bottom(out.bar) + GAP.bar <= Math.min(out.page.y, out.box.y) + EPS, `${name}: above everything`);
  }
});

test("a narrow picture: the bar overhangs it, nothing else changes (the bar is no least width)", () => {
  const o = layoutPass(state({ page: { kind: "pic", ratio: 9 / 16, scale: 0.3 } }));
  assert.ok(o.pic.w < BAR.w, `narrower than the bar: ${o.pic.w}`);
  assert.equal(o.page.w, o.pic.w + STRIP, "its pane is the picture and its strip, no wider");
});

test("the handles: one per edge, on its pane's side, as long as that side", () => {
  for (const { s, out, name } of grid()) {
    const over = out.pic || out.page;
    for (const [id, h] of Object.entries(out.handles)) {
      if (id === "shared") continue;
      const [who, side] = id.split("."),
        r = who === "box" ? out.box : over,
        line = side === "left" ? r.x : side === "right" ? right(r) : side === "top" ? r.y : bottom(r),
        x = side === "left" || side === "right";
      assert.ok(Math.abs((x ? h.x + h.w / 2 : h.y + h.h / 2) - line) <= EPS, `${name}: ${id} on its side`);
      assert.equal(x ? h.w : h.h, HANDLE, `${name}: ${id}'s thickness`);
      assert.ok(Math.abs((x ? h.h : h.w) - (x ? r.h : r.w)) <= EPS, `${name}: ${id} as long as its side`);
    }
    const sh = out.handles.shared;
    if (s.dock === "below") {
      assert.ok(sh.x >= Math.max(over.x, out.box.x) - EPS && right(sh) <= Math.min(right(over), right(out.box)) + EPS);
      assert.ok(sh.y > bottom(over) - HANDLE && bottom(sh) < out.box.y + HANDLE, `${name}: shared, in the gap`);
    } else {
      assert.ok(
        sh.y >= Math.max(over.y, out.box.y) - EPS && bottom(sh) <= Math.min(bottom(over), bottom(out.box)) + EPS,
      );
    }
    const n = Object.keys(out.handles).length;
    assert.equal(n, 7, `${name}: seven edges (three per pane's free sides, one shared)`);
  }
});

test("Right mirrors Left", () => {
  for (const [W, H] of WINDOWS)
    for (const page of [{ kind: "pic", ratio: 3 / 4 }, { kind: "pic", ratio: 21 / 9 }, PANEL]) {
      const l = layoutPass(state({ W, H, page, dock: "left" })),
        r = layoutPass(state({ W, H, page, dock: "right" })),
        m = x => W - x;
      assert.ok(Math.abs(m(right(l.box)) - r.box.x) <= EPS, `${W}: the box mirrored`);
      assert.ok(Math.abs(m(right(l.page)) - r.page.x) <= EPS, `${W}: the page mirrored`);
      assert.equal(l.box.y, r.box.y);
      assert.equal(l.page.h, r.page.h);
    }
});

test("the box's modes act on its cross axis", () => {
  const m = layoutPass(state({ page: { kind: "pic", ratio: 3 / 4 }, box: { ...state({}).box, mode: "match" } }));
  assert.equal(m.box.h, m.pic.h, "side by side, Match: the picture's height");
  assert.equal(m.box.y, m.pic.y, "…level with it");
  const f = layoutPass(state({ box: { ...state({}).box, mode: "full" } }));
  assert.equal(f.box.h, 1080 - 20 - (20 + 52 + 12), "Full: the column's height");
  const v = layoutPass(
    state({ dock: "below", page: { kind: "pic", ratio: 16 / 9 }, box: { ...state({}).box, mode: "fit" } }),
  );
  assert.equal(v.box.w, v.pic.w, "Vertical, Fit: the picture's width");
  assert.equal(v.kept.boxW, 680, "…and the width you set is kept");
  const vf = layoutPass(state({ dock: "below", box: { ...state({}).box, mode: "full" } }));
  assert.equal(vf.box.w, 1760 - 40, "Vertical, Full: the window's width less its edge gaps");
});

test("side by side the box's height is its text's, at its anchor by the picture", () => {
  for (const anchor of ["top", "mid", "bot"]) {
    const o = layoutPass(state({ page: { kind: "pic", ratio: 3 / 4 }, box: { ...state({}).box, anchor } }));
    assert.equal(o.box.h, 150, `${anchor}: its text's height`);
    const want = anchor === "top" ? o.pic.y : anchor === "mid" ? o.pic.y + (o.pic.h - 150) / 2 : bottom(o.pic) - 150;
    assert.ok(Math.abs(o.box.y - want) <= EPS, `${anchor}: by the picture`);
  }
  const tiny = layoutPass(state({ box: { ...state({}).box, text: 20 } }));
  assert.equal(tiny.box.h, 108, "never below its least");
});

test("too little room: the picture gives way to its least first, then the box", () => {
  const roomy = layoutPass(state({ W: 1760, page: { kind: "pic", ratio: 21 / 9 } }));
  assert.equal(roomy.box.w, 680, "room enough: your width");
  /* 1300: the box at 680 would leave the picture under its least; at 1100 even both at their least don't fit (past
     what any layout can do: not this rule's case — a 21:9 at its least, 280 px tall, is 653 px wide) */
  const tight = layoutPass(state({ W: 1300, page: { kind: "pic", ratio: 21 / 9 } }));
  assert.ok(tight.box.w < 680 && tight.box.w >= PWMIN, `narrow: the box gives (${tight.box.w})`);
  assert.ok(Math.abs(tight.pic.h - PICHMIN) <= EPS, "…only once the picture is at its least");
});

/* Vertical on the spec (ux-review/16-layout-pass.md C4; DEVLOG DD-2026-11-08-13, DD-2026-11-09-2): the picture first,
   the box under it in what's left; a long text never takes room from the picture — it scrolls */
test("Vertical: the group's top one gap under the bar; the picture first, the box fits its text in what's left", () => {
  const o = layoutPass(state({ dock: "below", page: { kind: "pic", ratio: 3 / 4 } }));
  assert.equal(o.page.y, 20 + 52 + 12);
  assert.equal(o.box.h, 108, "a height-bound picture at its largest leaves the box its least (its text scrolls)");
  assert.ok(Math.abs(bottom(o.box) - (1080 - 20)) <= EPS, "the box under the picture, down to the room's bottom");
  assert.ok(Math.abs(o.pic.x + o.pic.w / 2 - 880) <= EPS, "centred");
  const tall = layoutPass(
    state({ dock: "below", page: { kind: "pic", ratio: 3 / 4 }, box: { ...state({}).box, text: 2000 } }),
  );
  assert.deepEqual(tall.pic, o.pic, "a long text never changes the picture (content growth takes only free room)");
  assert.ok(
    tall.box.h <= 600 && bottom(tall.box) <= 1080 - 20 + EPS,
    "…the box within its largest and the room: it scrolls",
  );
  const wide = layoutPass(
      state({ dock: "below", page: { kind: "pic", ratio: 21 / 9 }, box: { ...state({}).box, text: 2000 } }),
    ),
    free = 1080 - 20 - (wide.page.y + wide.page.h);
  assert.ok(
    wide.box.h > 108 && wide.box.h <= Math.min(600, free) + EPS,
    "a width-bound picture leaves free room: the text grows into it",
    { h: wide.box.h, free },
  );
  const yours = layoutPass(
    state({ dock: "below", page: { kind: "pic", ratio: 21 / 9 }, box: { ...state({}).box, h: 140 } }),
  );
  assert.equal(yours.box.h, 140, "Custom: the height you set (decision A)");
});

/* ---- a drag (rule 3): a constraint — the grabbed edge at the pointer, the rest by the layout's rules ---- */

/** the edge's axis and where it is: its handle's centre line */
const edgeOf = (out, id) => {
  const h = out.handles[id],
    x = h.h > h.w; // a tall strip: a side, moved across
  return { x, line: x ? h.x + h.w / 2 : h.y + h.h / 2 };
};
/** the state a release leaves: what the pass says it keeps */
const release = (s, kept) => ({
  ...s,
  drag: null,
  box: { ...s.box, w: kept.boxW, h: kept.boxH ?? s.box.h }, // Vertical keeps the box's height too (C4c: Custom)
  page: s.page.kind === "pic" ? { ...s.page, scale: kept.scale } : { ...s.page, w: kept.w, h: kept.h },
});
const near = (a, b, tol = EPS) => Math.abs(a - b) <= tol;
const sameRect = (a, b, tol = EPS) =>
  near(a.x, b.x, tol) && near(a.y, b.y, tol) && near(a.w, b.w, tol) && near(a.h, b.h, tol);
/* side by side the box's height edges have nothing to set (its height is its text's — in Vertical its bottom sets its
   height: C4c, decision A); Vertical's picture top fights the anchor */
const GIVES_ONLY = new Set(["box.top", "box.bottom"]);
const givesOnly = (s, id) => GIVES_ONLY.has(id) && s.dock !== "below";
const settles = (s, id) => s.dock === "below" && id === "page.top";

function* drags() {
  for (const { s, out, name } of grid()) {
    if (s.box.mode) continue; // a mode fixes the box's cross size: its edges are checked without one
    for (const id of Object.keys(out.handles))
      for (const d of [-60, 60]) yield { s, out, name: `${name} ${id} ${d > 0 ? "+" : "−"}60`, id, d };
  }
}

test("a drag within the limits: the edge follows the pointer, and letting go moves nothing", () => {
  let n = 0;
  for (const { s, out, name, id, d } of drags()) {
    if (givesOnly(s, id)) continue;
    const e = edgeOf(out, id),
      held = layoutPass({ ...s, drag: { edge: id, at: e.line + d } }),
      he = edgeOf(held, id);
    const free = !Object.values(held.kept).some(v => v === undefined);
    if (!free) continue;
    /* only drags that stay inside the limits: the kept size equals the shown one */
    const after = layoutPass(release(s, held.kept));
    if (!sameRect(after.page, held.page, 1) && near(he.line, e.line + d, 1)) {
      if (settles(s, id)) continue; // Vertical's top: the release brings the group back to its anchor
      assert.fail(`${name}: let go, the page moved: held ${JSON.stringify(held.page)} → ${JSON.stringify(after.page)}`);
    }
    if (near(he.line, e.line + d, 1)) {
      n++;
      assert.ok(sameRect(after.box, held.box, 1), `${name}: let go, the box stays`);
    }
  }
  assert.ok(n > 300, `enough drags inside their limits to mean something (${n})`);
});

test("a drag far past the limit: a little give, and a second drag from there finds nothing more (one drag)", () => {
  for (const { s, out, name, id, d } of drags()) {
    const e = edgeOf(out, id),
      far = Math.sign(d) * 3000,
      held = layoutPass({ ...s, drag: { edge: id, at: e.line + far } }),
      rested = layoutPass(release(s, held.kept)),
      give = Math.abs(edgeOf(held, id).line - edgeOf(rested, id).line);
    if (settles(s, id)) continue; // Vertical's top: the release settles the group under the bar (DEVLOG DD-2026-11-03-6)
    assert.ok(give <= RUBBER + EPS, `${name}: the give ${give.toFixed(1)} ≤ the rubber band's ${RUBBER}`);
    const again = layoutPass({ ...release(s, held.kept), drag: { edge: id, at: edgeOf(rested, id).line + far } });
    for (const k of Object.keys(held.kept))
      assert.ok(
        near(again.kept[k], held.kept[k], 0.01 * Math.max(1, Math.abs(held.kept[k]))),
        `${name}: one drag reaches the limit (${k}: ${held.kept[k]} → ${again.kept[k]})`,
      );
  }
});

test("held, nothing runs over another part, and nothing leaves the window by more than the give", () => {
  for (const { s, name, id, d, out } of drags()) {
    const e = edgeOf(out, id),
      held = layoutPass({ ...s, drag: { edge: id, at: e.line + Math.sign(d) * 3000 } });
    assert.ok(!overlap(held.page, held.box), `${name}: the page and the box`);
    assert.ok(!overlap(held.bar, held.page) && !overlap(held.bar, held.box), `${name}: under the bar`);
    for (const r of [held.page, held.box])
      assert.ok(
        r.x >= -EPS && right(r) <= s.W + EPS && r.y >= -EPS && bottom(r) <= s.H + EPS,
        `${name}: inside the window`,
      );
  }
});

test("side by side, an outer edge mirrors on the far side (the group stays centred) and the other pane keeps its size", () => {
  const s = state({ page: { kind: "pic", ratio: 3 / 4 } }),
    out = layoutPass(s),
    e = edgeOf(out, "box.left"),
    held = layoutPass({ ...s, drag: { edge: "box.left", at: e.line - 50 } });
  assert.ok(near(held.box.x, out.box.x - 50), "the box's outer edge at the pointer");
  assert.ok(near(right(held.page), right(out.page) + 50), "…the far side moves out as much");
  assert.ok(near(held.pic.w, out.pic.w), "…the picture keeps its size");
  assert.ok(near(held.box.w, out.box.w + 100), "…the box grows by both");
});

test("side by side, an outer edge takes no room from the other pane: past its room, the rubber band (DD-2026-11-07-1, B17)", () => {
  /* the page's outer edge and its top / bottom, pulled far past: the box keeps its width, held and kept; the shared edge
     is the only one that trades. A wide picture (bound by its width) and a tall one (by its height), both docks */
  for (const dock of ["left", "right"])
    for (const ratio of [3 / 4, 16 / 9, 21 / 9])
      for (const scale of [0.6, 1]) {
        const s = state({ dock, page: { kind: "pic", ratio, scale } }),
          out = layoutPass(s),
          outer = dock === "left" ? "page.right" : "page.left",
          pulls = [
            [outer, edgeOf(out, outer).line + (dock === "left" ? 2000 : -2000)],
            ["page.top", edgeOf(out, "page.top").line - 2000],
            ["page.bottom", edgeOf(out, "page.bottom").line + 2000],
          ];
        for (const [edge, at] of pulls) {
          const held = layoutPass({ ...s, drag: { edge, at } }),
            tag = `${dock} ${ratio.toFixed(2)} @${scale} ${edge}`;
          assert.ok(
            near(held.box.w, out.box.w),
            `${tag}: held, the box keeps its width (${held.box.w} vs ${out.box.w})`,
          );
          assert.ok(near(held.kept.boxW, out.box.w), `${tag}: kept, the box keeps its width (${held.kept.boxW})`);
          assert.ok(
            held.pic.w <= out.largest.w + 2 * RUBBER + EPS,
            `${tag}: the picture at most its largest + the give`,
          );
        }
      }
});

test("at its widest, the picture's outer edge pulled past: it gives, the far side mirrors (the stretch about the centre)", () => {
  /* the rubber band's stretch went into the strip's room (the pair moving in for it, DD-7): the grabbed edge stood
     still and the far side moved 16 px (the case table, a 21:9 at its widest, 2026-11-07) */
  for (const dock of ["left", "right"])
    for (const ratio of [16 / 9, 21 / 9]) {
      const s = state({ dock, page: { kind: "pic", ratio, scale: 1 } }),
        out = layoutPass(s),
        id = dock === "left" ? "page.right" : "page.left",
        dir = dock === "left" ? 1 : -1,
        held = layoutPass({ ...s, drag: { edge: id, at: edgeOf(out, id).line + dir * 400 } }),
        tag = `${dock} ${ratio.toFixed(2)}`,
        grabbed = dock === "left" ? right(held.pic) - right(out.pic) : out.pic.x - held.pic.x,
        far = dock === "left" ? out.box.x - held.box.x : right(held.box) - right(out.box);
      assert.ok(grabbed >= 1 && grabbed <= RUBBER, `${tag}: the grabbed edge gives (${grabbed})`);
      assert.ok(Math.abs(far - grabbed) <= 1, `${tag}: …the far side mirrors it (${far})`);
    }
});

test("a press moves nothing: every handle, held at its own line, gives the layout at rest (C3)", () => {
  /* a drag's maths and the rectangles must agree on where each edge is: the shared edge's drag centred the group with
     the buttons' strip while the rectangles centre the pair you see, so a press jumped the box 8 px (26 px of pull) */
  for (const dock of ["left", "right"])
    for (const ratio of [3 / 4, 1, 16 / 9, 21 / 9])
      for (const scale of [0.3, 0.7, 1]) {
        const s = state({ dock, page: { kind: "pic", ratio, scale } }),
          out = layoutPass(s);
        for (const id of Object.keys(out.handles)) {
          if (id === "box.top" || id === "box.bottom") continue; // the box's height edges only give (its text's)
          const e = edgeOf(out, id),
            held = layoutPass({ ...s, drag: { edge: id, at: e.line } }),
            tag = `${dock} ${ratio.toFixed(2)} @${scale} ${id}`;
          for (const k of ["x", "y", "w", "h"]) {
            assert.ok(near(held.box[k], out.box[k], 0.6), `${tag}: the box's ${k} (${held.box[k]} vs ${out.box[k]})`);
            assert.ok(
              near(held.pic[k], out.pic[k], 0.6),
              `${tag}: the picture's ${k} (${held.pic[k]} vs ${out.pic[k]})`,
            );
          }
        }
      }
});

test("the shared edge trades: the group holds, one pane grows as the other shrinks", () => {
  for (const dock of ["left", "right", "below"]) {
    /* a panel with room either way (at 900 px tall it's already at its largest in Vertical: the edge only gives) */
    const s = state({ dock, page: { ...PANEL, h: 500 } }),
      out = layoutPass(s),
      e = edgeOf(out, "shared"),
      held = layoutPass({ ...s, drag: { edge: "shared", at: e.line + 30 } });
    assert.ok(near(edgeOf(held, "shared").line, e.line + 30), `${dock}: the edge at the pointer`);
    if (dock !== "below") {
      assert.ok(
        near(Math.min(held.box.x, held.page.x), Math.min(out.box.x, out.page.x)),
        `${dock}: the group's start holds`,
      );
      assert.ok(near(held.box.w + held.page.w, out.box.w + out.page.w), `${dock}: the total holds`);
    }
  }
});

test("Vertical: the picture's top fights the anchor — its bottom holds while held, the release settles under the bar", () => {
  const s = state({ dock: "below", page: { kind: "pic", ratio: 3 / 4, scale: 0.7 } }),
    out = layoutPass(s),
    e = edgeOf(out, "page.top"),
    held = layoutPass({ ...s, drag: { edge: "page.top", at: e.line + 40 } });
  assert.ok(near(held.pic.y, out.pic.y + 40, 1), "held: the top at the pointer");
  assert.ok(near(bottom(held.pic), bottom(out.pic), 1), "…the bottom holds");
  const after = layoutPass(release(s, held.kept));
  assert.equal(after.page.y, out.page.y, "let go: the group back under the bar");
});

test("Vertical: the default is the picture at its largest (picture first — Reset), the box at its least below it", () => {
  const def = layoutPass(state({ dock: "below", page: { kind: "pic", ratio: 3 / 4 } })),
    max = layoutPass(state({ dock: "below", page: { kind: "pic", ratio: 3 / 4, scale: 1 } }));
  assert.deepEqual(
    def.pic,
    max.pic,
    "the default IS 100 %: the biggest picture (it used to shrink it for the box's text)",
  );
  assert.equal(def.box.h, 108, "…the box at its least (its text scrolls)");
  assert.ok(Math.abs(def.pic.w - def.largest.w) <= EPS, "…and that is its largest");
});

test("the edit buttons: the layout's count is the markup's (one column of them sets a picture's least height)", async () => {
  const { readFileSync } = await import("node:fs"),
    src = readFileSync(new URL("../../../app/state.js", import.meta.url), "utf8"),
    body = src.slice(src.indexOf("function sideButtons"), src.indexOf("} /* the other buttons"));
  assert.equal((body.match(/<button/g) || []).length, EDIT_TOOLS, "state.js sideButtons builds EDIT_TOOLS buttons");
});

test("Vertical: between the pane and the box lie its status row, the gap and the box's name row (C4b step 1b)", () => {
  const base = state({ dock: "below", page: { kind: "pic", ratio: 3 / 4 } }),
    o = layoutPass({ ...base, page: { ...base.page, row: 30 }, box: { ...base.box, title: 64 } }),
    bare = layoutPass(base);
  assert.ok(
    Math.abs(o.box.y - bottom(o.page) - (30 + base.gap.pair + 64)) <= EPS,
    "the box's top: the pane, its row, the gap, the name row",
    { y: o.box.y, pageBottom: bottom(o.page) },
  );
  assert.ok(bottom(o.box) <= 1080 - 20 + EPS, "…and the box still fits the room");
  assert.ok(o.pic.h < bare.pic.h, "the picture's largest gives up that room (the picture first, the rows kept)");
});

test("Vertical: the box's LoRA row (its foot) is kept under it — the picture's largest gives it up (C4b)", () => {
  const base = state({ dock: "below", page: { kind: "pic", ratio: 3 / 4 } }),
    o = layoutPass({ ...base, box: { ...base.box, foot: 36 } }),
    bare = layoutPass(base);
  assert.ok(bottom(o.box) + 36 <= 1080 - 20 + EPS, "the box and its LoRA row fit the room", { b: bottom(o.box) });
  assert.ok(Math.abs(bare.pic.h - o.pic.h - 36) <= EPS, "the picture gives exactly the row's height", {
    bare: bare.pic.h,
    h: o.pic.h,
  });
});

/* C4c (ux-review/16-layout-pass.md C4, rule 4): Vertical's drags through the pass */
const vState = (o = {}) => state({ dock: "below", page: { kind: "pic", ratio: 16 / 9 }, ...o });

test("Vertical: the shared edge trades — the group's bottom holds, the page's loss is the box's gain, both kept (C4c)", () => {
  const s = vState(),
    rest = layoutPass(s),
    line = edgeOf(rest, "shared").line,
    held = layoutPass({ ...s, drag: { edge: "shared", at: line - 80 } });
  assert.ok(near(bottom(held.box), bottom(rest.box), 1), "the box's bottom holds", {
    was: bottom(rest.box),
    now: bottom(held.box),
  });
  assert.ok(near(rest.page.h - held.page.h, 80, 1), "the page 80 shorter", { was: rest.page.h, now: held.page.h });
  assert.ok(near(held.box.h - rest.box.h, 80, 1), "the box 80 taller", { was: rest.box.h, now: held.box.h });
  const after = layoutPass(release(s, held.kept));
  assert.ok(sameRect(after.page, held.page, 1) && sameRect(after.box, held.box, 1), "let go: nothing moves", {
    held: [held.page, held.box],
    after: [after.page, after.box],
  });
});

test("Vertical: an outer edge never changes the other pane — the page's side grows into free room only (C4c, B17)", () => {
  const s = vState({ page: { kind: "pic", ratio: 3 / 4 }, box: { ...state().box, text: 300 } }),
    rest = layoutPass(s);
  for (const id of ["page.left", "page.right", "page.top"])
    for (const d of [-400, 400]) {
      const e = edgeOf(rest, id),
        held = layoutPass({ ...s, drag: { edge: id, at: e.line + d } });
      assert.ok(near(held.box.h, rest.box.h, 0.5), `${id} ${d}: the box's height holds`, {
        was: rest.box.h,
        now: held.box.h,
      });
      assert.ok(held.kept.boxH == null || near(held.kept.boxH, rest.box.h, 0.5), `${id} ${d}: …and is kept as it was`);
    }
});

test("Vertical: the box's bottom sets its height (yours) — into the free room only, its LoRA row kept, then the rubber band (C4c, A)", () => {
  const s = vState({ page: { kind: "pic", ratio: 21 / 9 }, box: { ...state().box, foot: 36 } }), // free room under it
    rest = layoutPass(s),
    e = edgeOf(rest, "box.bottom"),
    up = layoutPass({ ...s, drag: { edge: "box.bottom", at: e.line + 40 } });
  assert.ok(near(up.kept.boxH ?? 0, rest.box.h + 40, 1), "40 down: 40 taller, kept", { kept: up.kept.boxH });
  assert.ok(near(up.page.h, rest.page.h, 0.5), "…the page untouched");
  const far = layoutPass({ ...s, drag: { edge: "box.bottom", at: e.line + 3000 } });
  assert.ok(
    (far.kept.boxH ?? 0) + far.box.y + 36 <= 1080 - 20 + EPS,
    "far down: kept inside the room, the LoRA row under it",
    {
      kept: far.kept.boxH,
    },
  );
  assert.ok(bottom(far.box) - (far.box.y + (far.kept.boxH ?? 0)) <= RUBBER + EPS, "…shown past it by the give only");
  const after = layoutPass(release(s, up.kept));
  assert.ok(sameRect(after.box, up.box, 1), "let go: the box stays (Custom)", { held: up.box, after: after.box });
});
