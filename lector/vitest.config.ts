import { defineConfig } from "vitest/config";

// El PDF y el OCR tardan más de 5 s la primera vez que se cargan.
export default defineConfig({ test: { testTimeout: 30000 } });
