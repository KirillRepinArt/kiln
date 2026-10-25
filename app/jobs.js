// @ts-check
/* Kiln · the job list — the queue model. The one place the list is kept and changed (each change has a name), and
   the questions everything else asks about it. The server is the truth: sync.js replaces the list on each poll; the
   other changes apply the server's answer at once, before the next poll confirms it. */
import { SEC_PER_STEP } from "./presets.js";

/** @typedef {import("./types.js").Job} Job */

/** @type {Job[]} */
export let jobs = [];
/** the server's list replaces ours (the poll; empty at start) @param {Job[]} list */
export function replaceJobs(list) {
  jobs = list;
}
/** jobs deleted or removed on the server: out of the list at once @param {Iterable<number>} ids */
export function dropJobs(ids) {
  const gone = new Set(ids);
  jobs = jobs.filter(j => !gone.has(j.id));
}
/** the waiting jobs in a new order (dragged in the Queue): their places in the list keep, filled in that order
 * @param {Job[]} order */
export function orderPending(order) {
  let k = 0;
  jobs = jobs.map(j => (j.status === "pending" && order.includes(j) ? order[k++] : j));
}
/* ======================= queue ======================= */
export function current() {
  return jobs.find(j => j.status === "running");
}
/** a job's expected seconds: the server's estimate, else steps × the usual time per step @param {Job} j */
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
/** a finished job by its id (null: none, or not finished) @param {number | null | undefined} id @returns {Job | null} */
export function doneById(id) {
  return id == null ? null : jobs.find(j => j.id === id && j.status === "done") || null;
}
