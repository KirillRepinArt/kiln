// The design tokens' one source → the CSS the app loads.
//
//   node tools/tokens.mjs           write app/styles/tokens.css from app/tokens/base.tokens.json, and app/styles/themes.css
//                                   from app/tokens/themes/*.tokens.json (each theme: the base tokens it sets, by path)
//   node tools/tokens.mjs --check   fail if the committed CSS isn't what the JSON says (CI, npm run lint)
//
// The source is the W3C Design Tokens Community Group format (DTCG 2025.10): groups of tokens, each a typed $value
// (color, dimension, duration, cubicBezier, number) or an alias ("{group.token}"). A CSS expression the format can't type
// (color-mix, min / calc, an oklch gradient, a shadow list) is marked $extensions["dev.kiln"].css, its aliases written
// the same way. A group's CSS name prefix: $extensions["dev.kiln"].prefix ("" for none). A token's comment: $description
// (after it) and dev.kiln.above (above it). dev.kiln.property registers it (@property). Nothing from npm at runtime.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "app", "tokens", "base.tokens.json"),
  OUT = join(ROOT, "app", "styles", "tokens.css"),
  THEMES = join(ROOT, "app", "tokens", "themes"),
  THEMES_OUT = join(ROOT, "app", "styles", "themes.css");

const K = "dev.kiln";
const isMeta = (/** @type {string} */ k) => k.startsWith("$");

/** every token of a document, in order: its path, CSS name and node; a theme's group takes the base group's prefix
 *  @param {any} doc @param {any} [base] */
export function tokensOf(doc, base) {
  const out = [];
  for (const [g, grp] of Object.entries(doc)) {
    if (isMeta(g)) continue;
    const prefix = base?.[g]?.$extensions?.[K]?.prefix ?? grp.$extensions?.[K]?.prefix ?? g;
    for (const [k, tok] of Object.entries(grp)) {
      if (isMeta(k)) continue;
      out.push({ path: `${g}.${k}`, name: "--" + (prefix ? `${prefix}-${k}` : k), tok });
    }
  }
  return out;
}

/** a token's value as CSS @param {any} tok @param {Map<string, string>} names path → CSS name */
export function cssValue(tok, names) {
  const v = tok.$value;
  const refs = (/** @type {string} */ s) =>
    s.replace(/\{([\w.-]+)\}/g, (_, p) => {
      const n = names.get(p);
      if (!n) throw new Error(`unknown alias {${p}}`);
      return `var(${n})`;
    });
  if (typeof v === "string") return refs(v); // an alias, or a CSS expression (dev.kiln.css)
  switch (tok.$type) {
    case "color": {
      if (v.alpha === undefined || v.alpha === 1) return v.hex;
      const [r, g, b] = v.components.map((/** @type {number} */ c) => Math.round(c * 255));
      return `rgba(${r}, ${g}, ${b}, ${v.alpha})`;
    }
    case "dimension":
    case "duration":
      return `${v.value}${v.unit}`;
    case "cubicBezier":
      return `cubic-bezier(${v.join(", ")})`;
    case "number":
    case "fontFamily":
      return String(v);
    default:
      throw new Error(`a $type this generator doesn't write: ${tok.$type}`);
  }
}

/** the CSS for a token document @param {any} doc @param {string} srcName */
export function toCss(doc, srcName) {
  const all = tokensOf(doc),
    names = new Map(all.map(t => [t.path, t.name]));
  const lines = [
    `/* GENERATED from ${srcName} by tools/tokens.mjs: edit the JSON, then npm run tokens (CI fails if the two differ) */`,
  ];
  if (doc.$description) lines.push(`/* ${doc.$description} */`);
  lines.push(":root {");
  const props = [];
  for (const { name, tok } of all) {
    const x = tok.$extensions?.[K] || {};
    if (x.above) lines.push(`  /* ${x.above} */`);
    lines.push(`  ${name}: ${cssValue(tok, names)};${tok.$description ? ` /* ${tok.$description} */` : ""}`);
    if (x.property) props.push({ name, p: x.property, note: x.propertyNote });
  }
  lines.push("}");
  for (const { name, p, note } of props) {
    if (note) lines.push(`/* ${note} */`);
    lines.push(`@property ${name} {`, `  syntax: "${p.syntax}";`, `  inherits: ${p.inherits};`);
    lines.push(`  initial-value: ${p.initial};`, "}");
  }
  return lines.join("\n") + "\n";
}

/** the themes' CSS: one block per theme, the tokens it sets @param {any} base @param {[string, any][]} themes */
export function themesCss(base, themes) {
  const baseNames = new Map(tokensOf(base).map(t => [t.path, t.name]));
  const lines = [
    "/* GENERATED from app/tokens/themes/*.tokens.json by tools/tokens.mjs: edit the JSON, then npm run tokens */",
    "/* A theme = these values (by path, over the base tokens) + its effects in skins.js (the background, the cover over a",
    "   young picture, the glow, the finish) + any rules only it has (themes/<name>.css). index.html sets data-skin. */",
  ];
  for (const [name, doc] of themes) {
    const own = tokensOf(doc, base),
      names = new Map([...baseNames, ...own.map(t => /** @type {[string, string]} */ ([t.path, t.name]))]);
    if (doc.$description) lines.push(`/* ${doc.$description} */`);
    lines.push(`:root[data-skin="${name}"] {`);
    for (const { name: n, tok } of own) {
      const x = tok.$extensions?.[K] || {};
      if (x.above) lines.push(`  /* ${x.above} */`);
      lines.push(`  ${n}: ${cssValue(tok, names)};${tok.$description ? ` /* ${tok.$description} */` : ""}`);
    }
    lines.push("}");
  }
  return lines.join("\n") + "\n";
}

/** @param {string} css @param {string} file */
async function pretty(css, file) {
  return prettier.format(css, { ...(await prettier.resolveConfig(file)), filepath: file });
}

async function main() {
  const doc = JSON.parse(readFileSync(SRC, "utf8"));
  const themes = /** @type {[string, any][]} */ (
    readdirSync(THEMES)
      .filter(f => f.endsWith(".tokens.json"))
      .sort()
      .map(f => [f.replace(".tokens.json", ""), JSON.parse(readFileSync(join(THEMES, f), "utf8"))])
  );
  const out = [
    [OUT, await pretty(toCss(doc, "app/tokens/base.tokens.json"), OUT)],
    [THEMES_OUT, await pretty(themesCss(doc, themes), THEMES_OUT)],
  ];
  if (process.argv.includes("--check")) {
    for (const [file, css] of out) {
      let now = "";
      try {
        now = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      } catch {}
      if (now !== css) {
        console.error(
          `${file.slice(ROOT.length + 1)} isn't what app/tokens/ says: run npm run tokens (edit the JSON, not the CSS)`,
        );
        process.exit(1);
      }
    }
    console.log("tokens: the CSS matches its source");
    return;
  }
  for (const [file, css] of out) writeFileSync(file, css);
  console.log("tokens: wrote app/styles/tokens.css and app/styles/themes.css");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
