# Kiln

**A calm, queue-first front end for [Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo) — built for Krea 2 on modest GPUs.**

Load the queue, close the door, come back to finished images. Kiln is a single-window app for people who
want Krea 2's quality without Gradio's wall of controls or a node graph — and who generate on hardware where
one image takes minutes, not seconds.

![Kiln](docs/screenshot.png)

> **Status: design prototype.** The interface is complete and clickable, but generation is simulated.
> Wiring it to Forge Neo's API is the next milestone — see [Roadmap](#roadmap).

---

## Why

Most front ends expose everything. Kiln does the opposite: one model family, the handful of settings you
actually touch, and a queue you can keep feeding while the GPU works. It's designed around slow hardware —
honest time estimates, overnight batches, and nothing that needs babysitting.

## Features

**Queue first**
- ▶ / `Ctrl+Enter` adds to the queue; it starts immediately if idle. Keep writing while it runs.
- Drag to reorder, × to remove, **Stop** to cancel the running job.
- **Count ×N** queues a batch — random seeds, or counting up from a fixed seed.
- Click any job to **peek** at its prompt without touching your draft, then **Reuse prompt** or **Reuse all**
  (settings, seed and LoRAs too). `Esc` goes back to your draft.

**Prompt editor** (CodeMirror 6)
| Write | Shows as | Sent to the model |
|---|---|---|
| `// note to self` | dimmed comment · `Ctrl+/` toggles | **removed** |
| `{cream\|charcoal\|green} sweater` | variant pill | **one option per job** — batches vary automatically |
| `1.` / `-` list items | markers hang in the margin, wrapped lines align | as written |
| `Outfit:` on its own line | small section label | as written |
| `<lora:name:0.6>` | LoRA chip | as written (Forge parses it) |

The queue shows which variant each job got, so a good result can be traced back.

**Image**
- The frame takes the shape of your next aspect ratio; results stay until you change a setting.
- A status line under the image: **Ready · ~estimate** when idle, step / time left / **Stop** while running.
- Click a finished image for a **full-size viewer** (fit ↔ 100%, wheel zoom, drag to pan); double-click to open
  it in your default app.
- Optional **name** for a series → files are numbered `rainy-library-001.png`, `-002`, …

**LoRA library**
- Faces as a card grid with thumbnails (set one from any finished image), styles and utilities as rows.
- Readable names parsed from common file naming (`krea2_<name>_v2_large_onetrainer` → *Name · v2 · large*),
  double-click to rename, favourites, recent, search.
- **One face at a time** — LoRAs are global weight changes, so two face LoRAs blend into one face; Kiln
  swaps instead of stacking (switchable).

**Also**
- PNG Info: drop any Forge PNG to read its settings and send them to the prompt.
- Ratio picker with shape previews · ~1 / 1.5 / 2 MP presets (all sides multiples of 16).
- Window title and favicon show progress; desktop notification when the queue empties.
- Settings remember model, VAE, text encoder and the rest. **Reset layout** / **Reset everything**.
- Themes for the play button and progress bar; font choice (Geist, Inter, Satoshi, Manrope, IBM Plex Sans).

## Try it

Open `index.html` in a Chromium browser (Edge, Chrome, Brave). Generation is simulated at ×20 speed —
change it under ⚙ → *Demo speed*. Fonts and the editor load from CDNs; offline, it falls back to system fonts
and a plain text box.

## Design notes

A few rules the interface follows, in case you want to extend it in the same spirit:

- **One accent.** The theme colour appears only on the play button and the progress bar. Values, sliders and
  selection are neutral; switches use a single system blue for "on".
- **Pure black, one separation per edge.** `#000` background, `#1C1C1E` panels, faint 1px outlines on panels
  and inputs only — no drop shadows on black.
- **The image is bare; text sits on panels.** List views (Queue, LoRAs, PNG Info) get a panel; the image doesn't.
- **Nothing jumps.** The status line is always there, so the layout doesn't move when a job starts or ends.
- **The page never scrolls.** The prompt grows to fit, then scrolls inside; drag its bottom edge or the column
  divider to resize (double-click either to reset).
- **Motion only when idle.** The starfield lives in the empty image area; the ambient glow only shows while
  generating, so finished images are judged on neutral grey.

## Roadmap

1. **Forge Neo wiring** — a small local server that owns a persistent queue and drives Forge's API
   (`/sdapi/v1/txt2img`, `/progress`, `/interrupt`, `/loras`, `/options`), real LoRA list from your folders.
2. **App window** — launch in Edge/Chrome `--app` mode with its own icon; drag finished images straight into
   Photoshop or Explorer.
3. **img2img / upscale** from the image's hover actions.
4. Maybe: a ComfyUI backend behind the same interface.

## Credits

[Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo) ·
[CodeMirror 6](https://codemirror.net/) · fonts: Geist, Inter, Manrope, IBM Plex Sans (Google Fonts), Satoshi
(Fontshare). Not affiliated with Krea.

## License

[MIT](LICENSE)
