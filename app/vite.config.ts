import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { crearManejadores } from "./src/extraccion/servidor";

/** Monta /api/extraer y /api/guardar en el servidor de desarrollo. */
function apiExtraccion(): Plugin {
  return {
    name: "api-extraccion",
    apply: "serve",
    configureServer(server) {
      if (process.env.VITEST) return;
      const h = crearManejadores(fileURLToPath(new URL("./data", import.meta.url)));
      server.middlewares.use("/api/extraer", (req, res, next) => req.method === "POST" ? void h.manejarExtraer(req, res) : next());
      server.middlewares.use("/api/guardar", (req, res, next) => req.method === "POST" ? void h.manejarGuardar(req, res) : next());
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [apiExtraccion()],
});
