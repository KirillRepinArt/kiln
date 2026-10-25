/* Kiln · questions about the job list: the one running, the last finished, the finished ones in order */
import { SEC_PER_STEP, jobs } from "./state.js";

/* ======================= queue ======================= */
export function current() {
  return jobs.find(j => j.status === "running");
}
export function jEst(j) {
  return j.est || j.steps * (SEC_PER_STEP[j.mp] || 60);
} // the server's history-based estimate when there is one
export function lastDone() {
  return [...jobs].reverse().find(j => j.status === "done");
}
/* ======================= browsing finished images =======================
   ← / → (or the arrows on the image) step through finished images: in the Generating view, the queue overlay and
   the full-size viewer. Browsing back holds that image even when a new one finishes; stepping past the newest
   returns to the live render. */
export function doneList() {
  return jobs.filter(j => j.status === "done");
}
