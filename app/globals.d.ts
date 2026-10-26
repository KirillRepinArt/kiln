/* Kiln · what the page keeps on `window`, for the type checker. These are run-time hooks and flags shared across the
   page (set by one module, read by others), plus the test handle. Fewer is better: each is a candidate for a proper
   export when its area gets its model (ROADMAP v0.7 step 5). */
interface Window {
  /** the page has its first answer from the server */
  LIVE?: boolean;
  /** the job list has arrived */
  _jobsReady?: boolean;
  /** the queue is paused (the server's flag, mirrored) */
  qPaused?: boolean;
  /** Settings: the Layout menu's selected entry */
  layMenuUI?: () => void;
  /** Aurora: redraw the halo round the picture now */
  haloNow?: () => void;
  /** the keyboard shortcut sheet */
  openKeys?: () => void;
  /** a burst of embers (the finish effect) */
  emberBurst?: (...a: unknown[]) => void;
  /** the cover / privacy eye */
  toggleCover?: () => void;
  coverHeld?: () => boolean;
  /** the theme's colour harmonics */
  HARM?: Record<string, string>;
  /** until when (ms) a changed cover shows on the idle frame */
  _cpv?: number;
  /** the status row's preview of a change is on */
  _dp?: number;
  /** its timer */
  _dpt?: number;
  /** counts theme changes (the effects redraw their sprites) */
  _themeV?: number;
  _bgWave?: number;
  /** a new queue order is on its way to the server: keep the local one */
  _rp?: boolean;
  /** the prompt's CodeMirror view (app/vendor has no type declarations) */
  __cm?: any;
  /** test mode only (?test): the end-to-end tests' handle (app/testing.js) */
  kiln?: Record<string, unknown>;
}
