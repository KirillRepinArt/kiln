# 0014 · No View Transitions: every rearrangement moves the live page

**Status:** accepted 2026-11-07 (v0.7c T2b). **Supersedes:** the layout switch's View Transition (layout.js layMorph, since v0.6).

## Context

Kiln had two motion systems for "the window rearranges". Tab switches moved the real elements (`plate.js` switchGlide: the glass plate's box by the shape steps, the views riding it, one clock). The Left / Right / Vertical switch used the browser's View Transition API: the page is snapshotted, the snapshots cross-fade, a named picture travels as an image.

The snapshot cannot carry Kiln's look:
- **Glass:** backdrop blur isn't in a snapshot; and in Chrome a named element becomes a backdrop root the moment the transition starts, so the glass loses its blur before anything fades and gets it back only when the transition ends (the user, 2026-11-07: "it removes the blur first, then fades the pic in, then applies the blur").
- **Corners and outline:** the picture is an image scaled and cropped by its group: its rounded corners scale (B20) and the plate's outline comes loose from it (ownership map T2).
- **Pointer:** the transition covers the page; clicks during it went to `<html>` (a click-through workaround was needed).
- **Timing:** the transition's own curve and length (`--sw-t` 440 ms) — a third motion language beside the switch's steps and the layout glides.

These are the same four limits that ruled View Transitions out for tab switches (decision 0012's baseline: glass, pointer, paint order, timing).

## Decision

No View Transitions in Kiln. A layout switch is a switch of the same view and runs on the tab switch's owner: the plate travels by the shape steps, the view rides it live (clipped to it), the tab bar rides it, and the prompt box — whose path would cross the picture's — fades out where it was and in where it lands (Material's fade-through; the picture is the element that persists: container transform / shared element). Same-page rearrangements (Reset, double-clicks) run on one applier with the same steps (`rearrange.js`, T2a).

## Consequences

- One motion language for every rearrangement: one plan (`layoutmath.js` shapePlan / shapeSteps), one fade (`fades()`), one clock per motion.
- `layMorph`, the `::view-transition-*` CSS, `html.laymorph` and the click-through workaround are deleted.
- The cost: the switch's code handles a same-view case (the view rides without fading). Browsers' View Transitions may improve (cross-document, nested groups); revisit only if they can keep backdrop filters live.
