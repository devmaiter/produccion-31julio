/* Servidor del evento: corre en el portátil de producción.
 *
 *   npm run evento            (construye la app y la sirve en el puerto 8080)
 *
 * Los celulares se conectan a la misma red (el Wi-Fi del portátil o un
 * router en tarima; no hace falta internet), abren la dirección que se
 * imprime aquí (o escanean el QR) y sincronizan sus cambios con este
 * portátil. Todas las operaciones quedan en evento-datos/ops.jsonl.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { RegistroOps } from "../src/sync/registro";

const RAIZ = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(RAIZ, "dist");
const PUERTO = Number(process.env.PUERTO ?? process.env.PORT ?? 8080);
const MAX_CUERPO = 60 * 1024 * 1024;

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".wasm": "application/wasm", ".gz": "application/gzip",
  ".map": "application/json", ".txt": "text/plain; charset=utf-8",
};

if (!existsSync(join(DIST, "index.html"))) {
  console.error("No encuentro dist/: corre `npm run evento` (construye la app antes de servirla).");
  process.exit(1);
}

const registro = new RegistroOps(join(RAIZ, "evento-datos", "ops.jsonl"));

function leerCuerpo(req: IncomingMessage): Promise<unknown> {
  return new Promise((ok, mal) => {
    let tam = 0;
    const partes: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      tam += c.length;
      if (tam > MAX_CUERPO) { mal(new Error("demasiado grande")); req.destroy(); return; }
      partes.push(c);
    });
    req.on("end", () => { try { ok(JSON.parse(Buffer.concat(partes).toString("utf8") || "{}")); } catch { mal(new Error("JSON inválido")); } });
    req.on("error", mal);
  });
}

function json(res: ServerResponse, estado: number, cuerpo: unknown) {
  res.writeHead(estado, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(cuerpo));
}

function archivo(req: IncomingMessage, res: ServerResponse) {
  const ruta = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  let destino = normalize(join(DIST, ruta));
  if (!destino.startsWith(DIST + sep) && destino !== DIST) { res.writeHead(403).end(); return; }
  if (!existsSync(destino) || statSync(destino).isDirectory()) destino = join(DIST, "index.html");
  const ext = extname(destino);
  res.writeHead(200, {
    "Content-Type": TIPOS[ext] ?? "application/octet-stream",
    // Lo que tiene hash en el nombre no cambia; lo demás se revisa siempre.
    "Cache-Control": /[.-][A-Za-z0-9_-]{8}\.(js|css)$/.test(destino) ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(destino).pipe(res);
}

const servidor = createServer(async (req, res) => {
  try {
    const ruta = new URL(req.url ?? "/", "http://x").pathname;
    if (ruta === "/api/sync" && req.method === "POST") return json(res, 200, registro.sincronizar(await leerCuerpo(req)));
    if (ruta === "/api/estado") {
      const activos = [...registro.dispositivos.values()].filter(t => Date.now() - t < 60_000).length;
      return json(res, 200, { servidor: registro.instancia, operaciones: registro.total, dispositivosActivos: activos });
    }
    if (ruta === "/api/respaldo") {
      res.writeHead(200, { "Content-Type": "application/x-ndjson", "Content-Disposition": `attachment; filename="backline-respaldo-${new Date().toISOString().slice(0, 10)}.jsonl"` });
      return res.end(registro.todas().map(o => JSON.stringify(o)).join("\n") + "\n");
    }
    if (ruta.startsWith("/api/")) return json(res, 404, { error: "no existe" });
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
    archivo(req, res);
  } catch (err) {
    json(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
});

servidor.listen(PUERTO, "0.0.0.0", async () => {
  const ips = Object.values(networkInterfaces()).flat()
    .filter(i => i && i.family === "IPv4" && !i.internal).map(i => i!.address);
  console.log(`\nBackline · servidor del evento (${registro.total} operaciones guardadas)\n`);
  console.log(`  En este portátil:  http://localhost:${PUERTO}`);
  for (const ip of ips) {
    const url = `http://${ip}:${PUERTO}`;
    console.log(`  En los celulares:  ${url}\n`);
    console.log(await QRCode.toString(url, { type: "terminal", small: true }));
  }
  if (!ips.length) console.log("  (No hay red: conecta el portátil a un router o crea un punto de acceso Wi-Fi.)");
  console.log("Deja esta ventana abierta durante el evento. Ctrl+C para cerrar.\n");
});
