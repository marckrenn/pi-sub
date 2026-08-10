import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ["node_modules", "coverage", "dist"],
  },
  {
    files: ["**/*.test.ts", "**/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    rules: {
      // Terminal UI code intentionally matches ANSI escape sequences.
      "no-control-regex": "off",
      // Polling loops use intentional while (true) with internal breaks.
      "no-constant-condition": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/settings-types.ts"],
    rules: {
      // Branded string unions use `(string & {})` for autocomplete.
      "@typescript-eslint/ban-types": "off",
    },
  },
);
