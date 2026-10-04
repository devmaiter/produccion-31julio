import { defineConfig } from "vite";

// Empaqueta el lector como un solo archivo clásico (window.LectorBackline)
// para páginas sin bundler, como cordillera/backline-esc2.html.
export default defineConfig({
  build: {
    target: "es2022",
    outDir: "dist-lib",
    emptyOutDir: true,
    minify: true,
    lib: { entry: "src/lib.ts", name: "LectorBackline", formats: ["iife"], fileName: () => "lector.js" },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
