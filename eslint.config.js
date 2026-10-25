// ESLint: catches real mistakes in the page's JavaScript (tools/ and tests run in Node).
// Until the page code becomes ES modules (ROADMAP v0.7 step 4) its files are plain scripts sharing globals, so
// "undefined variable" and "unused variable" can't be checked across files yet — they're switched on then.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["app/vendor/", "node_modules/", ".venv/", "tools/tests/out/"] },
  js.configs.recommended,
  {
    rules: {
      // `try { … } catch (e) {}` = "this may fail and that's fine" (a closed window, a file already gone) — allowed
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["error", { caughtErrors: "none" }],
    },
  },
  {
    files: ["app/**/*.js"],
    languageOptions: { sourceType: "script", ecmaVersion: 2024, globals: { ...globals.browser } },
    rules: { "no-undef": "off", "no-unused-vars": "off", "no-redeclare": "off" },
  },
  { files: ["app/editor.js"], languageOptions: { sourceType: "module" } },
  {
    files: ["tools/**/*.mjs", "*.js"],
    languageOptions: { sourceType: "module", ecmaVersion: 2024, globals: { ...globals.node } },
  },
];
