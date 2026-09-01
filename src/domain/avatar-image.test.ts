import { describe, expect, it } from "vitest";
import { avatarImageContentType, detectImageFormat, MAX_AVATAR_IMAGE_BYTES } from "./avatar-image";

function bytesOf(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function asciiBytes(text: string): Uint8Array {
  return new Uint8Array([...text].map((char) => char.charCodeAt(0)));
}

describe("detectImageFormat", () => {
  it("recognizes a PNG signature", () => {
    expect(detectImageFormat(bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("png");
  });

  it("recognizes a JPEG signature", () => {
    expect(detectImageFormat(bytesOf(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("jpeg");
  });

  it.each(["GIF87a", "GIF89a"])("recognizes a %s signature", (header) => {
    expect(detectImageFormat(asciiBytes(`${header}extra`))).toBe("gif");
  });

  it("rejects a signature that is merely close, such as a truncated PNG header", () => {
    expect(detectImageFormat(bytesOf(0x89, 0x50, 0x4e, 0x47))).toBeNull();
  });

  it("rejects plain text or unrelated bytes", () => {
    expect(detectImageFormat(asciiBytes("<html><body>not an image</body></html>"))).toBeNull();
  });

  it("rejects an empty buffer", () => {
    expect(detectImageFormat(new Uint8Array())).toBeNull();
  });
});

describe("avatarImageContentType", () => {
  it("maps each format to its MIME type", () => {
    expect(avatarImageContentType("png")).toBe("image/png");
    expect(avatarImageContentType("jpeg")).toBe("image/jpeg");
    expect(avatarImageContentType("gif")).toBe("image/gif");
  });
});

describe("MAX_AVATAR_IMAGE_BYTES", () => {
  it("is 2MB", () => {
    expect(MAX_AVATAR_IMAGE_BYTES).toBe(2 * 1024 * 1024);
  });
});
