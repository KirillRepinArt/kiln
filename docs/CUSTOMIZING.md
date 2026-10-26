# Changing how Kiln looks

Every value that sets Kiln's look (colours, spacing, corners, type sizes, timings) has a name and lives in one place.
Change it there and it changes everywhere, including in the scripts that do layout maths.

**Kiln picks up a saved change by itself.** Save a file in `app/styles/` while Kiln is running and the page takes it
within a second or two: nothing reloads, and your prompt, picture and scroll position stay where they are.

## Where things live

| File | What's in it |
|---|---|
| `app/styles/tokens.css` | every value, named and commented: the design tokens |
| `app/styles/themes/<skin>.css` | one file per skin: its colours, and anything only that skin changes |
| `app/styles/*.css` (the rest) | the parts of the screen (`prompt.css`, `queue.css`, `glass.css`…): they only *use* tokens |

`index.html` loads the files in a fixed order (tokens first). Where two rules disagree, the later file wins.

## The tokens

**Spacing:** one scale, the 4-pt grid: `--space-1` (4 px) · `--space-2` (8) · `--space-3` (12) · `--space-4` (16) ·
`--space-5` (20) · `--space-6` (24) · `--space-7` (28) · `--space-8` (32) · `--space-10` (40) · `--space-12` (48) ·
`--space-16` (64). For hairlines and optical nudges only: `--space-px` (1) and `--space-hair` (2). Every step is a
whole number of screen pixels at 100 / 125 / 150 / 200 % Windows scaling.

**The hierarchy:** what belongs together sits closer than what's merely next to it:

| Token | Today | Between |
|---|---|---|
| `--gap-area` | 20 | the window's edge and everything; the prompt column and the picture area |
| `--gap-part` | 12 | an area and its own parts: the tab bar, the picture, its status row |
| `--gap-tight` | 8 | things attached to a box: the name line, the Reuse bar, the LoRA chips, the edit buttons |
| `--inset-box` | 28 | text inside a box: from the box's outer edge to the letters, on every side |

**Outlines:** one rule. Something you move or resize gets a dashed line `--outline-out` (12) **outside** its plate,
with its corners following the plate's. A place to drop is a plate with the line `--drop-inset` (12) **inside**. The
line itself is `--outline`.

**Corners:** `--r-panel` (24: panels, the picture, the prompt box), `--r-pill` (fully round), and the smaller ones
by size (`--r-2` … `--r-16`).

**Type sizes:** `--fs-10` … `--fs-48`, by size (`--fs-12-5` = 12.5 px).

**Motion:** durations `--t-100` … `--t-6000` (milliseconds), `--dur`; the layout glide `--lay-t` / `--lay-e`; the
curves by what they're for: `--e-standard`, `--e-decel` (arriving), `--e-accel` (leaving), `--e-emph` (big moves),
`--e-quick`, `--e-swing`, `--ease`.

**Colours:**
- Greys: one ramp, `--grey-13` … `--grey-96`. The number is how light it *looks* (0 = black, 100 = white).
- White and black at the opacities in use: `--white-14` = white at 14 %, `--black-35` = black at 35 %.
- The real colours, by role: `--c-danger`, `--c-warn`, `--c-caution` (+ `-bg`), `--c-star`, `--c-switch`.
- The glass material: `--glass-regular`, `--glass-thick`, `--glass-row`… (its opacity comes from the skin's `--gta`
  / `--gtk`), and `--on-picture` for the buttons over a picture.
- Neutrals tinted toward the skin: `--panel`, `--raised`, `--line` (`--tw` sets how much).

## The rule the linter enforces

Outside `tokens.css` and the skin files, a raw value is an error: a hex colour, `rgb()` / `hsl()` with numbers, a px
value in spacing, corners or type sizes, a duration in a transition or animation. Use the token. (`0` and `0s` are
fine; so is `rgba(var(--glass-row), 0.5)`, where the colour is a token.) `npm run lint` checks it, and so does every
commit.

## The skins

A skin is two things: how it **looks**, which is its file in `app/styles/themes/`, and what it **does**, which is its
effects in `app/skins.js`.

```css
/* app/styles/themes/starscape.css */
:root[data-skin="starscape"] {
  --a1: #ff8a00; /* the theme colour: Start, the progress bar, focus rings */
  --a2: #ff5e8a; /* the gradient's middle */
  --a3: #3fe0f0; /* its end */
  --ink: #140b00; /* text on the theme colour */
}
```

A skin file can also set any other token (Aurora thickens its glass with `--gta` / `--gtk` / `--gtb`; Matrix sets its
fonts with `--skin-font` / `--skin-title`) and hold rules that only apply to it (`[data-skin="matrix"] .ltitle …`).
The harmonic colours (`--an`, `--cool`, `--comp`, `--tri1`, `--tri2`) are worked out from `--a1` by the scripts.

**Adding a skin:**
1. Copy a file in `app/styles/themes/` to `<name>.css` and set its colours.
2. Link it in `index.html`, beside the other skin files.
3. Add it to the Theme menu in `index.html` (`<select id="sTheme">`, kept A–Z).
4. Give it effects in `app/skins.js` (`SKINS`): a background (`stars`, `aurora` or `code`) and a cover over a young
   picture (`bands`, `camera` or `crt`).

Renaming or retiring a skin: add the old name to `RENAMED` in `app/skins.js`, so a saved choice moves to the nearest
skin.

## The scripts read the same tokens

The layout maths uses `--gap-area`, `--gap-part`, `--gap-tight` and `--outline-out` (`app/tokens.js` reads them at
start-up and after a live style change). The harmonic colours come from the skin's `--a1`, and "Theme font" in
Settings from `--skin-font` / `--skin-title`. Change a gap in `tokens.css` and the layout follows; there's no second
copy to keep in step.

## Checking a change

- `npm run lint` checks the token rule and the formatting.
- When something is meant *not* to change how Kiln looks (a tidy-up, a rename), `cssdiff` proves it: save the old CSS
  (`app/styles/*.css` in `index.html`'s order, joined into one file), then
  `KILN_CSS_REF=path/to/old.css node tools/tests/run.mjs cssdiff`. It compares every element's computed style in 115
  states and lists every difference (`tools/tests/out/cssdiff.txt`). About 20 minutes.
