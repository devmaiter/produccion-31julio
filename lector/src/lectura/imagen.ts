/* Imágenes en Node sin binarios nativos: decodificar PNG/JPEG, ampliar
 * (bilineal) y volver a PNG. El OCR lee bien las etiquetas de un plano
 * solo si las letras miden ≥ 30 px, y en los planos miden 8–12: por eso
 * se amplían 3×. En el navegador esto lo hace un canvas (navegador.ts). */
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

export interface Bitmap {
  ancho: number;
  alto: number;
  /** RGBA, 4 bytes por píxel. */
  datos: Uint8Array;
}

export interface ImagenAmpliada {
  bytes: Uint8Array;
  ancho: number;
  alto: number;
  factor: number;
}

export function decodificar(bytes: Uint8Array, extension: string): Bitmap {
  const ext = extension.toLowerCase().replace(/^\./, "");
  if (ext === "png") {
    const p = PNG.sync.read(Buffer.from(bytes));
    return { ancho: p.width, alto: p.height, datos: new Uint8Array(p.data.buffer, p.data.byteOffset, p.data.length) };
  }
  if (ext === "jpg" || ext === "jpeg") {
    const j = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
    return { ancho: j.width, alto: j.height, datos: j.data };
  }
  throw new Error(`No sé decodificar imágenes .${ext} (solo PNG y JPEG)`);
}

export function ampliar(img: Bitmap, factor: number): Bitmap {
  const W = Math.round(img.ancho * factor), H = Math.round(img.alto * factor);
  const out = new Uint8Array(W * H * 4);
  const src = img.datos, sw = img.ancho, sh = img.alto;
  for (let y = 0; y < H; y++) {
    const fy = Math.min(sh - 1, y / factor), y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(sw - 1, x / factor), x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0;
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4, o = (y * W + x) * 4;
      for (let c = 0; c < 4; c++) {
        const arriba = src[i00 + c]! * (1 - tx) + src[i10 + c]! * tx;
        const abajo = src[i01 + c]! * (1 - tx) + src[i11 + c]! * tx;
        out[o + c] = Math.round(arriba * (1 - ty) + abajo * ty);
      }
    }
  }
  return { ancho: W, alto: H, datos: out };
}

export function codificarPng(img: Bitmap): Uint8Array {
  const p = new PNG({ width: img.ancho, height: img.alto });
  p.data = Buffer.from(img.datos.buffer, img.datos.byteOffset, img.datos.length);
  const b = PNG.sync.write(p);
  return new Uint8Array(b.buffer, b.byteOffset, b.length);
}

/** Amplía una imagen y la devuelve como PNG, lista para el OCR. */
export function ampliarImagen(bytes: Uint8Array, extension: string, factor = 3): ImagenAmpliada {
  const grande = ampliar(decodificar(bytes, extension), factor);
  return { bytes: codificarPng(grande), ancho: grande.ancho, alto: grande.alto, factor };
}
