/* Kiln · stepping through finished pictures: the arrows, ← / →, and the status line while browsing */
import { $ } from "./dom.js";
import { doneList } from "./jobs.js";
import { frameMorph } from "./morph.js";
import { PV, browsed, onShow, picMode, pv } from "./picstate.js";
import { S } from "./state.js";
import { V, openViewer } from "./viewer.js";

export function genNav(dir, dry) {
  const m = picMode(),
    cur = onShow(),
    L = doneList();
  let i = cur ? L.findIndex(x => x.id === cur.id) : L.length;
  if (i < 0) i = L.length;
  const n = i + dir; /* the render / the empty frame sit after the newest */
  if (n < 0) return false;
  if (n >= L.length && m !== "browse" && m !== "still")
    return false; /* past the newest: out of the Gallery, or off the finished picture — to the render / the empty frame */
  if (!dry) {
    const fs = $("frame").style,
      o = { w: parseFloat(fs.width), h: parseFloat(fs.height), l: parseFloat(fs.left), t: parseFloat(fs.top) };
    PV.dir = dir;
    if (n >= L.length) pv("close", "arrow");
    else pv("browse", L[n]);
    if (n < L.length && S.view === "gen" && Math.abs(parseFloat(fs.width) / parseFloat(fs.height) - o.w / o.h) > 0.02)
      frameMorph(o);
  }
  return true;
}
export function vNav(dir, dry) {
  const L = doneList(),
    i = L.findIndex(x => x.id === (V.job && V.job.id)),
    t = L[i + dir];
  if (i < 0 || !t) return false;
  if (!dry) openViewer(t);
  return true;
}
export function navFn(el) {
  return el.closest("#viewer") ? vNav : genNav;
}
export function updNav() {
  document.querySelectorAll(".nav").forEach(b => b.classList.toggle("off", !navFn(b)(+b.dataset.nav, true)));
} /* the render's prompt: click the render itself (the status line doubled it) */
export function browseStatus() {
  const b = browsed(),
    on = !!(b && PV.promptClosed);
  $("prog").classList.toggle("showp", on);
}
