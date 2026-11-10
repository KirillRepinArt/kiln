// The one way a picture reaches the frame (R3, the re-read 2026-11-10 — DEVLOG DD-2026-11-10-11): pictures.js's entry
// (frameRender / frameRenderPicture / frameDone / frameEmpty / frameForget). Its rules — an old picture held over the new
// one fades off it, a picture into an empty frame fades in — only hold if nothing draws on, clears or tags the frame's
// canvas (#cv) past it: the render's previews did (progress.js), and their first one popped in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APP = join(import.meta.dirname, "..", "..", "..", "app");

test("only pictures.js draws on, clears or tags the frame's canvas", () => {
  const found = [];
  for (const f of readdirSync(APP).filter(f => f.endsWith(".js") && f !== "pictures.js")) {
    const src = readFileSync(join(APP, f), "utf8");
    for (const line of src.split("\n")) {
      if (!line.includes('$("cv")')) continue;
      if (/\$\("cv"\)\)?\s*\.\s*(dataset\.\w+|width|height)\s*=(?!=)/.test(line) || /\b(drawTo|paint)\(/.test(line))
        found.push(`${f}: ${line.trim().slice(0, 80)}`);
    }
    /* a canvas held in a variable from $("cv") and then written */
    if (/const (\w+) = [^;]*\$\("cv"\)[^;]*;[\s\S]*?\b\1\s*\.\s*(width|height|dataset\.\w+)\s*=(?!=)/.test(src))
      found.push(`${f}: the frame's canvas written through a variable`);
  }
  assert.deepEqual(
    found,
    [],
    "use pictures.js's frame entry (frameRender, frameRenderPicture, frameDone, frameEmpty, frameForget)",
  );
});
