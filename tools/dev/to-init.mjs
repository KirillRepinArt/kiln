// v0.7 step 4b: move each file's load-time statements (wiring, first renders) into one init<File>() at its end;
// declarations stay where they are. Comments directly above a moved statement move with it.
//   node tools/dev/to-init.mjs app/state.js app/composer.js ...   (prints the init function names, in order)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, basename } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const espree = require("espree");
const DECL = new Set(["FunctionDeclaration", "VariableDeclaration", "ClassDeclaration"]);

for (const f of process.argv.slice(2)) {
  const src = readFileSync(f, "utf8");
  const ast = espree.parse(src, { ecmaVersion: "latest", sourceType: "script", comment: true, range: true });
  const name = "init" + basename(f, ".js").replace(/^./, c => c.toUpperCase());
  // each statement owns the text from the end of the previous one (its leading comments) to its own end
  let kept = "",
    moved = [],
    prevEnd = 0;
  for (const st of ast.body) {
    // a comment on the same line as the previous statement's end belongs to that statement
    const nl = src.indexOf("\n", prevEnd);
    const sameLine = nl === -1 || nl > st.start ? st.start : nl;
    const tail = src.slice(prevEnd, sameLine); // trailing comment of the previous statement, if any
    const lead = src.slice(sameLine, st.start); // blank lines and comments above this statement
    const body = src.slice(st.start, st.end);
    if (DECL.has(st.type)) kept += tail + lead + body;
    else {
      kept += tail;
      moved.push((lead.replace(/^\n+/, "\n") + body).replace(/^\n/, ""));
    }
    prevEnd = st.end;
  }
  kept += src.slice(prevEnd);
  if (!moved.length) continue;
  const out =
    kept.replace(/\s*$/, "\n") +
    `\n/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */\nfunction ${name}() {\n` +
    moved.join("\n") +
    "\n}\n";
  writeFileSync(f, out);
  console.log(name, `(${moved.length} statements)`);
}
