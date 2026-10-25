// ESLint: catches real mistakes in the page's JavaScript (tools/ and tests run in Node).
// The page's files are ES modules: every name is imported or declared, so an undefined one is a missing import.
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
    languageOptions: { sourceType: "module", ecmaVersion: 2024, globals: { ...globals.browser } },
  },
  {
    files: ["tools/**/*.mjs", "*.js"],
    languageOptions: { sourceType: "module", ecmaVersion: 2024, globals: { ...globals.node } },
  },
];
