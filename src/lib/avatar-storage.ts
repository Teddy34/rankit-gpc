import "server-only";

import { del, put } from "@vercel/blob";

export async function uploadAvatarImage(userId: number, file: File, contentType: string): Promise<string> {
  const blob = await put(`avatars/${userId}`, file, { access: "public", addRandomSuffix: true, contentType });
  return blob.url;
}

export async function deleteAvatarImage(url: string): Promise<void> {
  await del(url);
}
