# 0015 · One transition per change: roles, copies for what leaves, glass faded by its parts

**Status:** accepted 2026-11-08 (v0.7c T2c). Built: the glue and its relation change, the leaving copy, glass faded by its parts, the material as one layer, the same picture leaving as its copy. To build: one driver for every change (the plate's motion in tab and layout switches, browsing). **Amends:** [0014](0014-no-view-transitions.md) — the prompt box no longer fades in place during a layout switch.

## Context

After 0014, five engines still moved the page: the same-page applier (`rearrange.js`), the switches' keyframes (`plate.js` switchGlide), the picture's crop-and-reveal (`morph.js` + `framebox.js`), the plate's catch-up loop, and the prompt column's own glide and fades. Each decided its own timing, and every bug found in a day of use lived between them:

- The leaving prompt box showed its old size **by holding the old values on the real box**: the layout measured the box mid-switch, read the old shape, and moved the page under it.
- The box **sat still and faded** on the schedule meant for a pane's contents, while the picture moved into it.
- The box faded by its column's opacity, so **its glass lost its blur** until the fade ended (an element below full opacity is a backdrop root).
- The box's ring and shadow were painted **outside its glass layer**, so an empty outline was left behind when the glass faded.
- In a layout switch the picture doesn't change, so nothing held its copy, and the crop-and-reveal **hid it until the swap**: the plate travelled empty.

## Decision

Every change — a tab switch, a layout switch, browsing, a Reset, a double-click, a panel's height — is one **transition**: capture every participant, apply the change at once, plan what travels, give each participant one role, run every role on one clock. The platforms' model: Android's `TransitionManager.beginDelayedTransition` (start values, end values, a set of per-view transitions), SwiftUI's transactions with `matchedGeometryEffect` and `.transition`, Framer Motion's `LayoutGroup` and `AnimatePresence`. The roles: **travels** (the plate), **rides** (contents that stay the same), **swaps** (contents replaced), **follows** (everything derived from a box), **appears / disappears** (state round the picture).

The rules this builds on, each a standard:

1. **What leaves is a copy; the real element is at its end state from the first frame.** Everything that measures it measures the truth. Android adds a disappearing view to the overlay, out of the layout; UIKit fades a `snapshotView(afterScreenUpdates: false)`. Kiln copies the elements (`cloneNode`), not their pixels, so the glass stays live (0014). Taking only half of this — showing the start values on the real element — is what moved the page under the box.
2. **The prompt box is always glued to its partner pane.** The glue has a relation (beside the plate, or under it). A tab switch or a Reset keeps the relation and the box rides along; a layout switch changes it, so the box fades through the change while staying glued: out on the old relation early in the motion, in on the new one as the plate lands. Material's container transform; UIKit subviews riding their superview.
3. **Glass never fades through an ancestor.** CSS Filter Effects 2 makes an element below full opacity a backdrop root; Apple documents the same for `UIVisualEffectView` (no alpha below 1 on the view or its superviews). A group is faded by its parts (`fade.js`): each glass layer by its own opacity, each part without glass as a whole, nothing that holds glass.
4. **A material is one layer.** In glass mode its tint, ring and shadow are all on the glass layer (`::before`); the element that holds it paints nothing, so the material fades as one.
5. **Every change of what's on show leaves as its own copy** at its old size (`pictures.js`), a layout switch included: the old size is cropped, the new revealed.
6. **Letting go ends a press before anything acts on the release** (the pointerup's capture phase).

## Consequences

- The motion rules live in one place each: the glue and its relation change in `layoutmath.js` (pure, unit-tested), fading in `fade.js`, the leaving copy in `layout.js` `standIn`, the look in `glass.css`.
- Tests check the rules per frame, on what is seen: the box on its relation to the live plate, no glass under a part-way fade, what holds glass painting nothing itself, the picture seen and covering its frame. Each fails on the code before its fix.
- Until the one driver is built, the box rides a plate written by other loops: a 2–3 px slip for one or two frames, in about one run in three.
- A copy of the elements must look like the original: the look can't depend on element ids (copies drop them). Kiln's CSS styles the copied parts by class.
