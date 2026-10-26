# 0009 · Design tokens in CSS, enforced by the linter; skins as token files

**Context.** Kiln's owner tunes the look by eye and wants to change it without asking: "the same values reused, even
spacing". Before tokens, the styles held 47 different spacings and 133 colours, mostly one-off nudges.

**Decision.** (2026-10-27, with the owner.) Every colour, spacing step, corner, type size and timing is a named CSS
custom property in `app/styles/tokens.css`; Stylelint rejects a raw value anywhere else. Spacing is the 4-pt grid
(whole pixels at every Windows scale) with a hierarchy: 20 between areas, 12 for an area's parts, 8 for things
attached to a box; text 28 px from its box to the letters. One outline rule: 12 px outside the plate you move or
resize, inset for a place to drop. Each skin is a file in `app/styles/themes/` (`data-skin` on `<html>`). The scripts
read the values they need from the CSS (`app/tokens.js`): there's no second copy. Saved style changes show without a
reload. How-to: `docs/CUSTOMIZING.md`.

**Consequences.** One place to change the look, by construction. Steps that shouldn't change anything are proven by
`cssdiff` (every computed style, 115 states). A type scale and a corner scale are later design steps.
