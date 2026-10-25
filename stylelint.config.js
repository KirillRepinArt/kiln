// Stylelint: catches real mistakes in the CSS (unknown properties, typos in colours, duplicated declarations).
// Later steps add more: the formatter pass (step 3) and the design-token rule — no raw colours or sizes outside the
// tokens file (step 7).
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
    "selector-pseudo-element-no-unknown": [true, { ignorePseudoElements: ["view-transition-group", "view-transition-old", "view-transition-new", "view-transition-image-pair"] }],
    "selector-type-no-unknown": [true, { ignoreTypes: ["/^cm-/"] }],
    "media-feature-name-no-unknown": true,
    "at-rule-no-unknown": true,
    "keyframe-declaration-no-important": true,
    "no-duplicate-at-import-rules": true,
    "no-invalid-double-slash-comments": true,
    "block-no-empty": true,
  },
};
