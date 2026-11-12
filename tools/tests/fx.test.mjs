// Every skin's effects run through a job, its finish and an F8 replay without a page error (the runner checks errors
// after every test). The effects' timings are tokens (--fx-*, tokens.js msGroup): a missing one throws, so this is the
// browser half of their proof — the other half is unit/onetime.test.mjs (every group key has its token).

/** one skin: a job to its finish, a look at the Gallery, F8 over the picture on show @param {any} k @param {any} t
 * @param {string} name @param {boolean} [extra] its signature effect switched on */
async function throughAFinish(k, t, name, extra = false) {
  await k.theme(name);
  if (extra) await k.ev(`((S.set=S.set||{})["extra-${name}"]="on",save(),applyTheme(),1)`);
  await k.job("[fill:446688] a harbour at dawn", { ar: "3:4", steps: 3 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.sleep(3000); // the finish: the crescendo, the release, the bursts, the sky's answer
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(800);
  t.ok(await k.ev(`$("frame").classList.contains("has")`), `${name}: the Gallery shows the picture`);
  await k.key("F8"); // the finish replayed over the picture on show (the Gallery's)
  await k.sleep(3000);
  t.ok(
    await k.ev(`$("frame").classList.contains("has")`),
    `${name}${extra ? " + its extra" : ""}: the picture still on show after F8`,
  );
}

export const aurora = (k, t) => throughAFinish(k, t, "aurora");
export const matrix = (k, t) => throughAFinish(k, t, "matrix");
export const starscape = (k, t) => throughAFinish(k, t, "starscape");
export const graphiteStarfield = (k, t) => throughAFinish(k, t, "graphite", true);
export const clay = (k, t) => throughAFinish(k, t, "clay");
