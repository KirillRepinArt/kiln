// @ts-check
/* Kiln · the shapes of the data every part of the page shares — descriptions for the type checker (tsc, a dev tool),
   nothing at run time. Other files use them as {import("./types.js").Job}. */

/**
 * What a job is doing: waiting, being made, finished, stopped, failed, or deleted (kept during its Undo window).
 * @typedef {"pending" | "running" | "done" | "cancelled" | "error" | "deleted"} JobStatus
 */

/**
 * One LoRA as a job uses it: its name in Forge and its weight.
 * @typedef {object} LoraUse
 * @property {string} name
 * @property {number} w
 */

/**
 * What a job was queued with (sent to the server as is; the picture's own settings).
 * @typedef {object} JobSpec
 * @property {string} prompt      the prompt as sent, {a|b} picks made and // comments gone
 * @property {string} raw         the prompt as written
 * @property {string[]} picks     what each {a|b} picked
 * @property {string} name        the series ("Harbour"); "" = none
 * @property {string} mp          megapixels: "0.5" | "1.0" | "1.5" | "2.0"
 * @property {string} ar          aspect ratio: "3:4", "16:9" …
 * @property {number} w
 * @property {number} h
 * @property {number} steps
 * @property {number} seed
 * @property {string} [as_file]  render again: back under this file name, if it's free
 * @property {LoraUse[]} loras
 * @property {string} [checkpoint]
 * @property {string[]} [modules]  VAE / text encoder files
 * @property {number} shift
 * @property {number} cfg
 * @property {string} sampler
 * @property {string} scheduler
 */

/**
 * A job as the page holds it: the server's job with its spec spread in, times in ms.
 * The page's own, never sent: _ss = when the step on show started (ms), _lastStep = which step that was.
 * @typedef {JobSpec & {
 *   id: number,
 *   kind: "txt2img" | "upscale",
 *   status: JobStatus,
 *   file: string | null,
 *   est?: number, est_first?: number, t_first?: number, eta?: number,
 *   step: number, progress: number, preview_rev: number,
 *   error?: string,
 *   started?: number, finished?: number, created?: number,
 *   spec: JobSpec,
 *   warm: boolean, stopping: boolean, missing: boolean,
 *   _ss?: number, _lastStep?: number,
 * }} Job
 */

/**
 * Your layout sizes, saved (S.lay). Widths in px; the height caps are shares of the room (0–1).
 * @typedef {object} LayoutPrefs
 * @property {number} pw          the prompt's width
 * @property {number} rw          the Queue / LoRAs / PNG Info panel's width
 * @property {number | null} iw   Generating: the picture's width cap (null = none)
 * @property {number | null} [ih] Generating: the picture's height cap
 * @property {number | null} [vih] the same, in Vertical
 * @property {number | null} [sw] Vertical: the prompt box's width (null = the picture's: Fit width)
 * @property {number} v           the format version (3: px)
 */

/**
 * Where the prompt and the picture area go: their widths and the margins round the pair (px).
 * @typedef {object} Geometry
 * @property {number} pw     the prompt's width
 * @property {number} rw     the picture area's width
 * @property {number} mL     the margin left of the pair
 * @property {number} mR     the margin right of it
 * @property {number} W      the room it was worked out for
 * @property {number} minR   the picture area's least width
 * @property {number} off    a shift of the whole pair (0: a drag pins through layoutmath.js arrange)
 * @property {boolean} gen   worked out for Generating
 * @property {number} [clear] the edit buttons' clearance beside the picture, on its outer side
 */

/**
 * Your settings and choices, saved in the browser's storage (S, state.js). Most are optional: missing = the default.
 * @typedef {object} Settings
 * @property {string} pname          the series name in the box ("" = none)
 * @property {string} mp             megapixels: "0.5" | "1.0" | "1.5" | "2.0"
 * @property {string} ar             aspect ratio
 * @property {number} steps
 * @property {"random" | "fixed"} seedMode
 * @property {number} seed
 * @property {number} n              how many pictures per Start
 * @property {"gen" | "queue" | "loras" | "png" | "gallery"} view  the tab on show
 * @property {string} theme
 * @property {boolean} oneFace       only one "people" LoRA on at a time
 * @property {string} lfilter        the LoRA tab's folder filter
 * @property {boolean} [keepSeed]    PNG Info's Send to prompt keeps the image's seed
 * @property {boolean} [privacy]     the privacy cover is on (sticky)
 * @property {number | null} [seenDone]  the newest finished job you've seen (for "finished while you were away")
 * @property {number | null} [clearedId] the finished picture you closed with ✕
 * @property {LayoutPrefs | import("./layoutmath.js").LayoutV4 | null} [lay]  your layout sizes (v4 once laid out;
 *   older versions are brought up on first use; null: the defaults — Reset layout)
 * @property {"left" | "right" | "below"} [dock]  where the prompt goes
 * @property {"top" | "mid" | "bot"} [pos]  wide window: where the prompt card rests (picture top / centre / status line)
 * @property {"" | "full" | "match"} [hmode]  the prompt box's mode on its cross axis: side by side its height, in Vertical
 *   its width — Match: the picture's, Full: the room's (DD-2026-11-02-16)
 * @property {boolean} [vfit]        (old, dropped at start-up) Vertical's own fit flag — now S.hmode
 * @property {number} [sch]          (old, dropped at start-up) Vertical: the prompt slot's height
 * @property {number} [pph]          (old, dropped at start-up) a stored prompt box height
 * @property {number} [th]           the LoRA chips' thumbnail size
 * @property {number} [lw]           an old saved prompt width (before S.lay)
 * @property {number} [ph]           an old saved prompt height (dropped when the layout applies)
 * @property {Record<string, any>} [set]  Settings dialog choices (theme parts, cover, model, sampler, upscaler …;
 *                                      mostly strings — fontPicked is a 1)
 */

/**
 * What the image generator offers, as the server sends it (GET /api/models, server/catalog.py).
 * @typedef {object} Models
 * @property {string[]} checkpoints
 * @property {{ name: string, file: string }[]} modules  VAEs and text encoders
 * @property {string[]} upscalers
 * @property {{ name: string, folder: string, category: string, internal: string, thumb: string | null }[]} loras
 * @property {{ sd_model_checkpoint?: string, forge_additional_modules?: string[] }} current  what it has loaded
 */

/**
 * A LoRA in your library (LORAS, state.js): Forge's list, with what you set on it (saved: the name you gave it, its
 * weight, on/off, the star, when you used it).
 * @typedef {object} Lora
 * @property {string} name      its name in Forge
 * @property {string} folder    its category folder ("people", "style", "utility" …)
 * @property {string} display   the name shown (yours, or one made from the file name)
 * @property {string} tags      version / trainer tags shown under it
 * @property {number} w         its weight
 * @property {boolean} on       in the prompt's chips
 * @property {number} onAt      when it was switched on (the chips' order)
 * @property {boolean} recipe
 * @property {string} note      its subfolder / the name inside the file
 * @property {boolean} fav      starred
 * @property {number} used      when it was last used (ms)
 * @property {string | null} thumb  its thumbnail (server URL or data URL)
 */

/**
 * What the picture area shows (PV, picstate.js) — one state, changed only by events (pv(event)).
 * @typedef {object} PictureView
 * @property {number | null} browse  the finished picture being browsed (the Gallery)
 * @property {{ id: number, kind: "result" | "reference" } | null} still  a picture held in Generating: the result that
 *   just finished, or one brought back as a reference
 * @property {boolean} promptClosed  its prompt closed with ✕ (the picture stays)
 * @property {number | null} news    a result that landed while you held a reference
 * @property {number | null} yielded the result that gave way to the render — back if the render stops without a picture
 * @property {number} dir            the way you last stepped (← -1, → +1)
 * @property {Settings["view"] | null} from  the tab a picture was opened from — ✕ goes back there
 */

/**
 * The layout's moment-to-moment state (not saved): what you're doing right now, and what was last applied.
 * @typedef {object} LayoutState
 * @property {boolean} overImg       the pointer is over the picture
 * @property {boolean} pressCard     a press in the prompt card (it holds its place until you let go)
 * @property {HTMLElement | null} navHold  the on-picture arrow being clicked: it stays put until the pointer leaves it
 * @property {Geometry | null} last  the geometry last applied (where the pair's columns are going)
 * @property {number} vroom  Vertical: the picture's room (its height, px; 0 side by side)
 * @property {number} vrow   Vertical: the room kept under the picture for its status row (px)
 * @property {{ pw: number } | null} shown  the box's width side by side, as written this frame (layout.js boxWWrite)
 *   now (their glide, layout.js layApply: G12)
 * @property {boolean} drag          an edge is being dragged
 * @property {number | null} vh      a top / bottom edge held: the picture's live height
 * @property {number | null} vtop    …and the top that stays put meanwhile
 * @property {number | null} [vw]    Vertical: a panel's side edge held: its live width (past its limits: the rubber band)
 * @property {number | null} [ph]    a panel's top / bottom edge held: its live height
 * @property {number | null} [ptop]  and its top in its room meanwhile (the other side pinned)
 * @property {number} [proom]        the panel's room height (sizeFrame)
 * @property {number} [overB]        a held picture's overshoot below its kept bottom (the rubber band): feedback of the
 *                                    grabbed edge only — what sits round the picture is placed from the limit
 * @property {{top: number, h: number, bottom: number, w: number} | null} target  where the picture is going (not
 *   where it is mid-glide): the prompt's vertical anchors use this
 * @property {boolean} frameDefer    inside one click: sizeFrame runs once, at the end
 * @property {boolean} framePending  …and was asked for meanwhile
 * @property {boolean} frameHold     the layout is held (the prompt box's bottom edge being dragged)
 * @property {{ pic: { x: number, y: number, w: number, h: number } | null, roomTop: number, page: { x: number, y: number, w: number, h: number }, box: { x: number, y: number, w: number, h: number }, strip: number, largest: { w: number, h: number }, kept: { boxW: number, scale?: number, w?: number, h?: number }, handles: Record<string, { x: number, y: number, w: number, h: number }> } | null} [pass]  side by side, a
 * @property {import("./layoutmath.js").PassOut | null} [passV] Vertical's pass, computed alongside the old maths (C4b step 1: a shadow run)
 *   picture page: the single layout pass's numbers (v0.7c C2a), held or not (C3)
 * @property {{ edge: string, at: number, off: number, boxW: number, scale: number, w?: number, h?: number } | null} [pdrag]  an edge of a picture
 *   page held side by side (C3): the pass's handle id, the pointer on its axis (+ off: where on the handle it was
 *   pressed), the sizes at the press
 * @property {"bar" | "none" | null} row  the row under the picture: the progress bar, or nothing
 * @property {string | null} rowView the tab the row was decided for (its fade belongs to a switch between views)
 * @property {string} ins            the page's insets last laid out ("row:tools"): a change lays out again
 * @property {number} colW           Vertical: the picture column's width (0 otherwise)
 */

/**
 * The prompt card's placement (wide window), moment to moment. Frozen while you work in it (pointer over it, or its
 * editor focused): it only grows downward, so nothing moves under the cursor; ~0.5 s after you leave it re-centres.
 * @typedef {object} CardState
 * @property {boolean} frozen
 * @property {boolean} hover          the pointer is over the card
 * @property {number | undefined} thawTimer
 * @property {number | null} top      its top (column coordinates)
 * @property {number | null} bottom   its bottom, chip row included
 * @property {number | null} cy       the picture's vertical centre — what "mid" centres on
 * @property {number | null} imgTop   the picture's top — "top" lines up with it
 * @property {number | null} imgBottom the status line under the picture — "bot" lines up with it
 * @property {boolean} drag           the card is being dragged to a new resting place
 * @property {number} [swHold]       Vertical: the box's width while a side edge is held (0: none) — layoutLeft writes it
 * @property {number} [hHold]        side by side: the box's height while a height edge is held (0: none) — the rubber band
 * @property {"top" | "bottom"} [hPin] and the side that holds meanwhile
 * @property {number} [lastSlot]     Vertical: the box's height as last laid out (the room the page and the box share)
 * @property {number} slotHold       Vertical: the box's height while the divider is held (0: none). Never kept: the box
 *                                    hugs its text; letting go gives the picture the size it has (edges.js)
 */

export {};
