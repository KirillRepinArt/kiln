/* Kiln · the prompt box: your draft, typing, ✕ Clear, Start / Ctrl+Enter / Esc */
import { addJobs } from "./actions.js";
import { toast } from "./boot.js";
import { layoutLeft } from "./cardlayout.js";
import { $ } from "./dom.js";
import { askNotify } from "./effects.js";
import { peekJob, updPrompt } from "./peek.js";
import { PV, pv } from "./picstate.js";
import { closePops } from "./pills.js";
import { P, save, setDraft } from "./state.js";
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
      if ((PV.browse != null || PV.still) && !(e.target.closest && e.target.closest(".pwrapT"))) {
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
      put = v => {
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
