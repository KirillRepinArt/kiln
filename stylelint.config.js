// Stylelint: catches real mistakes in the CSS (unknown properties, typos in colours, duplicated declarations).
// Design tokens (v0.7 step 7): spacing comes from the scale in app/styles/tokens.css — a raw px value in a spacing
// property is an error (0 is fine; 1 and 2 px are --space-px / --space-hair). More token rules follow.
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
    },
  },
};
