// Without its server (opened as a file, or its server stopped) Kiln says so — no fake demo, no dead controls.
// Opened as a file, the note is in the HTML itself (ES modules don't load from a file); served, the server hides it.
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const INDEX = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "index.html")).href;

export async function noServerSaysSo(k, t) {
  t.ok(!(await k.ev(`$("offline").classList.contains("show")`)), "with the server: no note");
  await k.send("Page.navigate", { url: INDEX });
  t.ok(
    await k.until(
      `!!document.getElementById("offline")&&document.getElementById("offline").classList.contains("show")`,
      10000,
    ),
    "opened as a file: the note says the server isn't running",
  );
  await k.sleep(600);
  await k.shot("note");
  t.ok(await k.ev(`document.getElementById("offline").textContent.includes("kiln.bat")`), "…and how to start it");
  // as a file the page's modules can't load at all: the note is plain HTML, nothing runs behind it
  t.ok(await k.ev(`!window.LIVE&&typeof window.kiln==="undefined"`), "nothing runs behind it (no fake LoRAs or jobs)");
}
