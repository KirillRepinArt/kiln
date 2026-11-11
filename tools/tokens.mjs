// The design tokens' one source → the CSS the app loads.
//
//   node tools/tokens.mjs           write app/styles/tokens.css from app/tokens/base.tokens.json
//   node tools/tokens.mjs --check   fail if the committed CSS isn't what the JSON says (CI, npm run lint)
//
// The source is the W3C Design Tokens Community Group format (DTCG 2025.10): groups of tokens, each a typed $value
// (color, dimension, duration, cubicBezier, number) or an alias ("{group.token}"). A CSS expression the format can't type
// (color-mix, min / calc, an oklch gradient, a shadow list) is marked $extensions["dev.kiln"].css, its aliases written
// the same way. A group's CSS name prefix: $extensions["dev.kiln"].prefix ("" for none). A token's comment: $description
// (after it) and dev.kiln.above (above it). dev.kiln.property registers it (@property). Nothing from npm at runtime.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "app", "tokens", "base.tokens.json"),
  OUT = join(ROOT, "app", "styles", "tokens.css");

const K = "dev.kiln";
const isMeta = (/** @type {string} */ k) => k.startsWith("$");

/** every token of a document, in order: its path, CSS name and node @param {any} doc */
export function tokensOf(doc) {
  const out = [];
  for (const [g, grp] of Object.entries(doc)) {
    if (isMeta(g)) continue;
    const prefix = grp.$extensions?.[K]?.prefix ?? g;
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

async function main() {
  const doc = JSON.parse(readFileSync(SRC, "utf8"));
  const css = await prettier.format(toCss(doc, "app/tokens/base.tokens.json"), {
    ...(await prettier.resolveConfig(OUT)),
    filepath: OUT,
  });
  if (process.argv.includes("--check")) {
    const now = readFileSync(OUT, "utf8").replace(/\r\n/g, "\n");
    if (now !== css) {
      console.error(
        "tokens.css isn't what app/tokens/base.tokens.json says: run npm run tokens (and edit the JSON, not the CSS)",
      );
      process.exit(1);
    }
    console.log("tokens: the CSS matches its source");
    return;
  }
  writeFileSync(OUT, css);
  console.log("tokens: wrote app/styles/tokens.css");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
