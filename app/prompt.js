// @ts-check
/* Kiln · the prompt box — its model and its wiring. What the box holds: your draft (saved), or a job's prompt shown in
   it instead (peekJob: a finished picture's, a waiting job's — peek.js shows and hides it). Only this file changes them
   (setDraft, setPeekJob); everyone reads them. Also the name line above the box: the series name, the next file's name,
   the series → file-name rule (slugify, the same as server.py's). Typing, ✕ Clear, Start / Ctrl+Enter / Esc */
import { addJobs } from "./actions.js";
import { toast } from "./boot.js";
import { layoutLeft } from "./cardlayout.js";
import { $, field, hit, q } from "./dom.js";
import { askNotify } from "./effects.js";
import { updPrompt } from "./peek.js";
import { PV, pv } from "./picstate.js";
import { closePops } from "./pills.js";
import { P, S, save } from "./state.js";
import { closeViewer } from "./viewer.js";

/* start-up wiring: Start, Ctrl+Enter, Esc (called from main.js, in order) */
export function initStartKeys() {
  $("play").onclick = () => {
    askNotify();
    addJobs();
  };
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addJobs();
    }
    if (e.key === "Escape") {
      if ($("viewer").classList.contains("show")) {
        closeViewer();
        return;
      }
      if ($("modal").classList.contains("show")) {
        $("modal").classList.remove("show");
        return;
      }
      if ((PV.browse != null || PV.still) && !hit(e, ".pwrapT")) {
        pv("close");
        return;
      } // Esc outside the editor = the picture's ✕
      closePops();
    }
  });
}
/* start-up wiring: ✕ Clear, typing (called from main.js, in order) */
export function initPromptBox() {
  $("pclear").onclick = e => {
    e.stopPropagation();
    if (peekJob || !P.value) return;
    const was = P.value,
      put = (/** @type {string} */ v) => {
        if (window.__cm) {
          const c = window.__cm;
          c.dispatch({ changes: { from: 0, to: c.state.doc.length, insert: v } });
          c.focus();
        } else {
          P.value = v;
          P.dispatchEvent(new Event("input"));
        }
      };
    put("");
    toast("Prompt cleared", "Undo", () => put(was));
  };
  P.addEventListener("input", () => {
    requestAnimationFrame(layoutLeft);
    if (!peekJob) {
      setDraft(P.value);
      save();
    }
    updPrompt();
  });
}

/** your draft: what the box holds when it isn't showing a job's prompt (saved) */
export let draft = "";
/* other files replace the draft only through this: a module's variables can be assigned only inside it */
/** @param {string} text */
export function setDraft(text) {
  draft = text;
}

/** the job whose prompt the box shows instead of your draft (null: your draft) @type {import("./types.js").Job | null} */
export let peekJob = null;
/* written from other files only through these */
/** @param {import("./types.js").Job | null} j */
export function setPeekJob(j) {
  peekJob = j;
}

/** the next-file-name lookup, waiting for typing to pause @type {number | undefined} */
let nnT;
/** a series name → its file name part (the same rule as server.py) @param {string} n */
export function slugify(n) {
  return (
    n
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "kiln"
  );
} // same rule as server.py
/** @param {string | null} file the next file's name (null: none set) */
function nameTip(file) {
  field("pname").dataset.tip = file
    ? `Names the image files · next: ${file}`
    : "Optional — names the image files (name-001.png, name-002.png…). Without a name: date and seed";
}
function nextHint() {
  const n = (S.pname || "").trim();
  if (!n) {
    nameTip(null);
    return;
  }
  clearTimeout(nnT);
  nnT = setTimeout(
    () =>
      fetch("/api/nextname?name=" + encodeURIComponent(n))
        .then(r => r.json())
        .then(d => nameTip(d.file))
        .catch(() => {}),
    250,
  );
}
export function nameUI() {
  const l = q(".plbl");
  l.classList.toggle("peekname", !!peekJob);
  if (peekJob) {
    field("pname").dataset.tip = "";
    return;
  } /* its file name shows beside it on hover */
  nextHint();
  l.classList.toggle("hasname", !!S.pname.trim());
  l.classList.toggle("dimname", !!S.pname.trim() && !P.value.trim());
}
