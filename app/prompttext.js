/* Kiln · prompt text as written → as sent: // comments dropped, {a|b} choices picked */

export function stripComments(t) {
  return t
    .split("\n")
    .filter(l => !/^\s*\/\//.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function expandVariants(t) {
  const picks = [];
  const out = t.replace(/\{([^{}]*\|[^{}]*)\}/g, (m, body) => {
    const o = body.split("|").map(x => x.trim());
    const c = o[Math.floor(Math.random() * o.length)];
    picks.push(c);
    return c;
  });
  return { text: out, picks };
}
