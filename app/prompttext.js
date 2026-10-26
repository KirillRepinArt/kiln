// @ts-check
/* Kiln · prompt text as written → as sent: // comments dropped, {a|b} choices picked */

/** @param {string} t */
export function stripComments(t) {
  return t
    .split("\n")
    .filter(l => !/^\s*\/\//.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
/** @param {string} t */
export function expandVariants(t) {
  /** @type {string[]} */
  const picks = [];
  const out = t.replace(/\{([^{}]*\|[^{}]*)\}/g, (/** @type {string} */ m, /** @type {string} */ body) => {
    const o = body.split("|").map(x => x.trim());
    const c = o[Math.floor(Math.random() * o.length)];
    picks.push(c);
    return c;
  });
  return { text: out, picks };
}
