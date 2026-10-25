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
  /** the URL of a job's picture */
  fileUrl?: (j: unknown) => string | null;
  /** the theme's colour harmonics */
  HARM?: unknown;
  _cpv?: unknown;
  _dp?: unknown;
  _dpt?: unknown;
  _themeV?: unknown;
  _bgWave?: number;
  _rp?: unknown;
  /** the prompt's CodeMirror view (app/vendor has no type declarations) */
  __cm?: any;
  /** test mode only (?test): the end-to-end tests' handle (app/testing.js) */
  kiln?: Record<string, unknown>;
}
