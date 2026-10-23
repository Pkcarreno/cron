import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react],
  ignorePatterns: [".agents/**", "benchmark/**"],
  jsPlugins: [
    { name: "react-native", specifier: "oxlint-plugin-react-native" },
  ],
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"],
      rules: {
        "react/globals": "off",
        "react/jsx-no-useless-fragment": "off",
      },
    },
  ],
  rules: {
    "node/callback-return": "off",
    "react-native/no-color-literals": "error",
    "react-native/no-inline-styles": "warn",
    "react-native/no-raw-text": [
      "error",
      {
        skip: [
          "FieldDescription",
          "FieldLabel",
          "FieldTitle",
          "Link",
          "MenuItemText",
          "MenuTopic",
        ],
      },
    ],
    "react-native/no-single-element-style-arrays": "error",
    "react-native/no-unused-styles": "warn",
    "react-native/sort-styles": "warn",
    "react/function-component-definition": "off",
    "react/immutability": "off",
    "react/memo-dependencies": "off",
    "react/purity": "off",
    "react/refs": "off",
    "typescript/no-use-before-define": ["error", { variables: false }],
  },
});
