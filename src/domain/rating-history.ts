import { replayRatings, type ReplayGame } from "./rating-replay";

export type RatingHistoryPlayer = {
  id: number;
  displayName: string;
  avatar: string;
  retired: boolean;
  points: RatingHistoryPoint[];
};

export type RatingHistoryPoint = {
  gameIndex: number;
  playedOn: string;
  rating: number;
};

type HistoryPlayer = {
  id: number;
  displayName: string;
  avatar: string;
  initialRating: number;
  retired: boolean;
};

export function buildRatingHistory(players: HistoryPlayer[], games: ReplayGame[]): RatingHistoryPlayer[] {
  const replay = replayRatings(
    players.map(({ id, initialRating }) => ({ id, initialRating })),
    games,
  );
  const ratings = new Map(players.map((player) => [player.id, player.initialRating]));
  const points = new Map(players.map((player) => [player.id, [] as RatingHistoryPoint[]]));

  replay.games.forEach((game, index) => {
    const gameIndex = index + 1;
    for (const [playerId, delta] of [
      [game.playerOneId, game.playerOneDelta],
      [game.playerTwoId, game.playerTwoDelta],
    ] as const) {
      const playerPoints = points.get(playerId);
      const previousRating = ratings.get(playerId);
      if (!playerPoints || previousRating === undefined) throw new Error("Game references an unknown player");
      if (playerPoints.length === 0) {
        playerPoints.push({ gameIndex: Math.max(0, gameIndex - 1), playedOn: game.playedOn, rating: previousRating });
      }
      const rating = previousRating + delta;
      ratings.set(playerId, rating);
      playerPoints.push({ gameIndex, playedOn: game.playedOn, rating });
    }
  });

  return players.map((player) => ({
    id: player.id,
    displayName: player.displayName,
    avatar: player.avatar,
    retired: player.retired,
    points: points.get(player.id) ?? [],
  }));
}
