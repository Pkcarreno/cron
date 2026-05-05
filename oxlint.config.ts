import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react],
  jsPlugins: [
    { name: "react-native", specifier: "oxlint-plugin-react-native" },
  ],
  overrides: [
    {
      files: ["**/*.test.ts"],
      rules: {
        "jest/max-expects": "off",
        "jest/no-confusing-set-timeout": "off",
        "jest/no-hooks": "off",
        "jest/require-hook": "error",
        "max-statements": "off",
      },
    },
  ],
  rules: {
    "import/namespace": "off",
    "jest/require-hook": "off",
    "react-native/no-color-literals": "error",
    "react-native/no-inline-styles": "warn",
    "react-native/no-raw-text": [
      "error",
      {
        skip: [
          "Link",
          "FieldTitle",
          "FieldLabel",
          "FieldDescription",
          "MenuTopic",
          "MenuItemText",
        ],
      },
    ],
    "react-native/no-single-element-style-arrays": "error",
    "react-native/no-unused-styles": "warn",
    "react-native/sort-styles": "warn",
    "typescript/no-use-before-define": ["error", { variables: false }],
    "vitest/prefer-called-once": "off",
  },
});
