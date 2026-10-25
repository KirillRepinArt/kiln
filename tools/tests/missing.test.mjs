// Files deleted outside Kiln: never cached by the browser, never shown, and the ways back (Recycle Bin, save back,
// render again, remove).
import { existsSync, unlinkSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const done = (k, n = 1) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);
const shown = (k, id) => k.ev(`getComputedStyle($("${id}")).display!=="none"`);

export async function neverCached(k, t) {
  await k.job("a fox", { steps: 2 });
  await done(k);
  const cc = await k.ev(`fetch("/files/"+encodeURIComponent(lastDone().file)).then(r=>r.headers.get("cache-control"))`);
  t.ok(cc === "no-store", "images are served no-store (nothing on disk in the browser)", cc);
}

export async function saveBack(k, t) {
  await k.job("[fill:dc2828] keep me", { steps: 2, name: "Keeper" });
  await done(k);
  await k.sleep(1500); // shown, so this page holds it
  const file = await k.ev(`lastDone().file`);
  unlinkSync(join(k.out, file));
  t.ok(await k.until(`$("frame").classList.contains("missing")`, 5000), "the card replaces the picture");
  const c = await k.cvColor();
  t.ok(c[0] < 30, "no picture of the deleted file is shown", c);
  t.ok((await k.ev(`$("missFile").textContent`)) === file, "it names the file");
  t.ok(
    (await shown(k, "mSave")) && !(await shown(k, "mRestore")),
    "Save back is offered (this session holds a copy); Restore isn't (not in the bin)",
  );
  await k.ev(`($("frame").click(),1)`);
  await k.sleep(400);
  t.ok(!(await k.ev(`$("viewer").classList.contains("show")`)), "clicking doesn't open the full-size viewer");
  await k.ev(`($("mSave").click(),1)`);
  await k.sleep(1500);
  t.ok(existsSync(join(k.out, file)), "Save back writes the file again");
  t.ok(
    readFileSync(join(k.out, file)).includes(Buffer.from("kiln_name")) &&
      readFileSync(join(k.out, file)).includes(Buffer.from("parameters")),
    "with its settings and series name inside",
  );
  t.ok(await k.until(`!$("frame").classList.contains("missing")`, 5000), "the card goes, the picture is back");
  t.ok(
    await k.until(
      `(()=>{const c=$("cv"),d=c.getContext("2d").getImageData(c.width>>1,c.height>>1,1,1).data;return d[0]>180&&d[1]<70})()`,
      5000,
    ),
    "the same red pixels",
  );
}

export async function renderAgain(k, t) {
  await k.job("a fox", { steps: 2, name: "Again" });
  await done(k);
  const file = await k.ev(`lastDone().file`),
    seed = await k.ev(`lastDone().seed`);
  unlinkSync(join(k.out, file)); // deleted while Kiln was closed…
  await k.send("Page.reload", {});
  await k.sleep(800);
  await k.until("!!(window.LIVE&&window._jobsReady)", 15000); // …so this session never held it
  await k.until(`$("frame").classList.contains("missing")`, 5000);
  t.ok(!(await shown(k, "mSave")), "after a restart there's no copy to save back");
  t.ok(/Render again/.test(await k.ev(`$("missHint").textContent`)), "the hint points to Render again");
  await k.ev(`($("mAgain").click(),1)`);
  await k.sleep(800);
  t.ok((await k.ev(`jobs.filter(j=>j.status==="done").length`)) === 0, "the old entry makes way");
  await done(k);
  t.ok(
    (await k.ev(`lastDone().file`)) === file && (await k.ev(`lastDone().seed`)) === seed,
    "rendered again: same file name, same seed",
    await k.ev(`[lastDone().file,lastDone().seed]`),
  );
  t.ok(existsSync(join(k.out, file)), "and the file is back");
}

const BIN = join(tmpdir(), "kiln-test-recyclebin");
export async function restoreFromBin(k, t) {
  await k.job("a fox", { steps: 2 });
  await done(k);
  const file = await k.ev(`lastDone().file`),
    path = join(realpathSync.native(k.out), file),
    bytes = readFileSync(path); // Windows records the long path (CI's temp folder is a short RUNNER~1 name)
  // what Explorer's delete leaves: a $R copy and a $I record of the original path (Windows 10+ format, version 2)
  const sid = join(BIN, "S-1-test");
  mkdirSync(sid, { recursive: true });
  const p16 = Buffer.from(path + "\0", "utf16le"),
    info = Buffer.alloc(28 + p16.length);
  info.writeBigInt64LE(2n, 0);
  info.writeBigInt64LE(BigInt(bytes.length), 8);
  info.writeBigInt64LE(0n, 16);
  info.writeInt32LE(p16.length / 2, 24);
  p16.copy(info, 28);
  writeFileSync(join(sid, "$IKILNT1.png"), info);
  writeFileSync(join(sid, "$RKILNT1.png"), bytes);
  unlinkSync(path);
  await k.until(`$("frame").classList.contains("missing")`, 5000);
  await k.sleep(800);
  t.ok(await shown(k, "mRestore"), "found in the Recycle Bin: Restore is offered");
  await k.ev(`($("mRestore").click(),1)`);
  await k.sleep(1200);
  t.ok(existsSync(path) && readFileSync(path).equals(bytes), "the original file is back, byte for byte");
  t.ok(!existsSync(join(sid, "$RKILNT1.png")) && !existsSync(join(sid, "$IKILNT1.png")), "and out of the bin");
  t.ok(await k.until(`!$("frame").classList.contains("missing")`, 5000), "the picture shows again");
}
restoreFromBin.opts = { env: { KILN_RECYCLE_ROOT: BIN } };
