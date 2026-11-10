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
/* the dock the box would land in, if it's another one: the footprint's (L1 — it was the dock zone "near") */
const nearZone = k =>
  k.ev(
    `(()=>{const f=document.querySelector(".footprint.show");if(!f)return null;const now=document.querySelector(".app.stacked")?"below":S.dock||"left";return f.dataset.dock===now?null:f.dataset.dock})()`,
  );
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
    x = n.left + 20,
    y = n.top + n.height / 2;
  await press(k, x, y);
  await moveTo(k, x, y, 1600, 400);
  const z1 = await nearZone(k);
  await release(k, 1600, 400);
  await k.sleep(800);
  t.ok(z1 === "right", "dragging the name line to the right shows the right drop zone", z1);
  t.ok(
    (await k.ev(`S.dock`)) === "right" && (await R(k, "#left")).left > (await R(k, "#plate")).right,
    "dropping there docks the prompt on the right",
  );
  await k.mouse(2, 2);
  await k.sleep(300);
  n = await R(k, "#ltitle");
  x = n.left + 20;
  y = n.top + n.height / 2;
  const yBot =
    y +
    (await k.ev(
      `(()=>{const c=$("lcol"),TS=parseFloat(c.style.getPropertyValue("--ts"))||64;return c.clientHeight-TS-$("left").offsetHeight-chipsH()-(lyTop||0)})()`,
    ));
  await press(k, x, y);
  await moveTo(k, x, y, x, Math.min(940, yBot + 40));
  const z2 = await nearZone(k);
  await release(k, x, Math.min(940, yBot + 40));
  await k.sleep(800); // to the bottom position and a little past it
  t.ok(
    z2 === null && (await k.ev(`S.dock`)) === "right" && (await k.ev(`S.pos`)) === "bot",
    "straight down its own column: the bottom position, never a dock",
    { z2, dock: await k.ev(`S.dock`), pos: await k.ev(`S.pos`) },
  );
  await k.mouse(2, 2);
  await k.sleep(300);
  n = await R(k, "#ltitle");
  x = n.left + 20;
  y = n.top + n.height / 2;
  await press(k, x, y);
  /* to the slot under the picture: the box's centre carried to it (L1: the place nearest the box's centre — the lane shows
     it; the old zone docked below whenever the pointer was low on the screen) */
  const [bx, by] = await k.ev(
    `(()=>{const b=$("left").getBoundingClientRect(),r=placeFor("below","mid");return [r.x+r.w/2-(b.left+b.width/2),r.y+r.h/2-(b.top+b.height/2)]})()`,
  );
  await moveTo(k, x, y, x + bx, y + by);
  const z3 = await nearZone(k);
  await release(k, x + bx, y + by);
  await k.sleep(900);
  t.ok(
    z3 === "below" && (await stacked(k)) && (await k.ev(`S.dock`)) === "below",
    "dragged out to the bottom: docked below",
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
    x0 = L.left + 12,
    y0 = T.top + T.height / 2;
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0 });
  await k.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: x0,
    y: y0,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  for (let i = 1; i <= 20; i++)
    await k.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x0 - 20 * i,
      y: y0 + 45 * i,
      button: "left",
      buttons: 1,
    });
  await k.sleep(200);
  await k.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: x0 - 400,
    y: y0 + 900,
    button: "left",
    clickCount: 1,
  });
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
  await press(k, x, y);
  const [dx, dy] = await k.ev(
    `(()=>{const b=$("left").getBoundingClientRect(),r=placeFor("right","mid");return [r.x+r.w/2-(b.left+b.width/2),r.y+r.h/2-(b.top+b.height/2)]})()`,
  );
  /* let go 150 px past its place (still nearest it): it has a way to travel */
  await moveTo(k, x, y, x + dx + 150, y + dy);
  const r0 = await R(k, "#left"); // where it is seen when let go
  await k.ev(`(()=>{window.__d=[];const t0=performance.now();(function f(){const r=$("left").getBoundingClientRect();
    window.__d.push({x:r.left,y:r.top,copies:document.querySelectorAll(".standin").length});
    if(performance.now()-t0<1600)requestAnimationFrame(f)})();return 1})()`);
  await release(k, x + dx + 150, y + dy);
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
  t.ok(end.dock === "right" && total > 100, "dropped on the other side, away from its landing", { end, total });
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
