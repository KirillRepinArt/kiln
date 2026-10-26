// Stylelint: catches real mistakes in the CSS (unknown properties, typos in colours, duplicated declarations).
// Design tokens (v0.7 step 7): every colour, spacing step, corner, type size and duration lives in
// app/styles/tokens.css. Anywhere else a raw one is an error — use the token (0 is fine; 1 and 2 px of spacing are
// --space-px / --space-hair). rgba(var(--glass-…), opacity) is fine: the colour is the token.
export default {
  ignoreFiles: ["app/vendor/**", "app/fonts/**"],
  rules: {
    "color-no-invalid-hex": true,
    "declaration-block-no-duplicate-properties": [true, { ignore: ["consecutive-duplicates-with-different-syntaxes"] }],
    "declaration-block-no-duplicate-custom-properties": true,
    "property-no-unknown": true,
    "unit-no-unknown": true,
    "function-calc-no-unspaced-operator": true,
    "string-no-newline": true,
    "selector-pseudo-class-no-unknown": true,
    "selector-pseudo-element-no-unknown": [
      true,
      {
        ignorePseudoElements: [
          "view-transition-group",
          "view-transition-old",
          "view-transition-new",
          "view-transition-image-pair",
        ],
      },
    ],
    "selector-type-no-unknown": [true, { ignoreTypes: ["/^cm-/"] }],
    "media-feature-name-no-unknown": true,
    "at-rule-no-unknown": true,
    "keyframe-declaration-no-important": true,
    "no-duplicate-at-import-rules": true,
    "no-invalid-double-slash-comments": true,
    "block-no-empty": true,
    "declaration-property-value-disallowed-list": {
      "/^(padding|margin|gap|row-gap|column-gap|inset)/": ["/(^|[^\\w.-])[1-9][\\d.]*px/"],
      "/^(top|left|right|bottom)$/": ["/(^|[^\\w.-])[1-9][\\d.]*px/"],
      "/radius$/": ["/(^|[^\\w.-])[1-9][\\d.]*px/"],
      "font-size": ["/(^|[^\\w.-])[1-9][\\d.]*px/"],
      "/^font$/": ["/(^|[^\\w.-])[1-9][\\d.]*px/"],
      "/^(transition|animation)(-duration|-delay)?$/": ["/(^|[^\\w.-])(\\d*\\.)?\\d*[1-9]\\d*m?s\\b/"],
      "/^(?!--)/": ["/rgba?\\(\\s*\\d/", "/hsla?\\(/"],
    },
    "color-no-hex": true,
  },
  overrides: [
    {
      // where the raw values live: the tokens, and each skin's own
      files: ["app/styles/tokens.css", "app/styles/themes/*.css"],
      rules: { "color-no-hex": null, "declaration-property-value-disallowed-list": null },
    },
  ],
};
