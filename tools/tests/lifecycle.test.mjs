// The server stops when the Kiln window closes — and only then (a throttled background page must not look closed).
const alive = async k => {
  try {
    await fetch(`http://127.0.0.1:${k.kport}/app/styles/tokens.css`);
    return true;
  } catch (e) {
    return false;
  }
}; // not /api/state: that counts as a window checking in

export async function backgroundDoesNotStop(k, t) {
  await k.send("Page.setWebLifecycleState", { state: "frozen" }); // worse than Edge's throttling: no timers at all
  await k.sleep(22000);
  t.ok((await k.ev("1").catch(() => 1)) !== null, "page frozen for 22 s");
  // the server must not have counted 22 s of silence as a closed window (it used to after 15 s)
  t.ok(await alive(k), "the server is still running");
  await k.send("Page.setWebLifecycleState", { state: "active" });
}
backgroundDoesNotStop.opts = { autoExit: true };

export async function closingStops(k, t) {
  await k.send("Page.navigate", { url: "about:blank" }); // the window goes away: pagehide sends the goodbye
  let gone = false;
  for (let i = 0; i < 20 && !gone; i++) {
    await k.sleep(500);
    gone = !(await alive(k));
  }
  t.ok(gone, "closing the window still stops the server within a few seconds", k.log.join("").slice(-600));
}
closingStops.opts = { autoExit: true };
