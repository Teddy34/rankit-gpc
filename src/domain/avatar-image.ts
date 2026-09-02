export type AvatarImageFormat = "png" | "jpeg" | "gif";

export const MAX_AVATAR_IMAGE_BYTES = 2 * 1024 * 1024;

const contentTypes: Record<AvatarImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
};

export function avatarImageContentType(format: AvatarImageFormat): string {
  return contentTypes[format];
}

/** Sniffs the real format from file bytes, never trusting a declared MIME type or filename extension. */
export function detectImageFormat(bytes: Uint8Array): AvatarImageFormat | null {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (bytes.length >= 6) {
    const header = String.fromCharCode(...bytes.slice(0, 6));
    if (header === "GIF87a" || header === "GIF89a") return "gif";
  }
  return null;
}
