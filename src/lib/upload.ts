import multer from "multer";
import { HttpError } from "../utils/http-error.js";

// ---------------------------------------------------------------------------
// Subida de archivos (multipart/form-data) en memoria.
// El tipo se valida por los primeros bytes del archivo ("magic numbers"),
// no por la extensión ni por el Content-Type que manda el cliente.
// ---------------------------------------------------------------------------

export const MB = 1024 * 1024;

export type AllowedMime = "image/jpeg" | "image/png" | "application/pdf";

const FIRMAS: { mime: AllowedMime; bytes: number[] }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
];

/** Devuelve el tipo real del archivo según su contenido, o null si no es uno conocido */
export function detectMime(buffer: Buffer): AllowedMime | null {
  return FIRMAS.find((f) => f.bytes.every((b, i) => buffer[i] === b))?.mime ?? null;
}

/** Middleware multer para un solo archivo en `field`, con límite de tamaño */
export function singleFile(field: string, maxBytes: number) {
  return multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 } }).single(field);
}

/** Valida que venga el archivo y que su contenido sea de un tipo permitido */
export function requireFile(file: Express.Multer.File | undefined, allowed: AllowedMime[], msg: string) {
  if (!file) throw HttpError.badRequest("Envía el archivo en el campo 'file' (multipart/form-data)", "INVALID_FILE");
  const mime = detectMime(file.buffer);
  if (!mime || !allowed.includes(mime)) throw HttpError.badRequest(msg, "INVALID_FILE");
  return { buffer: file.buffer, mime, size: file.size };
}
