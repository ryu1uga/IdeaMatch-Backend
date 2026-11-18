import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { env } from "../config/env.js";

// ---------------------------------------------------------------------------
// Almacenamiento de archivos (foto de perfil, adjuntos del chat).
//  - Cloudinary si existe CLOUDINARY_URL (producción).
//  - Disco local en UPLOAD_DIR, servido en /uploads (desarrollo).
// Para cambiar de proveedor solo se implementa otra Storage.
// ---------------------------------------------------------------------------

export interface SaveInput {
  buffer: Buffer;
  mime: string;
  /** carpeta lógica, p. ej. "avatars" o "attachments" */
  folder: string;
  /** "image" se puede transformar (p. ej. redimensionar); "raw" se guarda tal cual (PDF) */
  kind: "image" | "raw";
  /** URL base de la API para archivos locales cuando no hay PUBLIC_URL */
  baseUrl?: string;
}

export interface StoredFile {
  url: string;
  /** identificador para borrarlo después */
  key: string;
}

export interface Storage {
  readonly driver: "local" | "cloudinary";
  save(input: SaveInput): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

export const LOCAL_UPLOAD_DIR = path.resolve(env.UPLOAD_DIR);

const localStorage: Storage = {
  driver: "local",
  async save({ buffer, mime, folder, baseUrl }) {
    const name = `${randomUUID()}.${EXT[mime] ?? "bin"}`;
    const dir = path.join(LOCAL_UPLOAD_DIR, folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buffer);
    const key = `${folder}/${name}`;
    const origin = (env.PUBLIC_URL ?? baseUrl ?? "").replace(/\/$/, "");
    return { url: `${origin}/uploads/${key}`, key };
  },
  async remove(key) {
    const file = path.resolve(LOCAL_UPLOAD_DIR, key);
    if (!file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) return; // nunca fuera de la carpeta
    await unlink(file).catch(() => undefined);
  },
};

const cloudinaryStorage: Storage = {
  driver: "cloudinary",
  save({ buffer, folder, kind }) {
    // El SDK lee CLOUDINARY_URL del entorno (cloudinary://API_KEY:API_SECRET@CLOUD_NAME)
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `ideamatch/${folder}`,
          // "raw" evita la restricción de Cloudinary para entregar PDF como imagen
          resource_type: kind,
          ...(kind === "image" && { transformation: [{ width: 512, height: 512, crop: "limit" }] }),
        },
        (err, res?: UploadApiResponse) => {
          if (err || !res) return reject(err ?? new Error("Cloudinary no devolvió respuesta"));
          resolve({ url: res.secure_url, key: `${kind}:${res.public_id}` });
        },
      );
      stream.end(buffer);
    });
  },
  async remove(key) {
    const [kind, ...rest] = key.split(":");
    await cloudinary.uploader.destroy(rest.join(":"), { resource_type: kind }).catch(() => undefined);
  },
};

export const storage: Storage = env.CLOUDINARY_URL ? cloudinaryStorage : localStorage;

if (storage.driver === "local" && env.NODE_ENV === "production") {
  console.warn(
    "[storage] Sin CLOUDINARY_URL: los archivos se guardan en disco local y se pierden al reiniciar en Render.",
  );
}
