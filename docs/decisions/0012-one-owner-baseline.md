# 0012 · One owner for every moving or visible thing, checked by tests

**Context.** Kiln's motion grew feature by feature: each fix made one symptom right and passed its own test. By
2026-10-28 most visual bugs were several writers meeting in one place — the tab bar moved by four scripts and CSS
glides, the picture frame's box by three, a tab switch timed by five clocks (CSS keyframes, the browser's View
Transition groups, three scripts), the picture's buttons shown both by hover and by the switch, paint order left to the
order of the page. Each writer looked fine alone; the bug was where they met.

**Decision.** For anything that moves, shows or hides:
1. Write the model first — the states, the transitions, and the one owner of each property (position, size,
   opacity/visibility, clip, paint order, timing, "is it shown?"). Similar changes use one system: every tab switch
   goes through `plate.js switchGlide`, every change of a box's shape through `layoutmath.js shapeSteps`, the frame's
   box through `framebox.js`, paint order through one rule in `glass.css`.
2. New behaviour plugs into the existing owner; when none fits, a new owner — never a second writer.
3. The rules are tests, measured per frame: one writer per property per motion, one clock per motion, nothing visible
   while its decider says hidden, no reversal mid-motion. A runtime writer tracer runs the whole app through a scripted
   tour in CI and fails on a second writer or a blink.
4. A browser feature that takes over drawing or timing gets a decision record before it's used. View Transitions were
   dropped for tab switches on 2026-10-28: their snapshots can't hold glass (a backdrop blur), naming an element
   changes what paints over what, the overlay takes the pointer, and they run on their own clock.

**Consequences.** Slower first steps (a model and an invariant test before the feature), far fewer refactors, and a
CI that catches the next second writer before anyone sees it. Common practice in design systems and UI frameworks
(one transition system, state → layout → one animator); recorded because Kiln is imperative (0002) and nothing in
the code structure enforces it on its own.
