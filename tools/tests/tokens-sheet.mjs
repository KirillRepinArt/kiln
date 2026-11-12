// The tokens for app code run in Node (the unit tests, the e2e runner): app/styles/tokens.css's :root, parsed — the same file the page reads, no second copy.
// Loaded before any app module: by `node --import` (npm run test:unit) and by run.mjs (tokens.js reads globalThis.KILN_TOKENS when there is no page).
// var() chains are resolved; px arithmetic (calc / min / max) is evaluated, as the browser computes it.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CSS = join(import.meta.dirname, "..", "..", "app", "styles", "tokens.css");

/** the :root block's declarations, comments stripped @param {string} css */
export function rootDecls(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const at = src.indexOf(":root");
  const open = src.indexOf("{", at);
  let depth = 0,
    end = open;
  for (; end < src.length; end++) {
    if (src[end] === "{") depth++;
    else if (src[end] === "}" && --depth === 0) break;
  }
  /** @type {Record<string, string>} */
  const out = {};
  for (const m of src.slice(open + 1, end).matchAll(/(--[\w-]+)\s*:\s*([^;]*);/g))
    out[m[1]] = m[2].replace(/\s+/g, " ").trim();
  return out;
}

/** every token with var() resolved and px arithmetic evaluated @param {Record<string, string>} decls */
export function resolve(decls) {
  /** @type {Record<string, string>} */
  const out = {};
  const get = (/** @type {string} */ name, /** @type {Set<string>} */ seen) => {
    if (name in out) return out[name];
    if (!(name in decls) || seen.has(name)) return "";
    seen.add(name);
    let v = decls[name];
    for (let i = 0; i < 20 && /var\(/.test(v); i++)
      v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, n, fb) => get(n, seen) || (fb ?? "").trim());
    if (/^(calc|min|max)\(/.test(v)) {
      const js = v
        .replace(/px/g, "")
        .replace(/\bcalc\(/g, "(")
        .replace(/\b(min|max)\(/g, "Math.$1(");
      if (/^[\d.\s+\-*/(),Mathminax]+$/.test(js)) v = Function(`return (${js})`)() + "px";
    }
    return (out[name] = v);
  };
  for (const name of Object.keys(decls)) get(name, new Set());
  return out;
}

/** @type {any} */ (globalThis).KILN_TOKENS = resolve(rootDecls(readFileSync(CSS, "utf8")));
