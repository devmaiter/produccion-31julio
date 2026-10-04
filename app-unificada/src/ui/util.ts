export const $ = <T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel)!;
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document) => [...raiz.querySelectorAll<T>(sel)];

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const minutos = (h: string) => { const [a, b] = h.split(":").map(Number) as [number, number]; return a * 60 + b; };

/** Preferencias de este dispositivo (vista, evento, día). Si el almacenamiento falla, no pasa nada. */
export const pref = {
  leer(k: string): string | null { try { return localStorage.getItem(`backline:${k}`); } catch { return null; } },
  guardar(k: string, v: string) { try { localStorage.setItem(`backline:${k}`, v); } catch { /* modo privado */ } },
};

/** Reduce una foto del celular (varios MB) a un JPEG de ≈1280 px para guardarla y sincronizarla. */
export async function reducirFoto(archivo: Blob, lado = 1280, calidad = 0.72): Promise<string> {
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, lado / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  img.close();
  return c.toDataURL("image/jpeg", calidad);
}

export function descargar(nombre: string, contenido: string, tipo = "application/json") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
