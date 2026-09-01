type IconPlayer = { avatar: string; avatarImageUrl: string | null };

export function PlayerIcon({ player, className }: { player: IconPlayer; className?: string }) {
  if (player.avatarImageUrl) return <img className={className} src={player.avatarImageUrl} alt="" />;
  return <span className={className} aria-hidden="true">{player.avatar}</span>;
}
