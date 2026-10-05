# Kiln

**English** · [Русский](README.ru.md)

**A calm, queue-first front end for [Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo) — built for Krea 2 on modest GPUs.**

Load the queue, close the door, come back to finished images. Kiln is a single-window app for people who
want Krea 2's quality without Gradio's wall of controls or a node graph — and who generate on hardware where
one image takes minutes, not seconds.

![Kiln — writing the next prompt while the current image renders](docs/screenshot.png)

> **Status: early, working.** Kiln drives a local Forge Neo through its API: real queue, live previews,
> your own LoRAs and models. Opened as a plain file, `index.html` runs as a self-contained demo with simulated
> generation.

---

## Quick start

You need **Windows**, **[Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)** with a Krea 2
model, and **Python 3.10 or newer** ([python.org](https://www.python.org/downloads/) — tick *“Add python.exe to
PATH”* in the installer). Kiln itself has nothing to install.

1. **Turn on Forge's API.** In Forge's `webui-user.bat`, add `--api` to `COMMANDLINE_ARGS`, for example
   `set COMMANDLINE_ARGS=--api`. Start Forge once and make sure it works on its own.
2. **Get Kiln.** On this page: **Code → Download ZIP**, unzip anywhere (or `git clone`).
3. **Double-click `kiln.bat`.** It starts the Kiln server and opens Kiln in its own Edge window.
   No Edge? It opens in your default browser instead.
4. **Write a prompt, press ▶** (or `Ctrl+Enter`). Keep writing the next one while it renders.

**Optional — one launcher for both.** Copy `config.example.json` to `config.local.json` and set `"forge_start"`
to the full path of Forge's `webui-user.bat` (in JSON, write backslashes twice: `"C:\\Forge\\webui-user.bat"`).
Kiln then starts Forge minimized when it isn't running, and stops it again when you close Kiln — but only if Kiln
started it and nothing else is using it (`"stop_forge_on_exit": false` keeps it running).

**Defaults.** Kiln starts with Krea 2 Turbo settings: 4 steps, CFG 1, Euler / Simple, shift 1.15. Change them in
⚙ Settings. Model, VAE and text encoder default to whatever Forge has loaded.

**If something's off**

| You see | Try |
|---|---|
| “Forge not running” | Forge isn't started, or `--api` is missing, or it's not on port 7860 (set `"forge_url"` in `config.local.json`). |
| The Kiln window opens blank | A VPN or proxy grabbing local traffic — Kiln's own window bypasses it; in another browser, exclude `127.0.0.1`. |
| `kiln.bat` says Python isn't found | Reinstall Python with *“Add python.exe to PATH”* ticked. |
| Time estimates look wrong | They learn from your own runs — a few images at a given size and they settle. |

---

## Features

**Queue first**
- ▶ / `Ctrl+Enter` adds to the queue; it starts immediately if idle. Keep writing while it runs.
- Drag to reorder, × to remove, **Stop** to cancel the running job. **×N** queues a batch — random seeds, or
  counting up from a fixed seed.
- Click a finished job to open it in the Generating view. Click a waiting or running job — or the status line under
  the image — to **peek** at its prompt without touching your draft, then **Reuse prompt** or **Reuse all**
  (settings, seed and LoRAs too). The buttons only appear when they'd change something: *“Use this seed”* when
  only the seed differs.
- **Honest time estimates** from your own history: the median of your last five runs at the same image size and
  steps, counted down while the job runs (on real history this halved the error of a per-megapixel average).
  The queue total uses the same numbers.

**Prompt editor** (CodeMirror 6, with spell check)

| Write | Shows as | Sent to the model |
|---|---|---|
| `// note to self` | dimmed comment · `Ctrl+/` toggles | **removed** |
| `{cream\|charcoal\|green} sweater` | variant pill | **one option per job** — batches vary automatically |
| `1.` / `-` list items | markers hang in the margin, wrapped lines align | as written |
| `Outfit:` on its own line | small section label | as written |
| `<lora:name:0.6>` | LoRA chip | as written (Forge parses it) |

The queue shows which variant each job got, so a good result can be traced back.

**Image**
- Live preview under a soft veil that lifts as the steps land; a burst of embers when it's done.
- **Browse** finished images with `←` / `→` or the arrows on the image — while a job renders, too. Each image you
  land on shows its name and prompt (greyed, with Reuse); ✕ or `Esc` returns to your draft and the live render.
  On the latest result, the ✕ clears the canvas (`←` brings it back).
- Click for a **full-size viewer** (fit ↔ 100%, wheel zoom, drag to pan, arrows to browse); double-click opens the
  file in your default app. Hover actions: upscale, open, show in folder, use as a LoRA thumbnail.
- Optional **series name** → files are numbered `rainy-library-001.png`, `-002`, … Without one: date and seed.

**LoRA library**
- Faces, Style and Utility as compact items — thumbnail, name, switch, weight — in as many centred columns as fit.
  The thumbnail slider sizes the items. **Active** LoRAs sit on top, editable right there.
- Readable names from common file naming (`krea2_<name>_v2_large_onetrainer` → *Name · v2 · large*),
  double-click to rename, favourites, recent, search.
- **One face at a time** — LoRAs are global weight changes, so two face LoRAs blend into one face; Kiln swaps
  instead of stacking (switchable).

**Layout**
- The prompt box keeps the width you give it (drag the divider; up to 900 px). Drag it by any empty spot to snap it
  to the top, middle or bottom of the image, or make it **match the image height** / **full height**.
- The right-hand box — image, Queue, LoRAs, PNG Info — is the same rectangle in every tab and takes up window
  changes; the two are centred together. Narrow windows stack the image above the prompt, with a draggable split.

**Also**
- PNG Info: drop any Forge PNG to read its settings and send them to the prompt.
- Ratio picker with shape previews · ~1 / 1.5 / 2 MP presets (all sides multiples of 16).
- Window title and favicon show progress; a desktop notification when the queue empties (on, silent or off).
- Closing the Kiln window stops the server once the queue is done.
- Themes for the play button and progress bar; fonts: Geist, Inter, Satoshi, Manrope, IBM Plex Sans.

## How it works

`server.py` (Python standard library only) owns the queue — saved in `data/queue.json`, so it survives restarts —
and feeds Forge one job at a time; Forge's own UI keeps working alongside. Images go to `outputs/` with the
generation settings embedded, so PNG Info (Kiln's or Forge's) can read them back. Model and module choices in
⚙ Settings default to whatever Forge has loaded; pick others and Kiln switches before the job runs.
`index.html` is the whole interface — one file, no build step.

**LoRA folders.** Kiln reads your LoRAs from Forge. Put face LoRAs in a `people` (or `faces`, `characters`)
subfolder and styles in `style`; the folder names are configurable in `config.local.json`.

**Demo / development.** Open `index.html` directly for the simulated demo, or run `python tools/fake_forge.py`
and point Kiln at it (`KILN_FORGE_URL=http://127.0.0.1:7861 python server.py`) to exercise the whole pipeline
without a GPU. Fonts and the editor load from CDNs; offline, Kiln falls back to system fonts and a plain text box.

## Design notes

A few rules the interface follows, in case you want to extend it in the same spirit:

- **One accent.** The theme colour appears only on the play button and the progress bar. Values, sliders and
  selection are neutral; switches use a single system blue for “on”.
- **Pure black, one separation per edge.** `#000` background, `#1C1C1E` panels, faint 1px outlines — no drop
  shadows on black.
- **The image is bare; text sits on panels.** List views get a panel; the image doesn't.
- **Nothing jumps.** The status line is always there, and switching tabs doesn't move anything.
- **The page never scrolls.** The prompt grows to fit, then scrolls inside.
- **Motion with a purpose.** The veil marks an image that isn't ready yet, embers mark one that just is; the
  starfield stays dim. While you resize the window, nothing animates.

## Roadmap

1. ~~Forge Neo wiring~~ — persistent queue, live previews, real LoRAs/models, upscale, open / show in folder.
2. ~~App window, one launcher~~ — `kiln.bat`, optional Forge start/stop.
3. **img2img** from the image's hover actions.
4. Drag finished images straight into Photoshop or Explorer.
5. Maybe: a ComfyUI backend behind the same interface.

## Credits

[Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo) ·
[CodeMirror 6](https://codemirror.net/) · fonts: Geist, Inter, Manrope, IBM Plex Sans (Google Fonts), Satoshi
(Fontshare). Not affiliated with Krea.

## License

[MIT](LICENSE)
