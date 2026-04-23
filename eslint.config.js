import js from "@eslint/js";
import globals from "globals";
import tsEslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import prettierPlugin from "eslint-plugin-prettier/recommended";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/temp_repos/**",
      "**/node_modules/**",
      "**/.vite/**",
      "**/scripts/**",
    ],
  },
  js.configs.recommended,
  ...tsEslint.configs.recommended,
  prettierPlugin,
  {
    rules: {
      "no-empty": "warn",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "warn",
      "prettier/prettier": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
