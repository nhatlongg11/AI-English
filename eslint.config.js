import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".tmp/**",
      "frontend/src/components/ui/**",
      "frontend/src/components/rewards/CountUp.tsx",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["frontend/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        RequestInit: "readonly",
        Response: "readonly",
        KeyboardEvent: "readonly",
        HTMLElement: "readonly",
        Element: "readonly",
        ResizeObserver: "readonly",
        setTimeout: "readonly",
        AbortController: "readonly",
        URL: "readonly",
        Blob: "readonly",
        console: "readonly",
      },
    },
    plugins: { "react-hooks": hooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts", "*.ts"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        NodeJS: "readonly",
        crypto: "readonly",
      },
    },
  },
);
