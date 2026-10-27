import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Playwright output. These are gitignored and are recreated or
    // deleted while a test run is in progress, which makes ESLint's file walk
    // fail with ENOENT if it scans them.
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
