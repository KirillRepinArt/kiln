// Unit tests for the queue model (app/jobs.js): the list's changes and the questions about it — no browser.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  jobs,
  replaceJobs,
  dropJobs,
  orderPending,
  current,
  lastDone,
  doneList,
  doneById,
  jEst,
} from "../../../app/jobs.js";

const job = (id, status, more = {}) => ({ id, status, steps: 4, mp: "1.0", ...more });
const ids = () => jobs.map(j => j.id);

beforeEach(() =>
  replaceJobs([
    job(1, "done"),
    job(2, "done"),
    job(3, "running"),
    job(4, "pending"),
    job(5, "pending"),
    job(6, "pending"),
  ]),
);

test("the running job, the finished ones in order, the newest finished, one by id", () => {
  assert.equal(current().id, 3);
  assert.deepEqual(
    doneList().map(j => j.id),
    [1, 2],
  );
  assert.equal(lastDone().id, 2);
  assert.equal(doneById(1).id, 1);
  assert.equal(doneById(4), null, "a waiting job isn't a finished one");
  replaceJobs([job(1, "done")]);
  assert.equal(current(), undefined, "nothing running");
});

test("dropped jobs leave the list; the rest keep their order", () => {
  dropJobs([2, 5]);
  assert.deepEqual(ids(), [1, 3, 4, 6]);
  dropJobs(new Set([99]));
  assert.deepEqual(ids(), [1, 3, 4, 6], "unknown ids change nothing");
});

test("a new waiting order fills the waiting jobs' places; finished and running ones stay where they are", () => {
  const [, , , a, b, c] = jobs;
  orderPending([c, a, b]);
  assert.deepEqual(ids(), [1, 2, 3, 6, 4, 5]);
});

test("a job's expected time: the server's estimate, else steps × the usual time per step", () => {
  assert.equal(jEst(job(1, "pending", { est: 123 })), 123);
  assert.equal(jEst(job(1, "pending")), 4 * 60, "1.0 MP: 60 s a step");
  assert.equal(jEst(job(1, "pending", { mp: "9.9" })), 4 * 60, "an unknown size: 60 s a step");
});
