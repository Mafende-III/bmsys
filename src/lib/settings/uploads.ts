import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Resolves the absolute path of the uploads directory.
 * Override with UPLOADS_DIR env var; in production this should point
 * to a mounted Docker volume so files survive container rebuilds.
 */
export function getUploadsDir(): string {
  const fromEnv = process.env.UPLOADS_DIR;
  if (fromEnv && fromEnv.length > 0) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "uploads");
}

/**
 * Ensures the uploads directory exists. Safe to call on every write.
 */
export async function ensureUploadsDir(): Promise<string> {
  const dir = getUploadsDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

const LOGO_BASENAME = "logo";

const ALLOWED_LOGO_MIME = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export type LogoSaveResult =
  | { ok: true; relativePath: string }
  | { ok: false; error: string };

/**
 * Persists a logo image to disk. Returns the relative filename to
 * store in Settings.logoPath (e.g. "logo.png"). Old logo files of
 * other extensions are not deleted on disk — they're orphaned and
 * harmless. We always overwrite the same basename for the chosen
 * extension so cache-busting comes from the updatedAt query string.
 */
export async function saveLogoFile(file: File): Promise<LogoSaveResult> {
  if (file.size === 0) {
    return { ok: false, error: "Pick a file to upload" };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: "Logo must be 2 MB or smaller" };
  }
  const ext = ALLOWED_LOGO_MIME.get(file.type);
  if (!ext) {
    return {
      ok: false,
      error: "Logo must be PNG, JPG, WebP, or SVG",
    };
  }

  const dir = await ensureUploadsDir();
  const fileName = `${LOGO_BASENAME}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), bytes);
  return { ok: true, relativePath: fileName };
}

/**
 * Reads a single uploads file by relative name. Refuses anything
 * containing path traversal so a route handler can rely on this for
 * safe public access.
 */
export async function readUpload(relative: string): Promise<Buffer | null> {
  if (!relative || relative.includes("..") || relative.startsWith("/")) {
    return null;
  }
  const dir = getUploadsDir();
  const fullPath = path.join(dir, relative);
  if (!fullPath.startsWith(dir)) return null;
  try {
    return await readFile(fullPath);
  } catch {
    return null;
  }
}

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export function mimeForExt(ext: string): string {
  return EXT_MIME[ext.toLowerCase()] ?? "application/octet-stream";
}
