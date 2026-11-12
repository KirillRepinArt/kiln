// @ts-check
/* Kiln · the scripts' reader of the design tokens. Every value lives once, in app/tokens/base.tokens.json (generated
   into styles/tokens.css); scripts read it here and never copy it — no defaults, no fallbacks (ARCHITECTURE › every
   design token's one source). With a page the values are the stylesheet's; without one (the unit tests) they are the
   map tools/tests/tokens-sheet.mjs makes from tokens.css. Read on first use, cached; initTokens() drops the
   cache (start-up, a theme change, a stylesheet reload). */

/** @type {Map<string, string>} */
const cache = new Map();
/** which read of the tokens this is: a reader that builds something from a value (a curve) rebuilds when it changes */
export let tokenGen = 0;

/** a token's value as written, `var()` chains resolved @param {string} name its custom property */
function raw(name) {
  const had = cache.get(name);
  if (had !== undefined) return had;
  /** @type {Record<string, string> | undefined} */
  const sheet = Reflect.get(globalThis, "KILN_TOKENS");
  const found =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue(name)
      : (sheet?.[name] ?? "");
  const v = found.trim().replace(/\s+/g, " ");
  if (!v) throw new Error(`tokens.js: no token ${name}`);
  cache.set(name, v);
  return v;
}

/** a duration in ms (`150ms`, `0.42s`) @param {string} name */
export function ms(name) {
  const v = raw(name),
    n = parseFloat(v);
  if (!Number.isFinite(n)) throw new Error(`tokens.js: ${name} is not a duration: ${v}`);
  return /\dms$/.test(v) ? n : /\ds$/.test(v) ? n * 1000 : n;
}

/** a curve as CSS / WAAPI wants it (`cubic-bezier(…)`, `linear`) — WAAPI can't read var() @param {string} name */
export function easing(name) {
  return raw(name);
}

/** a curve's four numbers @param {string} name @returns {[number, number, number, number]} */
export function bezier(name) {
  const m = raw(name).match(/^cubic-bezier\(([^)]*)\)$/);
  const p = m ? m[1].split(",").map(Number) : [];
  if (p.length !== 4 || p.some(x => !Number.isFinite(x))) throw new Error(`tokens.js: ${name} is not a cubic-bezier`);
  return /** @type {[number, number, number, number]} */ (p);
}

/** a plain number, or px without its unit @param {string} name */
export function num(name) {
  const v = parseFloat(raw(name));
  if (!Number.isFinite(v)) throw new Error(`tokens.js: ${name} is not a number`);
  return v;
}

/** a number from tokens.css, read where it's used @param {string} name its custom property */
export const tok = num;

/** The spacing hierarchy, in px (filled from the tokens by initTokens): between areas, an area and its parts, things
 * attached to a box; how far a moving / resizing outline sits outside its plate; the picture's mat inside its plate. */
export const SPACE = { area: 0, pane: 0, part: 0, tight: 0, outline: 0, bandIn: 0, mat: 0 };
const NAMES = {
  area: "--gap-area",
  pane: "--gap-pane",
  part: "--gap-part",
  tight: "--gap-tight",
  outline: "--outline-out",
  bandIn: "--band-in",
  mat: "--mat",
};

export function initTokens() {
  cache.clear();
  tokenGen++;
  for (const k of /** @type {(keyof typeof SPACE)[]} */ (Object.keys(SPACE))) SPACE[k] = num(NAMES[k]);
}

if (typeof document === "undefined") initTokens(); // the unit tests: the map is in place before any module loads
