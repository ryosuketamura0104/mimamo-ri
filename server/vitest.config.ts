import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    env: {
      DATABASE_URL:
        "postgresql://mimamori:mimamori@localhost:5432/mimamori_test",
      APP_URL: "http://localhost:3000",
      NODE_ENV: "test",
    },
  },
});
