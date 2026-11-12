// Phase 2a step 2: docking the prompt — Layout presets and drag-to-dock.
const R = (k, sel) => k.rect(sel);
const viewport = (k, w, h) =>
  k.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
const stacked = k => k.ev(`document.querySelector(".app").classList.contains("stacked")`);
const menu = async (k, v) => {
  await k.ev(`($("layBtn").click(),1)`);
  await k.sleep(150);
  await k.ev(`(document.querySelector('#layMenu [data-lay="${v}"]').click(),1)`);
  await k.sleep(800);
};
/* the drop map's lit tile (L1b — the tile under the pointer): its place, or null; and the dock it would land in if it's
   another one (it was the footprint, and before it the dock zone "near") */
const hotTile = k =>
  k.ev(
    `(()=>{const f=document.querySelector(".droptile.hot");return f?{dock:f.dataset.dock,pos:f.dataset.pos}:null})()`,
  );
const nearZone = k =>
  k.ev(
    `(()=>{const f=document.querySelector(".droptile.hot");if(!f)return null;const now=document.querySelector(".app.stacked")?"below":S.dock||"left";return f.dataset.dock===now?null:f.dataset.dock})()`,
  );
/** press the box's grip at (x, y), start the drag, carry the pointer onto the drop map's tile {dock, pos} (its centre,
 * or `off` px from it) — returns where the pointer is; the caller lets go */
async function dragToTile(k, x, y, dock, pos, off = { x: 0, y: 0 }) {
  await press(k, x, y);
  await moveTo(k, x, y, x, y + 12); // past the lift's threshold: the map shows
  const r = await k.ev(
    `(r=>r&&{x:r.left+r.width/2,y:r.top+r.height/2})(document.querySelector('.droptile[data-dock="${dock}"][data-pos="${pos}"]')?.getBoundingClientRect())`,
  );
  if (!r) throw new Error(`no drop tile ${dock}/${pos}`);
  await moveTo(k, x, y + 12, r.x + off.x, r.y + off.y);
  return { x: r.x + off.x, y: r.y + off.y };
}
async function press(k, x, y) {
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
}
async function moveTo(k, x0, y0, x1, y1) {
  for (let i = 1; i <= 10; i++)
    await k.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x0 + ((x1 - x0) * i) / 10,
      y: y0 + ((y1 - y0) * i) / 10,
      button: "left",
      buttons: 1,
    });
}
const release = (k, x, y) =>
  k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
async function drag(k, sel, dx) {
  const h = await R(k, sel),
    x = h.left + h.width / 2,
    y = h.top + Math.min(200, h.height / 2);
  await press(k, x, y);
  await moveTo(k, x, y, x + dx, y);
  await release(k, x + dx, y);
  await k.sleep(600);
}

export async function presets(k, t) {
  const AREA = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap-area"))`); // between the prompt and the picture
  await viewport(k, 1700, 950);
  await k.mouse(2, 2);
  await k.sleep(600);
  await menu(k, "right");
  /* in Generating the prompt's place is stated against the picture (#plate), the edge you see — the area is the whole
     stage (G6, 2026-10-31) */
  let L = await R(k, "#left"),
    Rr = await R(k, "#plate"),
    col = await R(k, "#right");
  t.ok(
    L.left > Rr.right &&
      Math.round(L.left - Rr.right) === AREA &&
      Math.abs((await R(k, "#lcol")).top - col.top) < 2 &&
      col.bottom <= 950,
    "Horizontal · prompt on the right: right of the picture, same row, the area gap",
    { L: L.left, R: [Rr.right, Rr.top, Rr.bottom] },
  );
  t.ok(Math.abs(Rr.left - AREA - (1700 - AREA - L.right)) <= 3, "the pair is centred");
  t.ok(
    await k.ev(`document.querySelector('#layMenu [data-lay="right"]').classList.contains("on")`),
    "the menu ticks the current preset",
  );
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(500);
  /* the panel itself (the area is still since C2b, the panel in it); an outer edge is a constraint on a centred axis
     (DD-2026-11-03-6): the far side mirrors, so a pull of `room` widens it by twice that — half the free room each */
  const a = Math.round((await R(k, "#rpanel")).width),
    room = Math.min(30, Math.floor((Math.round((await R(k, "#rpanel")).left) - AREA - 4) / 2));
  await drag(k, ".pedge.ro", -room);
  await k.mouse(2, 2);
  await k.sleep(500);
  const b = Math.round((await R(k, "#rpanel")).width);
  t.ok(
    room > 10 && Math.abs(b - (a + 2 * room)) <= 1,
    "mirrored edges: the image area's (now left) outer edge, dragged left, widens it",
    { a, b, room },
  );
  const pw0 = Math.round((await R(k, "#left")).width),
    room2 = Math.min(25, Math.floor((1700 - AREA - Math.round((await R(k, "#left")).right) - 4) / 2));
  await drag(k, ".pedge.po", room2);
  await k.mouse(2, 2);
  await k.sleep(500);
  t.ok(
    room2 > 10 && Math.abs(Math.round((await R(k, "#left")).width) - (pw0 + 2 * room2)) <= 1,
    "…and the prompt's (now right) outer edge, dragged right, widens the prompt",
    { pw0, room2 },
  );
  await menu(k, "below");
  t.ok(await stacked(k), "Vertical: stacked even on a wide window");
  L = await R(k, "#left");
  const f = await R(k, "#frame");
  t.ok(L.top > f.bottom, "the prompt is under the picture");
  await k.reload();
  await k.sleep(800);
  await k.until("!!(window.LIVE&&window._jobsReady)", 15000);
  await k.sleep(800);
  t.ok(await stacked(k), "remembered after a restart");
  await menu(k, "left");
  t.ok(
    !(await stacked(k)) && (await R(k, "#left")).right < (await R(k, "#plate")).left,
    "Horizontal · prompt on the left: back beside it",
  );
}

export async function narrowKeepsChoice(k, t) {
  await viewport(k, 1700, 950);
  await menu(k, "right");
  await viewport(k, 900, 900);
  await k.sleep(700);
  t.ok(await stacked(k), "a narrow window stacks even with the prompt docked right");
  await viewport(k, 1700, 950);
  await k.sleep(700);
  t.ok(
    !(await stacked(k)) && (await R(k, "#left")).left > (await R(k, "#plate")).right,
    "wide again: back on the right",
  );
}

export async function dragToDock(k, t) {
  await viewport(k, 1700, 950);
  await k.mouse(2, 2);
  await k.sleep(600);
  let n = await R(k, "#ltitle"),
    p = await dragToTile(k, n.left + 20, n.top + n.height / 2, "right", "mid");
  const z1 = await nearZone(k);
  await release(k, p.x, p.y);
  await k.sleep(1000);
  t.ok(z1 === "right", "carried onto the right column's tile: that tile is lit", z1);
  t.ok(
    (await k.ev(`S.dock`)) === "right" && (await R(k, "#left")).left > (await R(k, "#plate")).right,
    "dropping there docks the prompt on the right",
  );
  await k.mouse(2, 2);
  await k.sleep(300);
  n = await R(k, "#ltitle");
  p = await dragToTile(k, n.left + 20, n.top + n.height / 2, "right", "bot");
  const z2 = await nearZone(k),
    h2 = await hotTile(k);
  await release(k, p.x, p.y);
  await k.sleep(900);
  t.ok(
    z2 === null && h2?.pos === "bot" && (await k.ev(`S.dock`)) === "right" && (await k.ev(`S.pos`)) === "bot",
    "its own column's bottom tile: the bottom position, never another dock",
    { z2, h2, dock: await k.ev(`S.dock`), pos: await k.ev(`S.pos`) },
  );
  await k.mouse(2, 2);
  await k.sleep(300);
  n = await R(k, "#ltitle");
  p = await dragToTile(k, n.left + 20, n.top + n.height / 2, "below", "mid");
  const z3 = await nearZone(k);
  await release(k, p.x, p.y);
  await k.sleep(1000);
  t.ok(
    z3 === "below" && (await stacked(k)) && (await k.ev(`S.dock`)) === "below",
    "the tile under the picture: docked below",
    z3,
  );
}

/* the prompt's grip is ONE zone (2026-11-01, L3, the user: "an entire area — rectangle sized, including the LoRA area
   beneath and the title above — where there's nothing else, we should always be able to grip"): every empty point of the
   group's rectangle starts a drag; a control keeps its pointer (Apple HIG: drag by the title bar and empty chrome) */
export async function gripIsTheWholeGroup(k, t) {
  const tryAt = async (x, y) => {
    await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 4; i++)
      await k.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: x + 4 * i,
        y: y + 6 * i,
        button: "left",
        buttons: 1,
      });
    const moving = await k.ev(`document.body.classList.contains("cardmove")`);
    await k.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: x + 16,
      y: y + 24,
      button: "left",
      clickCount: 1,
    });
    await k.sleep(700);
    return moving;
  };
  for (const dock of ["left", "right", "below"]) {
    await k.ev(`(setDock("${dock}"),P.value="one line",P.dispatchEvent(new Event("input")),1)`);
    await k.mouse(2, 2);
    await k.sleep(1600);
    /* each point measured just before it's pressed: a press can change the layout (the box's bottom edge resizes it) */
    const at = async (/** @type {(r: Record<string, DOMRect>) => number[]} */ f) => {
      const r = /** @type {Record<string, DOMRect>} */ ({});
      for (const [n, sel] of Object.entries({
        L: "#left",
        T: "#pname",
        C: "#chips",
        add: "#chips .chipadd",
        pill: "#pAR",
      }))
        r[n] = await k.rect(sel);
      return f(r);
    };
    const empty = {
        "the name row, left of the name": (/** @type {any} */ r) => [r.L.left + 12, r.T.top + r.T.height / 2],
        /* clear of the size buttons at the row's right end (controls) */
        "the name row, right of the name": (/** @type {any} */ r) => [r.L.right - 100, r.T.top + r.T.height / 2],
        /* (B19, DEVLOG DD-2026-11-10-5: the gaps between the box and its name row and LoRA row are the box's resize bands
           — the picture's rule for every pane; in Vertical too since B19b: its top band is the shared edge's) */
        "the LoRA row's empty part": (/** @type {any} */ r) => [
          Math.min(r.L.right - 12, r.add.right + 60),
          r.C.top + r.C.height / 2,
        ],
      },
      controls = {
        "the name field": (/** @type {any} */ r) => [r.T.left + r.T.width / 2, r.T.top + r.T.height / 2],
        "a pill": (/** @type {any} */ r) => [r.pill.left + r.pill.width / 2, r.pill.top + r.pill.height / 2],
        "the LoRA add button": (/** @type {any} */ r) => [r.add.left + r.add.width / 2, r.add.top + r.add.height / 2],
        "the box's bottom band (the gap above the LoRA row)": (/** @type {any} */ r) => [r.L.left + 12, r.L.bottom + 4],
        "the box's top band (the gap under its name)": (/** @type {any} */ r) => [
          r.L.left + r.L.width / 2,
          r.L.top - 4,
        ],
      };
    for (const [what, f] of Object.entries(empty)) {
      const [x, y] = await at(f);
      /* it SHOWS it can be grabbed: the hand (2026-11-01: the tab bar's invisible box took the name row's pointer, and
         the LoRA row gripped under an arrow) */
      const cur = await k.ev(
        `(()=>{const e=document.elementFromPoint(${x},${y});return e?getComputedStyle(e).cursor:""})()`,
      );
      t.ok(cur === "grab", `${dock}: ${what} — shows the grab hand`, { x, y, cur });
      t.ok(await tryAt(x, y), `${dock}: ${what} — grips`, { x, y });
    }
    for (const [what, f] of Object.entries(controls)) {
      const [x, y] = await at(f);
      t.ok(!(await tryAt(x, y)), `${dock}: ${what} — keeps its pointer`, { x, y });
    }
    await k.ev(`(closePops(),1)`);
  }
}
gripIsTheWholeGroup.opts = { width: 1825, height: 1080, step: 0.05 };

/* after dragging the box to the bottom dock, both its side edges still take the pointer (2026-11-01, the user: "the right
   edge is gone after I dragged it to the bottom") — the drag's snap ghosts, invisible once it ends, sat over the right
   edge: in Vertical every child of the prompt column took the pointer, invisible ones too */
export async function edgesAfterDragToDock(k, t) {
  await k.ev(`(setDock("right"),P.value="one line",P.dispatchEvent(new Event("input")),1)`);
  await k.mouse(2, 2);
  await k.sleep(1600);
  const L = await k.rect("#left"),
    T = await k.rect("#pname"),
    p = await dragToTile(k, L.left + 12, T.top + T.height / 2, "below", "mid");
  await release(k, p.x, p.y);
  await k.sleep(1800);
  t.ok(await k.ev(`document.querySelector(".app").classList.contains("stacked")`), "dropped at the bottom: Vertical");
  const B = await k.rect("#left"),
    y = B.top + B.height / 2;
  for (const [side, x] of [
    ["right", B.right + 2],
    ["left", B.left - 2],
  ])
    t.ok(
      await k.ev(`(()=>{const e=document.elementFromPoint(${x},${y});return !!e&&e.classList.contains("sedge")})()`),
      `the box's ${side} edge takes the pointer`,
    );
}
edgesAfterDragToDock.opts = { width: 1825, height: 1080, step: 0.05 };

/* every handle outlines exactly the panes it resizes, in every layout (2026-11-01, outlines.js — one owner): the
   divider both, the prompt's edges the box, the picture's edges the picture. Side by side the divider outlined only
   the picture (Vertical's both); the prompt's own edges outlined nothing */
export async function handlesOutlineTheirPanes(k, t) {
  await k.job("[fill:446688] p", { ar: "3:4", steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=1`, 30000);
  const cases = {
    right: [
      [".pedge.pi", true, true],
      [".pedge.ri", true, true],
      [".pedge.po", false, true],
      [".pedge.ro", true, false],
      ["#vedge", false, true],
      [".hedge.t", true, false],
    ],
    below: [
      ["#left > .vedge.t", true, true],
      [".sedge.l", false, true],
      [".hedge.t", true, false],
    ],
  };
  cases.left = cases.right;
  for (const dock of ["right", "left", "below"]) {
    await k.ev(`(setDock("${dock}"),document.querySelector('.tab[data-v="gen"]').click(),1)`);
    await k.mouse(2, 2);
    await k.sleep(1800);
    for (const [sel, pic, box] of cases[dock]) {
      const r = await k.rect(sel),
        x = r.left + r.width / 2,
        y = r.top + Math.min(r.height / 2, 60);
      await k.mouse(x, y);
      await k.sleep(500);
      const s = await k.ev(
        `[document.elementFromPoint(${x},${y})===document.querySelector("${sel}"),$("plate").classList.contains("hint"),$("left").classList.contains("hint")]`,
      );
      t.ok(s[0], `${dock}: ${sel} takes the pointer`);
      t.ok(
        s[1] === pic && s[2] === box,
        `${dock}: ${sel} outlines ${[pic && "the picture", box && "the box"].filter(Boolean).join(" and ")}`,
        {
          picture: s[1],
          box: s[2],
        },
      );
      await k.mouse(2, 2);
      await k.sleep(1000);
      t.ok(!(await k.ev(`$("left").classList.contains("hint")`)), `${dock}: ${sel} — gone after`);
    }
  }
}
handlesOutlineTheirPanes.opts = { width: 1825, height: 1080 };

/* a place asked about is a RESTING place (the user, 2026-11-10: "only 1 position available"): grabbed by its body the
   box is held where it is (you're working in it), and the pass answered every place asked about (placeFor) with that —
   a lane's top, middle and bottom collapsed into one */
export async function placesIgnoreHolds(k, t) {
  await viewport(k, 1700, 950);
  await k.ev(`(setDock("left"),1)`);
  await k.sleep(1200);
  const c = await R(k, "#left .controls"),
    x = c.left + 6,
    y = c.top + c.height / 2; // the box's own body (its inset beside the pills), not its name row
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.sleep(200);
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 3; i++)
    await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: y + 5 * i, button: "left", buttons: 1 });
  const r = await k.ev(`(()=>({held:lyFrozen,tops:["top","mid","bot"].map(p=>Math.round(placeFor("left",p).y))}))()`);
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y: y + 15, button: "left", clickCount: 1 });
  await k.sleep(600);
  t.ok(r.held, "grabbed by its body, the box is held where it is", r);
  t.ok(
    new Set(r.tops).size === 3,
    "…and still the lane's three places are three places (a place asked about is a resting place)",
    r,
  );
}
placesIgnoreHolds.opts = { width: 1700, height: 950 };

/* L1a (2026-11-11): a pane carried by your hand to another side TRAVELS on from where you let it go — one motion, no
   copy (a pane's change of relation: one table, layoutmath.js relationMotion). It faded out at the drop and in at the
   other side: the box jumped off-screen and flew in from the window's edge while its copy slid away (the teleport) */
export async function dropTravels(k, t) {
  await viewport(k, 1700, 950);
  await k.ev(`(setDock("left"),1)`);
  await k.sleep(1500);
  const n = await R(k, "#ltitle"),
    x = n.left + 20,
    y = n.top + n.height / 2;
  const p = await dragToTile(k, x, y, "right", "mid");
  const r0 = await R(k, "#left"); // where it is seen when let go (the token, under the hand)
  await k.ev(`(()=>{window.__d=[];const t0=performance.now();(function f(){const r=$("left").getBoundingClientRect();
    window.__d.push({x:r.left,y:r.top,copies:document.querySelectorAll(".standin").length});
    if(performance.now()-t0<1600)requestAnimationFrame(f)})();return 1})()`);
  await release(k, p.x, p.y);
  await k.sleep(1800);
  const d = await k.ev(`window.__d`),
    end = await k.ev(`(()=>{const r=placeFor(dockNow(),S.pos||"mid");return {x:r.x,y:r.y,dock:dockNow()}})()`);
  const total = Math.hypot(end.x - r0.left, end.y - r0.top);
  let jump = 0,
    back = 0;
  for (let i = 1; i < d.length; i++) {
    jump = Math.max(jump, Math.hypot(d[i].x - d[i - 1].x, d[i].y - d[i - 1].y));
    const before = Math.hypot(end.x - d[i - 1].x, end.y - d[i - 1].y),
      now = Math.hypot(end.x - d[i].x, end.y - d[i].y);
    if (now > before + 2) back = Math.max(back, now - before);
  }
  const last = d[d.length - 1];
  t.ok(end.dock === "right" && total > 100, "dropped on the other side's tile, away from its landing", { end, total });
  t.ok(Math.max(...d.map(f => f.copies)) === 0, "no copy of it leaves: the box itself travels", d.slice(0, 3));
  t.ok(jump < total * 0.4 && back === 0, "from where it was let go to where it lands: no jump, no turning back", {
    jump: Math.round(jump),
    back: Math.round(back),
    total: Math.round(total),
  });
  t.ok(Math.abs(last.x - end.x) < 2 && Math.abs(last.y - end.y) < 2, "…and it lands at its resting place", {
    last,
    end,
  });
}
dropTravels.opts = { width: 1700, height: 950 };

/* the box's parts are placed by LAYOUT in every layout — the column alone transforms the box (its motion: the glue, the
   lift, the token; layout.css). In Vertical each part centred itself with a translateX(-50%): the token's scale point,
   read from layout, came out 380 px off and the drop to the bottom jumped 247 px (L1b) */
export async function boxPartsPlacedByLayout(k, t) {
  await viewport(k, 1700, 950);
  await k.mouse(2, 2);
  for (const d of ["left", "right", "below"]) {
    await menu(k, d);
    await k.sleep(1600);
    const own = await k.ev(
      `[...$("lcol").children].filter(e=>e.getClientRects().length&&getComputedStyle(e).transform!=="none").map(e=>(e.id||e.className)+" "+getComputedStyle(e).transform)`,
    );
    t.ok(!own.length, `${d}: no part of the box carries a transform of its own`, own);
    const off = await k.ev(`(()=>{const c=$("lcol"),s=c.style.transform;c.style.transform="none";
      const r=$("left").getBoundingClientRect(),cr=c.getBoundingClientRect();let o=0,p=0;
      for(let e=$("left");e&&e!==c;e=e.offsetParent){o+=e.offsetLeft;p+=e.offsetTop}c.style.transform=s;
      return [Math.round(r.left-cr.left-o),Math.round(r.top-cr.top-p)]})()`);
    t.ok(
      Math.abs(off[0]) <= 1 && Math.abs(off[1]) <= 1,
      `${d}: …so its drawn place in the column is its layout place`,
      off,
    );
  }
}
boxPartsPlacedByLayout.opts = { width: 1700, height: 950 };

/* spacing is roles, not numbers (DEVLOG DD-2026-11-11-8): between two neighbours one gap, --gap-pane, on either axis —
   the box ↔ the picture side by side, the picture → the box's name in Vertical, the tab bar → the picture in all three;
   so Vertical stays even (the user, 2026-11-11: "all 20, even kept"). Measured from what's seen: the plate, the bar's
   pill (.seg), the box, its name */
export async function oneGapBetweenNeighbours(k, t) {
  await viewport(k, 1700, 950);
  await k.mouse(2, 2);
  const G = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap-pane"))`);
  for (const d of ["left", "right", "below"]) {
    await menu(k, d);
    await k.sleep(1600);
    const g =
      await k.ev(`(()=>{const p=$("plate").getBoundingClientRect(),s=document.querySelector(".seg").getBoundingClientRect(),
      b=$("left").getBoundingClientRect(),n=$("pname").getBoundingClientRect(),row=!document.body.classList.contains("norow")?$("prog").getBoundingClientRect():null;
      return {bar:Math.round(p.top-s.bottom),box:Math.round("${d}"==="left"?p.left-b.right:"${d}"==="right"?b.left-p.right:n.top-(row?row.bottom:p.bottom))}})()`);
    t.ok(Math.abs(g.bar - G) <= 1, `${d}: the tab bar is one pane gap above the picture (${G})`, g);
    t.ok(Math.abs(g.box - G) <= 1, `${d}: the box is one pane gap from the picture`, g);
  }
}
oneGapBetweenNeighbours.opts = { width: 1700, height: 950 };

/* Picking the box up and dropping it back on its own place changes nothing in the layout (the user, 2026-11-12, in
   Vertical: "it resets the pic … rubber bands a bit"): the picture stays put in every frame — the name row was measured
   through the carry's scale (layout.js colPx, DD-2026-11-12-17) — and the box's least width reads the same mid-carry. */
export async function dropInPlaceLeavesThePicture(k, t) {
  await k.job("[fill:busy] a busy bright one", { steps: 1, name: "Busy" });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1200);
  for (const dock of ["below", "left"]) {
    await k.ev(`(setDock("${dock}"),1)`);
    await k.sleep(1800);
    const n = await R(k, "#ltitle"),
      x = n.left + 20,
      y = n.top + n.height / 2,
      least0 = await k.ev(`boxWLeast()`);
    await k.ev(
      `(window.__f=new Set(),window.__on=true,(function f(){if(!window.__on)return;const r=$("frame").getBoundingClientRect();window.__f.add(Math.round(r.width*2)/2+"x"+Math.round(r.height*2)/2);requestAnimationFrame(f)})(),1)`,
    );
    await press(k, x, y);
    await moveTo(k, x, y, x, y - 40); // past the threshold: lifted, the token in the hand
    await k.sleep(400);
    const leastMid = await k.ev(`boxWLeast()`);
    await moveTo(k, x, y - 40, x, y);
    await release(k, x, y); // back on its own tile
    await k.sleep(1800);
    const seen = await k.ev(`(window.__on=false,[...window.__f])`);
    t.ok(seen.length === 1, `${dock}: the picture stays put through the lift and the drop`, seen);
    t.ok(Math.abs(leastMid - least0) <= 1, `${dock}: the box's least width reads the same mid-carry`, {
      least0,
      leastMid,
    });
  }
}
