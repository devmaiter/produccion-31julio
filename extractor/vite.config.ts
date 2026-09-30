import { defineConfig } from "vite";

// El extractor usa el código de ../lector tal cual (sin publicarlo como paquete).
export default defineConfig({
  base: "./",
  server: { fs: { allow: [".."] }, port: 5180 },
  build: { target: "es2022", outDir: "dist", emptyOutDir: true },
  optimizeDeps: { exclude: ["pdfjs-dist"] },
});
