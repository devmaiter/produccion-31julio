import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { RegistroOps } from "./src/sync/registro";

const RAIZ = fileURLToPath(new URL(".", import.meta.url));

/** En `npm run dev` el mismo /api/sync del servidor del evento, para probar la sincronización. */
function syncDesarrollo(): Plugin {
  return {
    name: "sync-desarrollo",
    apply: "serve",
    configureServer(server) {
      if (process.env.VITEST) return;
      const registro = new RegistroOps(join(RAIZ, "evento-datos", "ops-dev.jsonl"));
      server.middlewares.use("/api/sync", (req, res, next) => {
        if (req.method !== "POST") return next();
        const partes: Buffer[] = [];
        req.on("data", (c: Buffer) => partes.push(c));
        req.on("end", () => {
          res.setHeader("Content-Type", "application/json");
          try { res.end(JSON.stringify(registro.sincronizar(JSON.parse(Buffer.concat(partes).toString() || "{}")))); }
          catch { res.statusCode = 400; res.end("{}"); }
        });
      });
    },
  };
}

/** Genera dist/sw.js con la lista de todos los archivos de la app: con eso
 *  la app abre y funciona sin conexión después de la primera visita. */
function serviceWorker(): Plugin {
  return {
    name: "service-worker",
    apply: "build",
    closeBundle() {
      const dist = join(RAIZ, "dist");
      const archivos: string[] = [];
      const recorrer = (d: string) => readdirSync(d).forEach(f => {
        const p = join(d, f);
        if (statSync(p).isDirectory()) recorrer(p);
        else if (!/\.map$|^sw\.js$/.test(f)) archivos.push(relative(dist, p).split("\\").join("/"));
      });
      recorrer(dist);
      const hash = createHash("sha256");
      for (const a of archivos.sort()) hash.update(a).update(readFileSync(join(dist, a)));
      const plantilla = readFileSync(join(RAIZ, "src", "sw-plantilla.js"), "utf8");
      writeFileSync(join(dist, "sw.js"), plantilla
        .replace("__VERSION__", hash.digest("hex").slice(0, 12))
        .replace("__ARCHIVOS__", JSON.stringify(["./", ...archivos.filter(a => a !== "index.html")])));
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [syncDesarrollo(), serviceWorker()],
  worker: { format: "es" },
});
