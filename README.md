# Kiln

**English** · [Русский](README.ru.md)

**A calm, queue-first front end for [Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo), built around Krea 2.**

Load the queue, close the door, come back to finished images. Kiln is a single-window app for people who want
Krea 2's quality without Gradio's wall of controls or a node graph. Whether one image takes minutes on a modest GPU
or a long queue runs on a fast one, there's something worth watching while it works — and every finished picture
comes back with its prompt and settings beside it, so looking through your results means reading what made them,
not hunting through files.

![Kiln — writing the next prompt while the current image renders](docs/screenshot.png)

> **Status: early, working.** Kiln drives a local Forge Neo through its API: real queue, live previews,
> your own LoRAs and models.

---

## Quick start

You need **Windows**, **[Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)** with a Krea 2
model, and **Python 3.10 or newer** ([python.org](https://www.python.org/downloads/) — tick *“Add python.exe to
PATH”* in the installer). Kiln itself has nothing to install.

1. **Turn on Forge's API.** In Forge's `webui-user.bat`, add `--api` to `COMMANDLINE_ARGS`, for example
   `set COMMANDLINE_ARGS=--api`. Start Forge once and make sure it works on its own.
2. **Get Kiln.** On this page: **Code → Download ZIP**, unzip anywhere (or `git clone`).
3. **Double-click `kiln.bat`.** It starts the Kiln server (or finds the one already running) and opens Kiln in its own
   window: Edge, else Chrome or Chromium, else your default browser.
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
- Drag to reorder, × to remove, **Stop** to cancel the running job (it stops after the current step — Forge can't
  stop mid-step — and says so). **×N** queues a batch — random seeds, or counting up from a fixed seed.
- **Pause after this** (Queue tab): the current image finishes, nothing new starts until you resume.
- **Select** finished pictures: the round box on a row, Ctrl-click, Shift-click a range (then a plain click adds or
  removes), Ctrl+A, Esc. The Finished header turns into the actions: **All “Fox”** (the whole series), Select all,
  **Remove from list**, **Delete** (Del) — to the Recycle Bin with one Undo for all of them.
- Built for long queues: hundreds of finished pictures open and scroll instantly — small thumbnails made once and kept,
  only the rows on screen drawn, and while a job renders Kiln asks the server only for its progress.
- Rows show when a job was added, finished and how long it took; the running row shows the live render (not with
  privacy on); hover a finished thumbnail for a bigger look. A waiting job's name can be changed in its peek.
- **Delete** an image (`Del`, or the trash button beside it): it goes to the Recycle Bin, with Undo. ✕ on a
  finished row only takes it off the list. Images deleted outside Kiln show as *file deleted* (**Remove missing**);
  browsing to one shows a card instead of the picture, with the ways back that apply: **Restore from Recycle Bin**
  (the original file), **Save back** (if Kiln still holds it from this session), **Render again** (same seed, same
  file name) or **Remove from list**.
- An **upscale** goes to the front of the line: seconds, right after the current image.
- Click a finished job to open it in the Gallery (✕ brings you back to the Queue). Click a waiting or running job to
  **peek** at its prompt without touching your draft, then **Reuse prompt** or **Reuse all**
  (settings and LoRAs; its seed too if the 🔒 next to it is on — off gives a variation). Reusing a named image also
  takes its name, so the next one joins the series. The same buttons, in the same places, on every picture.
- **Honest time estimates** from your own history: the median of your last five runs at the same image size and
  steps, counted down while the job runs (on real history this halved the error of a per-megapixel average).
  The queue total uses the same numbers.

**Prompt editor** (CodeMirror 6, with spell check) — ✕ at its top right clears it in one click (Undo, or `Ctrl+Z`)

| Write | Shows as | Sent to the model |
|---|---|---|
| `// note to self` | dimmed comment · `Ctrl+/` toggles | **removed** |
| `{cream\|charcoal\|green} sweater` | variant pill | **one option per job** — batches vary automatically |
| `1.` / `-` list items | markers hang in the margin, wrapped lines align | as written |
| `Outfit:` on its own line | small section label | as written |
| `<lora:name:0.6>` | LoRA chip | as written (Forge parses it) |

The queue shows which variant each job got, so a good result can be traced back.

**Layout**
- The prompt and the picture are one pair with an 18 px gap, centred in the window. In Generating the image area hugs
  the picture (portrait or landscape), so the prompt always sits next to the actual picture; Queue, LoRAs and PNG Info
  keep a width of their own. A picture of the same shape keeps exactly its place between Generating and the Gallery.
- **Edges:** the divider between them trades width (the prompt stops at its minimum); an outer edge follows the cursor,
  then the pair glides back to centre. The picture's own edges set the largest it may be. Hover an edge and a dashed
  outline frames the picture; the whole band between the picture and that outline is the handle. Double-click an edge
  for its default.
- A wider window never stretches the panels past the widths you chose — the margins grow; a narrower one takes the
  margins first, then shrinks both panels, and they come back when there's room.
- **Layout menu** (the icon next to the gear): prompt on the left, on the right, or below the picture, and Reset sizes.
  Or drag the prompt by its name line onto one of the glass drop zones (pressing it outlines the whole block that
  moves). Switching cross-fades while the picture glides to its new place.
  A narrow window stacks either way.
- **Vertical** (prompt below): the picture sits in a centred column (up to a 16:9 box at its height), with equal gaps
  above and below; its top, bottom and side edges size it. The prompt box has its own side edges and a **Fit width**
  button (as wide as the picture). The box fills a slot of its own height — set it with the line above its name or its
  bottom edge (which follows the pointer; the picture gives up the room when you let go) — so the picture never moves
  with what the prompt says.
- Side by side: drag the prompt by any empty spot to snap it to the top, middle or bottom of the picture, or make it
  **match the image height** / **full height**.
- Nothing moves under the cursor: while a menu in the prompt is open the layout holds; the picture's arrow you click
  stays where it is for as long as your pointer is on it. Every layout change glides on one curve.

**Picture**
- Live preview under a soft cover that lifts as the steps land; a burst of embers when it's done.
- **What the picture area shows**, in one rule set: **Generating** is the live view — the render, or, when a job
  finishes, the finished picture at full quality, which stays until the next render has a picture of its own (✕ clears
  it; a stopped render brings back the picture before it). The **Gallery** tab opens on the picture you're looking at;
  the **Generating** tab always takes you back to what's being made. Arrows always change the picture.
- Click the render to see its prompt in the box (✕ / `Esc` gives your draft back); while you edit something else, the
  status line says the render is *another prompt*. Whenever the box shows a job's prompt, ▶ is **Vary** (another like
  it, new seed), and typing in it makes it your draft right away (Ctrl+Z steps back to your old one). `→` on a finished
  picture takes it off and shows the render.
- A picture that finishes while you're on another tab, or browsing the Gallery, shows as a small card under the
  Generating tab — click it to open the picture.
- **Cover** (Settings → Cover): full, light or off, optionally skipped on jobs under 10 s; hover the image to peek.
- **Privacy** — the eye at the picture's top right (there even with no picture), or `F9` (even while typing): the picture is covered outright,
  running or finished (no transparency, no peek on hover, no fading, no full-size viewer), and the prompt, name and
  LoRAs are hidden. It stays on — across jobs and restarts — until you press it again.
- The picture's actions (img2img, upscale, open, folder, LoRA thumbnail, delete) sit in a column beside it, shown while
  you hover the picture or the column.
- **Gallery** (the tab left of Generating): your finished pictures, browsed with `←` / `→` or the arrows on the picture
  — while a job renders, too. `←` from Generating steps into it; `→` past the newest brings you back. Each picture
  shows its name and prompt (greyed, with **Reuse prompt** / **Reuse all**). Pictures cross-fade; when the shape
  changes, the frame crops in on the picture you leave and opens out over the next. **▶ in the Gallery is Vary** (a die
  instead of the triangle): the picture again with a new seed — same prompt, settings, LoRAs and series — your draft
  untouched. **Reuse** takes you to Generating with the picture kept as a reference while you edit (a running render
  doesn't push it away; a result that lands behind it is announced in the status line), until ▶ or ✕. Deleting lands on
  the next picture in the way you were stepping.
- **File names:** hover a finished picture's title to see its file name around it (`#27 Rome-003.png`). Edit the title
  and press Enter to **rename** the file — it joins the series you typed with its next number, the name stored in the
  PNG follows, and Undo puts it back. Without a series name files are named by date and seed.
- **Status:** while a job renders the bar under the picture shows its steps, time left and Stop; the ring round the
  **G** of Generating (cut clear of the letters) fills with its progress wherever you are; ▶ flows with the bar's colours
  and its queue count gets a ring of its own. An empty Generating
  says what's next and the estimated time. Hover the MP pill for the exact pixel size.
- Kiln's own messages appear by the prompt, never over the controls; messages about the queue appear under the Queue
  tab. Long prompts scroll under the glass controls and fade into the box's edges. **Notifications** say only that an image is
  ready — never the prompt or the name. Reopening Kiln tells you how
  many images finished while it was closed.
- `?` lists every keyboard shortcut.
- Click for a **full-size viewer** (fit ↔ 100%, wheel zoom, drag to pan, arrows to browse); double-click opens the
  file in your default app.

**LoRA library**
- Faces, Style and Utility as compact items — thumbnail, name, switch, weight — in as many centred columns as fit.
  The thumbnail slider sizes the items. **Active** LoRAs sit on top, editable right there.
- Readable names from common file naming (`krea2_<name>_v2_large_onetrainer` → *Name · v2 · large*),
  double-click to rename, favourites, recent, search (✕ clears it).
- **One face at a time** — LoRAs are global weight changes, so two face LoRAs blend into one face; Kiln swaps
  instead of stacking (switchable).

**Also**
- PNG Info: drop any Forge PNG to read its settings and send them to the prompt.
- Ratio picker with shape previews · ~1 / 1.5 / 2 MP presets (all sides multiples of 16).
- Window title and favicon show progress; a desktop notification when the queue empties (on, silent or off).
- Closing the Kiln window stops the server once the queue is done.
- Forge's own UI: Settings → Output → Open Forge.
- Four skins: Aurora (northern lights), Embers, Matrix (code rain), Starscape — each its colours and its own
  background, cover and finish; how each looks is a small file in `app/styles/themes/` (see `docs/CUSTOMIZING.md`). Fonts: Geist, Inter, Manrope,
  IBM Plex Sans, Satoshi (optional, see Offline).

## How it works

The server (`server/`, Python standard library only) owns the queue — saved in `data/queue.json`, so it survives restarts —
and feeds Forge one job at a time; Forge's own UI keeps working alongside. Images go to `outputs/` with the
generation settings embedded, so PNG Info (Kiln's or Forge's) can read them back. Model and module choices in
⚙ Settings default to whatever Forge has loaded; pick others and Kiln switches before the job runs.
The interface is `index.html` plus plain files in `app/` (CSS and scripts), no build step: the browser loads them as they are.

**LoRA folders.** Kiln reads your LoRAs from Forge. Put face LoRAs in a `people` (or `faces`, `characters`)
subfolder and styles in `style`; the folder names are configurable in `config.local.json`.

**Development.** How Kiln is built: `docs/ARCHITECTURE.md`; why: `docs/decisions/`; working on it: `CONTRIBUTING.md`.
Run `python tools/fake_forge.py` and point Kiln at it (`KILN_FORGE_URL=http://127.0.0.1:7861 python -m server`) to exercise the whole pipeline
without a GPU. `node tools/tests/run.mjs` runs the end-to-end tests (Node 22+, Edge or Chrome): each test starts
its own fake Forge, Kiln and a headless browser. Changes are listed in `CHANGELOG.md`.

**Offline.** Kiln asks nothing of the internet: its fonts (`app/fonts/`) and the prompt editor
(`app/vendor/codemirror.js`) ship with it. Satoshi is the one font that can't be included — its licence doesn't
allow a public repository; `app/fonts/README.md` says how to add your own copy (without it, Kiln uses Geist and
Settings shows Satoshi as not installed).

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
[CodeMirror 6](https://codemirror.net/) · fonts: Geist, Inter, Manrope, IBM Plex, Courier Prime (SIL OFL, bundled), Satoshi
(Fontshare). Not affiliated with Krea.

## License

[MIT](LICENSE)
