"use client";

import { useState } from "react";

type IconPlayer = { avatar: string; avatarImageUrl: string | null };

export function PlayerIcon({ player, className }: { player: IconPlayer; className?: string }) {
  // Tracks which URL failed rather than a plain boolean, so a later prop change (a fresh
  // upload replacing a broken one) isn't masked by a stale failure from the previous URL.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (player.avatarImageUrl && player.avatarImageUrl !== failedUrl) {
    return <img className={className} src={player.avatarImageUrl} alt="" onError={() => setFailedUrl(player.avatarImageUrl)} />;
  }
  return <span className={className} aria-hidden="true">{player.avatar}</span>;
}
