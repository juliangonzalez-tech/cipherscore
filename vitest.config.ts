import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig keeps `jsx: "preserve"` for Next.js; tests need the JSX actually compiled.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) }
  },
  test: {
    // Pure-logic tests run in Node (real Web Crypto). Component tests opt in to jsdom with a
    // `// @vitest-environment jsdom` comment at the top of the file.
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    unstubGlobals: true
  }
});
