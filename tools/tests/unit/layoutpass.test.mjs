// Unit tests for the single layout pass (app/layoutmath.js layoutPass; ux-review/16-layout-pass.md), at rest: the
// rules checked over a generated grid — every layout × page (six ratios and a panel) × window × box mode — not picked
// cases. Run with `npm run test:unit`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutPass, HANDLE, PICHMIN, PWMIN, RUBBER } from "../../../app/layoutmath.js";

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
      roomW = s.dock === "below" ? s.W - 2 * GAP.area - 2 * STRIP : s.W - 2 * GAP.area - out.box.w - GAP.pair - STRIP,
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
    half.forEach((o, i) => assert.ok(Math.abs(o.pic.w - 0.6 * at[i].pic.w) <= EPS, `${dock}: 60 % of its own largest`));
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
  /* 1100: the box at 680 would leave the picture under its least; at 900 even both at their least don't fit (past
     what any layout can do: not this rule's case) */
  const tight = layoutPass(state({ W: 1100, page: { kind: "pic", ratio: 21 / 9 } }));
  assert.ok(tight.box.w < 680 && tight.box.w >= PWMIN, `narrow: the box gives (${tight.box.w})`);
  assert.ok(Math.abs(tight.pic.h - PICHMIN) <= EPS, "…only once the picture is at its least");
});

test("Vertical: the group's top one gap under the bar; the box keeps its text, the picture takes the rest", () => {
  const o = layoutPass(state({ dock: "below", page: { kind: "pic", ratio: 3 / 4 } }));
  assert.equal(o.page.y, 20 + 52 + 12);
  assert.equal(o.box.h, 150, "the box: its text");
  assert.ok(Math.abs(bottom(o.box) - (1080 - 20)) <= EPS, "a height-bound picture fills down to the box");
  assert.ok(Math.abs(o.pic.x + o.pic.w / 2 - 880) <= EPS, "centred");
  const tall = layoutPass(state({ dock: "below", box: { ...state({}).box, text: 2000 } }));
  assert.equal(tall.box.h, 600, "a long text: up to its largest, then it scrolls");
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
  box: { ...s.box, w: kept.boxW },
  page: s.page.kind === "pic" ? { ...s.page, scale: kept.scale } : { ...s.page, w: kept.w, h: kept.h },
});
const near = (a, b, tol = EPS) => Math.abs(a - b) <= tol;
const sameRect = (a, b, tol = EPS) =>
  near(a.x, b.x, tol) && near(a.y, b.y, tol) && near(a.w, b.w, tol) && near(a.h, b.h, tol);
/* the box's height edges have nothing to set (its height is its text's); Vertical's picture top fights the anchor */
const GIVES_ONLY = new Set(["box.top", "box.bottom"]);
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
    if (GIVES_ONLY.has(id)) continue;
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

test("Vertical: by default the box keeps its text; at 100 % the picture wins and the box is squeezed to its least", () => {
  const def = layoutPass(state({ dock: "below", page: { kind: "pic", ratio: 3 / 4 } })),
    max = layoutPass(state({ dock: "below", page: { kind: "pic", ratio: 3 / 4, scale: 1 } }));
  assert.equal(def.box.h, 150, "default: the box keeps its text");
  assert.ok(max.pic.h > def.pic.h, "100 %: a taller picture");
  assert.equal(max.box.h, 108, "…the box at its least (its text scrolls)");
  assert.ok(Math.abs(max.pic.w - max.largest.w) <= EPS, "…and that is its largest");
});
