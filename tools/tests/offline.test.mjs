// Without its server (opened as a file, or server.py stopped) Kiln says so — no fake demo, no dead controls.
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const INDEX = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "index.html")).href;

export async function noServerSaysSo(k, t) {
  t.ok(!(await k.ev(`$("offline").classList.contains("show")`)), "with the server: no note");
  await k.send("Page.navigate", { url: INDEX });
  t.ok(await k.until(`!!document.getElementById("offline")&&document.getElementById("offline").classList.contains("show")`, 10000),
    "opened as a file: the note says the server isn't running");
  await k.sleep(600); await k.shot("note");
  t.ok(await k.ev(`document.getElementById("offline").textContent.includes("kiln.bat")`), "…and how to start it");
  t.ok(await k.ev(`!window.LIVE&&LORAS.length===0&&jobs.length===0`), "no fake LoRAs or jobs behind it");
}
