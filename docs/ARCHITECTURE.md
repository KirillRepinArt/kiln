# How Kiln is built

Kiln is two programs on your own computer: a small **server** (Python, standard library only) that keeps the queue
and talks to the image generator, and a **page** (plain HTML, CSS and JavaScript modules, no build step) that you
see in a browser window. They talk over HTTP on `127.0.0.1`. Nothing else is involved: no database server, no
framework, no internet.

```
  kiln.bat ──► python -m server --launch ──► finds or starts ──►  server  (python -m server)
                                                                    │  queue · worker · pictures
  browser window  ◄── index.html + app/ ◄───── HTTP on 127.0.0.1 ───┤  /api/…  (JSON)
     (the page)   ──── polls /api/state ───────────────────────────►│
                                                                    └──► Forge Neo's API (/sdapi/v1/…)
```

Why it's built this way is in `docs/decisions/`. How to change the look is in `docs/CUSTOMIZING.md`.

## The server (`server/`)

`server/__init__.py` lists every module. From the bottom up:

| Module | Job |
|---|---|
| `config` | settings (`config.local.json` over the defaults, `KILN_*` environment variables over both) and `Paths`: the program's files apart from your data |
| `images`, `naming`, `timings` | pure helpers: PNG text chunks, file names (numbers never reused), time estimates from your own runs |
| `jobqueue` | the job list: one lock, saved to `data/queue.json` on every change, a revision the page polls against |
| `pictures`, `recyclebin` | finished pictures on disk: delete with Undo (then the Recycle Bin), rename, put back, thumbnails |
| `backends/` | the image generator behind one interface (`base.py`: `Backend`); `forge.py` is the only file that knows Forge's API |
| `catalog` | what the generator offers (checkpoints, LoRAs, upscalers), with Kiln's own additions, cached |
| `worker` | one job at a time: take the next, have the backend render it, save the picture |
| `lifecycle` | is a Kiln window still open? stop when it closed and the queue is done |
| `instance` | one Kiln per data folder (an OS lock), a port of its own (`data/instance.json`), `/api/hello` |
| `page`, `web` | the page as served, and the HTTP API: a table of routes, one method each |
| `main`, `launch` | putting it together; the launcher behind `kiln.bat` |

Threads: the HTTP server (one thread per request), the worker, the generator's health check, the window watchdog.
They share the job list through `JobQueue.lock`.

**Your data** (`data/`, git-ignored): `queue.json` (the jobs), `history.json` + `stats.json` (time estimates),
`names.json` + `ids.json` (numbers never handed out twice), `flags.json` (paused), `trash/` (the Undo window),
`thumbs/` (LoRA pictures), `qthumbs/` (the Queue's small pictures), `kiln.log` (rotated), `kiln.lock` +
`instance.json` (the running server). The pictures themselves go to `outputs/`, each with its settings inside.

## The API

The page polls `GET /api/state`. With `?since=<signature>` the answer is light when nothing changed but the running
job's progress (500 jobs were ~1 MB a poll before). Changes are `POST`s: `/api/jobs` (add), `/api/jobs/<id>/cancel |
remove | delete | undelete | name | rename | recycled | restore | saveback`, `/api/reorder`, `/api/pause`,
`/api/upscale`, `/api/clear`, `/api/remove-missing`, `/api/open`, `/api/reveal`, `/api/thumb`, `/api/qthumb`,
`/api/estimate`, `/api/update-check`, `/api/bye`. Also `GET /api/models`, `/api/nextname`, `/api/preview/<id>`,
`/api/hello`, and the files: `/files/` (pictures, never cached), `/app/`, `/docs/`, `/thumbs/`, `/qthumbs/`. Every answer is
JSON; an error is `{"error": "…"}` with its HTTP status.

## The page (`index.html`, `app/`)

Plain ES modules, loaded by the browser as they are. `app/main.js` starts everything, in a fixed order; every other
file only declares (each has an `init<File>()` that `main.js` calls). The parts:

- **Models: one place for each kind of state, changed only through it.** `jobs.js` (the job list), `prompt.js` (your
  draft and the job shown instead), `picstate.js` (what the picture area shows, a state machine:
  `ux-review/11-picture-states.md`), `layout.js` + `layoutmath.js` (the layout: pure maths, unit-tested),
  `cardlayout.js` (the prompt card). The rest of the page reads them and draws.
- **One owner for everything that moves or shows** (`docs/decisions/0012-one-owner-baseline.md`) — each property has one
  module that writes it; what depends on it is derived from it:
  - what a page keeps room for, its geometry and every fade's timing: `layoutmath.js` (`pageInsets`, `pageGeometry`,
    `fades`, `shapeSteps`, `promptSlotH`; the prompt box's glue as a relation to its plate and its change of relation,
    `glueAnchors` / `relationOf` / `glued` / `relationFade` — pure, unit-tested)
  - the layering rule (`glass.css`, its last rule; DEVLOG DD-2026-11-08-14): materials float (the plate, the prompt box, the tab bar, pop-ups, cards); what sits on one is content — no backdrop blur of its own, a translucent fill — so a page or the box's contents fade as one layer. A scroll area ends where the controls on it begin, its scroll edge at its own edge, never over its scrollbar (`prompt.css`)
  - **every opacity fade: `fade.js` `fade(el, to, timing, { from, span, glass, pseudo, end })` — the one way** (R1, the
    re-read 2026-11-10): it starts from what is on screen (a fade replacing a running one carries on from its value;
    a fresh one from the caller's `from`), replaces the fade it read, and with `end` leaves its final value; `setOpacity`
    sets at once. `tools/tests/unit/onefade.test.mjs` fails on an opacity animation anywhere else. Glass by its parts:
  - every fade of something that holds glass: `fade.js` (`glassFade` — by its parts, never an ancestor's opacity; an element whose opacity has an owner of its own says so in the markup, `data-fade-owner` — the picture's canvas, its copy and the empty-frame text are `pictures.js`'s, which fades them with their view itself, `pictureWithView`, added to its own fades)
  - **the slot under the picture: one occupant, its room kept by the pass** (A1, 2026-11-11) — `layoutmath.js`
    pageInsets' `row` is `"bar"` (the status row), `"prompt"` (Show prompt: `browse.js` showPromptOn, the one predicate
    for its being shown and its room) or none; `layout.js` rowRoom is the occupant's height; the status row shows only
    as the occupant (`body.norow`)
  - the picture frame's box: `framebox.js` (where it is, `frameBox`; where the layout wants it, `frameTarget`); what sits
    round it (status row, buttons, edge strips, and the page's side handles side by side — a picture's from the plate,
    a panel's from its box: `placeSideEdges`; the picture's arrows, `browse.js` `placeNavs`, called from it — the one you hold stays put, let go it catches up on the driver): `around.js`, in the frame the frame is written. **The floating layer:** the picture's controls (the eye `#cbtn`, ✕ `#bclose`, the edit buttons `#gtools`) and its edge strips (`#hedges`) live outside every page, in the page area's own layer (`#rpanel` — a page fades as one, and glass never sits inside it: the layering rule), placed by `around.js`; there the handles stay over the controls (z 7 over 6: one home per strip — the stage is a stacking context of its own, so strips inside it lost to any control outside it). "The pointer is on the picture" is one decider, `body.navs` (`edges.js`: the frame, the edit buttons, the arrows, the eye, ✕). No geometry of a moving part has a CSS transition or animation of its own (T2c-5; `plate.test.mjs` `plateIsItsElement`)
  - the glass plate, the tab bar, and every tab switch's motion (one clock): `plate.js` (`switchGlide`, `placeBar`); a
    switch's target is the frame owner's goal (`goalBox` → `frameTarget`), never the hidden frame measured
  - going to a page — a tab, the Add LoRA button, a LoRA chip, a Queue row, PNG Info's load, Reset layout, ✕ back: ONE
    way, `tabs.js` `goView(page, then)` → `tabGo` (the switch's one motion); nothing calls `showView` on its own
  - the prompt column's place (its glue to the plate; its catch-up after a hold on the driver, `"hug"`; its lift while you move it, L1 `liftCol`): `layout.js` (`promptFollow` → `colApply`); moving the box is one drag over seven places, `cardlayout.js` (lanes and a footprint from `layout.js` `placeFor` — the layout pass for that place, which asks `orient()` / `dockNow()`, the one place that says which layout is computed);
    "the layout lands at once" during a motion: `layout.js` `snapHold`
  - **what the frame's canvas shows: `pictures.js` alone** (R3, 2026-11-10) — `frameRender` / `frameRenderPicture`
    (a render and its previews; progress.js only fetches them), `frameDone` (a finished picture), `frameEmpty`,
    `frameForget`; so its rules (a held picture fades off the new one, into an empty frame a picture fades in) hold for
    every picture. `tools/tests/unit/onepicture.test.mjs` fails on a write to `#cv` anywhere else
  - the frame's two pictures' opacity (the old one's copy leaving, the new one coming): `pictures.js`; a shape change's
    crop-and-reveal drives the frame through `framebox.js` and hands its timing over (`morph.js`)
  - paint order: **one named list per stacking context** in `styles/tokens.css` (THE LAYERS, P2 2026-11-11) — every
    z-index is `var(--z-…)`, Stylelint rejects a number; the app's list holds the drop map's slot (`--z-app-drop-map`)
  - **the layout model** (v0.7c, `docs/decisions/0013-layout-tree.md`): your **sizes** — one per pane × page ×
    orientation, kept in `S.lay` v4 — are written only through `layout.js` `setPaneSize` and read through `paneSize`;
    the **group** and its **placement** come from `layoutmath.js` `arrange` (panes glued with one gap, a resting anchor,
    a pin while an edge is held); past a limit `rubber` (one stretch, `RUBBER`; a picture past its room `PIC_OVER`)
  - **the single layout pass** (v0.7c C, `ux-review/16-layout-pass.md` in the design notes): `layoutmath.js`
    `layoutPass` computes every page's numbers side by side (a panel's width, height and place too) and in Vertical at rest (C4b: the page's pane on top, the box under it — its text's height in the free room only, then it scrolls; `layout.js` `vPass` → `lay.passV`) — the picture's size (a scale of its largest), its
    place, the box's, the edit buttons' strip (`stripRoom`: its room kept on both sides of the centred pair). The
    appliers write them in ONE coordinate space: side by side the page area (`#right`) is the whole room and never
    moves (in Vertical too since C2b's rest: a panel is the pass's rectangle there as well, written by `sizeFrame`'s `panelWrite` on the rearrangement — no centred column, no CSS width transition); the prompt column (`#lcol`) is a layer over the same room in both layouts (no grid row of its own in Vertical since C4b), taking the pointer only on its parts, and the box
    in it has its own width (`--cw`, `layout.js` `boxWWrite`) — no grid columns (DEVLOG DD-2026-11-08-1; the
    platforms' rule: what moves in a transition lives in one still space). A panel's box is placed in
    the area by `sizeFrame`, its handles by `around.js` `placeSideEdges`). **The box's place side by side has ONE rule:**
    `layout.js` `promptFollow` glues it one pair gap from the plate as it is on screen this frame — a picture's or a
    panel's, at rest, held, in a switch, in a resize — called by whatever moves the plate (`framebox.js` on a frame
    write, the driver's frames in a switch, the box's width on the rearrangement, the driver's frames); in a switch it rides the travelling plate by its relation; a hold let go (the plate moved while you worked in the prompt) catches up on the driver (`"hug"`), bent by a new goal, never a jump. **In Vertical** the box's place is the pass's (`cardlayout.js` `layoutLeft` writes it; its width `--sw` through `swAt`, on the driver for a change the system makes, at once under your hand), and `promptFollow` rides it on its pane's plate as it is on screen (its offset from the pass's bottom, at once — the plate is its clock); the divider (`vAlign`) from the pass too.
    Held or not: every side-by-side edge
    of a picture page (the box's outer edge, the shared edge, the picture's outer, top and bottom edges) goes through
    `layout.js` `passDragStart` / `passDragMove` / `passDragEnd` — the press freezes the sizes, the pointer is the
    drag's constraint, the pass gives every number, the release keeps its `kept` (C3; a panel's edges too, its top and
    bottom included). The room's top on screen: `layout.js` `sideRoomTop` (with `sideRoom`, one box). An outer edge takes no room from
    the other pane; only the shared edge trades. Where the group starts: `layoutmath.js` `groupX` (the rectangles and
    the drags' maths both). The edit buttons' strip is ONE column (`toolColumnW`), and a picture's least height is that
    column (`picLeastH`): the strip never depends on the picture's height. No side-by-side edge has maths of its
    own (`layDrag` is gone), and since C4c no Vertical edge either: every edge of both layouts is wired by `edges.js` `passEdge` to the same three calls (Vertical's shared edge pushes the box into the empty room under it first, then trades — C6; the box's bottom sets its height — Custom, kept in `paneSize("box", "vert").h` — and outer edges take no room from the other pane). Side by side the box's top and bottom edges set its height too (Custom, `paneSize("box", "side").h`, C6): their gesture holds `card.hHold`, which the pass's one placement rule (`layoutmath.js` `cardPlacement`) reads — the other side holds, or, resting in the middle, mirrors; a double-click (`passDouble`) gives it back to its text; one handle per strip; every pane's resize band is one rule — from 1 px inside its edge out to its outline (`layout.css` `--band`, B19) — and a shared edge has a band on each pane (side by side the divider's two; in Vertical the page's bottom and the box's top, B19b). The room side by side has one definition: `layout.js` `sideRoom`
  - **a pane's change of relation: ONE table** (L1a, 2026-11-11) — `layoutmath.js` `RELATION_ROWS` / `relationMotion`:
    keyed by (pane, partner, cause, change) → a pattern (travel / fade / ride) and its timing; `tabs.js` tabGo applies it
    (`setDock(dock, cause)`: your hand → travel — the box goes on from where it was let go on the switch's clock,
    `rearrange.js` travel("lift"); the menu → fade through, `fadeCol`). The box (with the plate) is its first user;
    the mechanics (the column, the lift, the stand-in) are the box's until a second pane moves (2b)
  - **a layout switch** (Left / Right / Vertical, the Layout menu and drag-to-dock alike): `tabs.js` `tabGo(fn, true)` —
    the tab switch's owner with the SAME view. The plate: on a picture page the SAME picture scales with its pane — `tabGo`
    declares the change as a scale (`framebox.js` `pictureChange({ scale })`), `morph.js` lets the frame travel on the
    driver and the picture fills it every frame (no copy, no swap; the crop-and-reveal is for another picture —
    browsing); the plate rides the frame; on a panel `plate.js` `switchGlide` moves the plate by the steps and the view's contents RIDE it — laid out
    at their final place and size, kept on the plate's centre, clipped by it (a pure move travels, a size change crops
    and reveals: the picture's rule). Contents fade only when they are other contents (a tab switch).
    The prompt box stays GLUED to the live plate and fades through its change of relation (beside / under): out by the
    old relation, in by the new one as the plate lands (`layoutmath.js` `glueAnchors` / `relationOf` / `glued` /
    `relationFade`; `layout.js` `fadeCol` sets it, `colApply` — the column's one writer — places the box every frame
    the plate moves; DEVLOG DD-2026-11-08-7). Its place where it lands is glued to where the plate lands (`plate.js`
    `glueRect`) and the relation's offset from the live plate rides on top of it. What leaves is its STAND-IN
    (`layout.js` `standIn`: a copy of the name row, the box and the chips where they were, made before the change, in a
    layer over the page; nothing reads or writes it), while the box itself is laid out where it lands from the first
    frame — everything that measures the box measures the truth (Android's overlay for a leaving view, UIKit's
    snapshotView; a copy of the elements, not a picture, so the glass stays live). Letting go ends a press before
    anything acts on the release (`layout.js`: the pointerup's capture phase).
    **Glass fades by its parts:** anything that holds glass fades through `fade.js` `glassFade` — each glass layer by its
    own opacity, each glass-free part as a whole, never by an ancestor's opacity (an element below 1 is a backdrop root:
    the glass inside loses its blur; DD-2026-11-08-8). **The material is one layer:** in glass mode a glass element's
    tint, ring and shadow are all on its `::before`, the element paints nothing (`glass.css`; DD-2026-11-08-9). No View
    Transitions (`docs/decisions/0014`). Every change moves on ONE driver (`rearrange.js`): the plate travels on it in
    a switch, the frame's crop-and-reveal too, the box follows; the plate is derived from its element — whoever writes
    the frame or a panel's box calls `plateSync` in the same frame (no loop of its own since T2c-4)
  - **a rearrangement on the same page** (a Reset, a double-click, a panel's height, a ratio change, the room changing):
    `rearrange.js` is the ONE applier — each owner hands it its box's from → to in the same task (`framebox.js` the
    frame, `layout.js` `layApply` the box's width, `sizeFrame` a panel's box side by side); one plan
    (`layoutmath.js` `shapePlan`: what shrinks crops first, what grows reveals last, a pure move the switch's length)
    and one start time; every frame the writes, then the plate and the glued box. The area's px are the window's less
    one constant (`layout.js` `areaX`): nothing converts mid-motion. A tab switch keeps `plate.js`
    `switchGlide` on the same steps. The box's name row, box and grip have no width transition (`--cw` drives it);
    the scrollbar's thumb shows only at rest (`editor.js`, `.settling`, while `rearrange.js` moves the box — told by
    the box's owner when the move is asked). The box's top, height and chips row: ONE writer, `cardlayout.js`
    `boxWrite` (its drag too), moved by the rearrangement on the progress of the picture it's anchored to
    (`rearrange(…, "frame")`: a dependent moves on its source's progress); in Vertical its top rides its pane's plate
    (`promptFollow`) and only its height moves on the plan. A new goal for a box already moving bends
    its remaining path on the same plan and clock (`rearrange.js` `retarget`); only a box not yet moving starts a new
    plan
  - **every drag: `gesture.js` `gesture(el, { accept, threshold, start, move, end, cls, escape, prevent })` — the one
    way** (G1, 2026-11-10): press → past its threshold (`DRAG_START`: edge 0, lift 6, scrub 3, pan 4) a drag → end,
    exactly once however it ends (button up, cancel, a lost capture, the button found up, Esc where allowed); a tap is
    an end with `moved: false`; the pointer is heard on the window while a press is pending and captured once it's a
    drag; the click after a drag is swallowed. Users: the edges (`edges.js` edgeDrag — its outlines), the box's move
    (`cardlayout.js`), the Queue's reorder, the LoRA weight's scrub, the viewer's pan. `unit/onegesture.test.mjs`
    fails on a pointer capture anywhere else. Named: the LoRA chips' reorder is the browser's native drag-and-drop.
    Which outlines show: `outlines.js`; the outline itself is part of its pane (`.plate::before`, `.left::after`)
  - a panel's box (its height and its offset in the room: the pass's side by side) and where its edge handles go:
    `layout.js` `sizeFrame`;
    the tab bar rides on the plate, centred over it inside the window (`plate.js` `barFor`)
  - the prompt box's least width: what its bottom row needs (Start, the pills at their compact labels, the insets) —
    `cardlayout.js` `boxWLeast`, never under `PWMIN`; every limit, the pass and Vertical's width read it
  - **every leaving copy: `leave.js` `leaveCopy(parts)` — the one way** (R2, 2026-11-10): what leaves is a copy of
    what was on screen (clones in a layer of their own, each marked `data-copy-of` its original), the real thing at
    its end state from the first frame; `release(timing)` fades it through `fade()` and removes it when that fade is
    over or cancelled — a copy lives exactly as long as its leaving. Users: the prompt box's stand-in in a layout
    switch (`layout.js` standIn → fadeCol), the status row leaving (`rowFade`, G11). Named exception: the picture's
    `#cvx` (it lives in the frame, clipped by the crop-and-reveal, and holds until the next picture — `pictures.js`).
    The tracer reads an element and its copies as one thing
  - **who takes the pointer: a rule, not a list** (R4, 2026-11-10): a container that only lays things out passes the
    pointer (Vertical's picture area, the tab bar's box, the prompt column); what draws or acts takes it by its own CSS
    rule (`pointer-events: auto` on the frame, the status row, Show prompt, a panel, the tab bar's buttons, the
    picture's controls) — and an unseen control takes none (V6). `tools/tests/pointer.test.mjs` checks every visible
    control takes its own press, in every layout and state it reaches
  - a view (a page) has no motion of its own: shown or not (`visibility`); the switch moves and fades it (T6)
  - where a message shows (the toast, the finished note): ONE placer, `boot.js` `placeMessage(el, anchor)` — it writes
    left / top only; under its anchor (a tab, the Layout button), else by the prompt box (Vertical: the top-right corner)
- **The screen, by area:** `tabs`, `browse`, `morph`, `edges`, `pills`, `chips`, `peek`, `queue`, `loras`, `pnginfo`,
  `viewer`, `settings`, `keys`, `tooltips`, `editor` (CodeMirror).
- **The server's side:** `live.js` (start), `sync.js` (polling, what changed), `actions.js` (requests), `pictures.js`
  (images, previews, the cache), `progress.js`, `forge.js`.
- **The look:** `app/styles/` (tokens, then one file per part of the screen, then the skins), `effects.js` + `skins.js`
  (the backgrounds and covers: canvas, cheap on a GPU that's busy generating), `tokens.js` (the values the scripts read
  from the CSS), `livestyles.js` (style changes taken without a reload).
- **Shared:** `dom.js` (typed element helpers), `state.js` (settings, saved in the browser), `presets.js`, `types.js`
  (the data shapes, for the type checker), `testing.js` (the tests' handle, only with `?test`).

Types: JSDoc in the files, checked by TypeScript (`tsc`, a dev tool, strict) — every file in `app/` except `vendor/`.

## Tests and checks

| | What | Where |
|---|---|---|
| unit, page | the pure logic (layout maths, the job list) | `tools/tests/unit/*.test.mjs`, `npm run test:unit` |
| unit, server | the server's logic, the instance lock, the network-call list | `tools/tests/unit/test_server.py`, `npm run test:server` |
| end to end | the real app: a fake Forge (`tools/fake_forge.py`), the server, a headless Edge, per test | `tools/tests/*.test.mjs`, `node tools/tests/run.mjs` |
| ownership | the tracer (`tools/tests/trace.mjs`) records every writer of what moves or shows, by module, while a tour (`trace.test.mjs`) runs every kind of motion; it fails on a second writer, two clocks in one motion, a blink. Known cases in its baseline (`ALLOW`, empty since 2026-11-01) | `node tools/tests/run.mjs trace` |
| proofs | a refactor changes nothing: computed styles (`cssdiff`), API answers (`tools/dev/api-same.py`), syntax trees (`tools/dev/ast-same.mjs`) | run by hand when one applies |
| static | ESLint, Stylelint (incl. the token rule), Prettier, Ruff, mypy `--strict`, `tsc`, the privacy scan | the commit hook and CI |

CI (`.github/workflows/ci.yml`): the static checks and unit tests on Linux, the end-to-end tests on Windows.
