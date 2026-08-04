import eslint from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier/flat"
import eslintPluginVue from "eslint-plugin-vue"
import globals from "globals"
import typescriptEslint from "typescript-eslint"
import eslintPluginPrettier from "eslint-plugin-prettier"

export default [
  { ignores: ["*.d.ts", "**/coverage", "**/dist", "**/dev-dist"] },
  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...eslintPluginVue.configs["flat/recommended"],
  ...eslintPluginVue.configs["flat/essential"],
  ...eslintPluginVue.configs["flat/strongly-recommended"],
  {
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },
  {
    files: ["**/*.{ts,vue}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        parser: typescriptEslint.parser,
        project: "./tsconfig.json",
        extraFileExtensions: [".vue"],
      },
    },
    rules: {
      "vue/block-order": ["error", { order: ["template", "script", "style"] }],

      "vue/max-attributes-per-line": "off",
      "vue/first-attribute-linebreak": "off",
      "vue/padding-line-between-tags": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/new-line-between-multi-line-property": "off",
      "vue/html-comment-content-spacing": "off",

      "vue/prefer-use-template-ref": ["error"],
      "vue/prefer-define-options": ["error"],
      "vue/component-name-in-template-casing": [
        "error",
        "PascalCase",
        {
          registeredComponentsOnly: true,
          ignores: [],
        },
      ],
      "vue/block-lang": ["error", { script: { lang: "ts" } }],
      "vue/component-api-style": ["error", ["script-setup"]],
      "vue/define-emits-declaration": ["error", "type-based"],
      "vue/define-macros-order": ["error", { order: ["defineProps", "defineEmits"] }],
      "vue/define-props-declaration": ["error", "type-based"],
      "vue/html-button-has-type": [
        "error",
        {
          button: true,
          submit: true,
          reset: true,
        },
      ],
      "vue/no-required-prop-with-default": ["error", { autofix: false }],
      "vue/require-typed-ref": ["error"],

      "@typescript-eslint/no-explicit-any": ["error"],
      "prettier/prettier": ["error"],
    },
  },
  eslintConfigPrettier,
]
