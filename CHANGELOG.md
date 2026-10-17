# Changelog

Versions are tagged at the end of each roadmap phase (`v0.N`). Dates are when the version was tagged.

## v0.1 — 2026-10-17

The first tagged version: everything up to the start of the roadmap's Phase 1.

**Generating**
- A queue-first front end for Forge Neo: one job at a time, model switches only when needed, live previews,
  time estimates from your own history, files named after the series (`name-001.png`).
- Browse finished images with `←` / `→` while a job renders; peek at any job's prompt and **Reuse** it — the
  series name comes along.
- **Cover** while generating (Settings → Cover): full, light or off, optionally skipped on jobs under 10 s. The eye
  at the image's top right, or `F9`, lifts it for that image or covers what's shown. **Privacy hold** keeps the
  cover on through every step and after the finish until you lift it, and never shows the picture.
- A canvas only shows the image it was asked for: no stretched leftovers after cancels, deletions or quick browsing;
  a missing file says so.

**Looks**
- Skins — theme, background, generating cover, finish and font together: Ember → Ice, Sunset, Ember, **Emerald**
  (Matrix-style code, CRT cover) and **Aurora** (northern lights, a long-exposure star-trail cover with a halo and a
  crescendo finish). `F8` replays a theme's finish.
- Glass as the default material, in three thicknesses; Start and the main actions in tinted glass.

**Prompt and LoRAs**
- CodeMirror prompt editor (comments, `{variants|…}`, LoRA tags highlighted); LoRA chips under the box with drag to
  reorder; a LoRA library with faces / style / utility, favourites and thumbnails; it rescans when opened.
- PNG Info reads Forge/A1111 parameters and Kiln's series name; **Send to prompt** restores both.

**Offline and privacy**
- Works without the internet: fonts and the editor ship with Kiln (Satoshi is optional — see `app/fonts/README.md`).
- Window title and notifications show progress only, never prompts.

**Development**
- End-to-end tests in `tools/tests/` (`node tools/tests/run.mjs`) against `tools/fake_forge.py`.
