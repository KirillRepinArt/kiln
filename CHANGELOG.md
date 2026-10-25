# Changelog

Versions are tagged at the end of each roadmap phase (`v0.N`). Dates are when the version was tagged.

## v0.6 — 2026-10-25 (queue at scale)

- **Fast with hundreds of pictures:** while a job renders Kiln asks the server only for its progress (at 500 jobs each
  check went from ~900 KB to under 1 KB); queue thumbnails are small files made once and kept (opening the Queue no
  longer decodes every full picture), only the rows on screen are drawn, and Kiln keeps at most 16 pictures decoded.
  Measured on 500 pictures with a job rendering: the Queue opens in ~55 ms (was 228 ms).
- **Select** finished pictures — the round box, Ctrl / Shift-click, Ctrl+A, Esc, the whole series — and Delete them
  with one Undo, or Remove them from the list. Selecting and reordering never move or redraw the other rows.
- The Queue: "Generating now" / "Up next" / "Finished"; an hourglass until the running job's first preview; ✕ on a
  picture opened from the Queue brings you back there.
- Whenever the prompt box shows a job's prompt, ▶ is **Vary**; typing in it makes it your draft at once (Ctrl+Z goes
  back). `→` takes a finished picture off Generating.
- Tab switches keep the tab bar in place (its pill slides) and morph the panel to its new size; drop zones as glass
  plates, below the tab bar; one outline rule (a place to drop: a line inset on a plate; something you move: a line
  outside it).
- The prompt box: equal insets, the ✕ and the character count in its corner, text scrolling under the glass controls and
  fading into the edges, the scrollbar clear of both; queue messages under the Queue tab; a gentler Start hover; a soft
  keyboard focus ring.
- **Fixes:** text under the pills wasn't blurred in the Gallery; a prompt's scrollbar gutter could stay after it fit.

## v0.5 — 2026-10-24 (consolidation)

- **The picture area, one set of rules:** Generating is the live view. A finished picture stays there at full quality
  until the next render has a picture of its own (✕ clears it; a stopped render brings back the picture before it). The
  Gallery tab opens on the picture you're looking at; the Generating tab always shows what's being made.
- **Vary:** ▶ in the Gallery (a die) queues that picture again with a new seed — same prompt, settings, LoRAs and
  series; your draft stays. **Reuse** takes you to Generating with the picture as a reference, which a running render
  doesn't push away.
- Click the render to see its prompt; the status line says when the render isn't your draft. A picture that finishes
  while you're elsewhere shows as a card under the Generating tab.
- Deleting in the Gallery lands on the next picture in the way you were stepping.
- ✕ Clear on the prompt (Undo / Ctrl+Z) and on the LoRA search; the privacy eye on the empty frame too.
- Start while a job runs: the bar's flowing gradient over the whole button, a ring round its queue count. The
  Generating ring is cut clear of the letters.
- Vertical: the prompt box fills its slot; its bottom edge sizes it. Glass drop zones that condense in; pressing the
  prompt outlines the whole block. Kiln's messages appear by the prompt, not over the controls. Clearer Settings
  section names.
- **Fixes:** the title in Vertical couldn't be clicked (the picture area's empty space covered it); a drag could stay
  stuck after a lost mouse release; job numbers were reused after removals.
- Under the hood: the stylesheet rewritten (verified to change nothing visible: every element's style compared in 115
  states), and the picture area driven by one state machine.

## v0.4 — 2026-10-19 (motion, Vertical, Gallery)

- **Motion:** one glide for every layout change (Material 3 emphasized easing); layout switches cross-fade while the
  picture glides to its new place; tab switches are a short fade.
- **Gallery** — the tab left of Generating: browsing finished pictures (`←` steps in, `→` past the newest steps back).
  Pictures cross-fade (the neighbours preloaded); a new shape crops in on the old picture and opens out over the next,
  in one continuous move. A picture of the same shape keeps its place between Generating and the Gallery. Reusing a
  prompt keeps its picture on show as a reference.
- **Arrows** on the picture: the one you click stays where it is while your pointer is on it.
- **Vertical** layout: a centred column (up to 16:9 at its height) with equal gaps around the picture; the picture's
  edges size it; the prompt box gets side edges, **Fit width** and a fixed slot (the picture never moves with the text).
- **Edges:** a dashed outline 12 px round the picture on hover (fades in and out softly); the band up to it is the
  handle; no grip bars.
- **File names:** hover a finished picture's title for its file name; edit it to **rename** the file (series + next
  number, the PNG's name chunk follows, Undo).
- **Status:** the bar only while rendering; an empty Generating says what's next and the estimated time; the running
  job's progress as a ring round the G of Generating; the queue count on ▶; the pixel size on the MP pill's tooltip.
- Layout menu as icons; the same Reuse buttons on every picture; the prompt's text fills the box (no character cap);
  Forge's own UI moved to Settings; Aurora's glow only round the live render, cut out under glass panels (a
  flickering band in the prompt box).
- **Fixes:** the prompt box's empty scrollbar strip flickered on glass; prompts of different lengths moved the picture
  in Vertical; the progress bar crossed the picture during shape changes; the Queue → Generating switch lagged.

## v0.3 — 2026-10-18 (Phase 2a: layout)

- **Layout:** the prompt and the picture as one centred pair; the image area hugs the picture in Generating; edges for
  the divider, the outer sides and the picture's height; widths you choose are kept (a wider window grows the margins,
  a narrower one shrinks the margins first, then the panels); Layout menu — Horizontal (prompt left / right), Vertical,
  Reset sizes — and drag-to-dock by the prompt's name line; holds while you work, glides when you're done.
- The picture's actions in a column beside it (on hover); the eye on the picture; arrows always at mid-height.
- **Fix:** the prompt box's empty scrollbar strip flickered on glass themes; the strip is now kept only while the text
  overflows.
- **Fix:** the server shut itself down under a Kiln window left in the background (Edge slows hidden pages' timers);
  a real close still stops it within seconds.

## v0.2.1 — 2026-10-18

- **Fix:** updating to v0.2 could wipe your LoRA names, stars and weights (a one-time settings conversion saved before
  Forge's LoRA list had loaded). Saving now merges and never drops a LoRA it doesn't currently know. If yours were
  wiped, they can be restored from a `data/lora_restore.json` file, which Kiln applies once on start.

## v0.2 — 2026-10-18 (Phase 1)

- **Queue:** Pause after the current image · delete to the Recycle Bin with Undo (`Del`) · remove a finished row from
  the list · added / done / took times · rename a waiting job · live render in the running row · bigger preview on
  hovering a thumbnail · upscales jump the line · files deleted outside Kiln marked, with Remove missing.
- **Stop** is a proper button; stopping freezes the bar and says it stops after the current step.
- Before the first step the status reads e.g. *Kindling… · loading model* (or *· starting* when the model is loaded).
- **Send to prompt** (PNG Info) switches to Generating and brings CFG, sampler and schedule too. **Keep seed** —
  next to Send and as a lock in the peek bar — decides between the image's seed and a fresh one (default: fresh).
- Notifications are neutral; reopening Kiln says how many images finished while it was closed.
- **Images are never cached by the browser** (a deleted picture used to live on in Edge's disk cache for a day); the
  first page load of each run clears what earlier versions left. A file deleted outside Kiln shows a card — Restore
  from Recycle Bin · Save back · Render again (same seed, same name) · Remove from list — never the picture.
- Settings → About: the version and a manual **Check for updates** (the only time Kiln goes online, only when you
  press it). `?` opens a keyboard shortcut sheet. LoRA category chips explain they come from your folders.
- **Privacy** — the eye or `F9`: the picture fully covered (running or finished), the prompt, name and LoRAs hidden;
  stays on across jobs and restarts. Replaces the Privacy hold setting.
- File names are never reused (a deleted number used to be handed out again, and the queue showed the old picture).
- Deleting while browsing lands on the neighbouring image · Stop counts down · 0.5 MP · the LoRA list stays put when
  you switch one on · the prompt box no longer keeps a stray scrollbar · calmer queue reordering.
- Known: on Aurora a faint horizontal line can flicker behind glass panels (GPU-specific, parked).

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
