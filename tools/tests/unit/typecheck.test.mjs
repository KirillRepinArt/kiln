// Every page file is type-checked: tsc checks a file only when it starts with // @ts-check (checkJs stays off, or it
// would check the vendored CodeMirror too), so a new file without the line would slip through unchecked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const app = new URL("../../../app/", import.meta.url);

test("every app/*.js starts with // @ts-check", () => {
  const files = readdirSync(app).filter(f => f.endsWith(".js"));
  assert.ok(files.length > 30, `found only ${files.length} files`);
  const missing = files.filter(f => !/^\/\/ @ts-check\r?\n/.test(readFileSync(new URL(f, app), "utf8")));
  assert.deepEqual(missing, []);
});
