import { replayRatings, type ReplayGame, type ReplayReset } from "./rating-replay";

export type RatingHistoryPlayer = {
  id: number;
  displayName: string;
  avatar: string;
  retired: boolean;
  points: RatingHistoryPoint[];
};

export type RatingHistoryPoint = {
  eventIndex: number;
  date: string;
  rating: number;
  kind: "baseline" | "game" | "reset";
};

type HistoryPlayer = {
  id: number;
  displayName: string;
  avatar: string;
  initialRating: number;
  retired: boolean;
};

export function buildRatingHistory(players: HistoryPlayer[], games: ReplayGame[], resets: ReplayReset[] = []): RatingHistoryPlayer[] {
  const replay = replayRatings(
    players.map(({ id, initialRating }) => ({ id, initialRating })),
    games,
    resets,
  );
  const ratings = new Map(players.map((player) => [player.id, player.initialRating]));
  const points = new Map(players.map((player) => [player.id, [] as RatingHistoryPoint[]]));

  function ensureBaseline(playerId: number, eventIndex: number, date: string): RatingHistoryPoint[] {
    const playerPoints = points.get(playerId);
    const previousRating = ratings.get(playerId);
    if (!playerPoints || previousRating === undefined) throw new Error("Event references an unknown player");
    if (playerPoints.length === 0) {
      playerPoints.push({ eventIndex: Math.max(0, eventIndex - 1), date, rating: previousRating, kind: "baseline" });
    }
    return playerPoints;
  }

  replay.timeline.forEach((event, index) => {
    const eventIndex = index + 1;
    if (event.kind === "game") {
      const { game } = event;
      for (const [playerId, delta] of [
        [game.playerOneId, game.playerOneDelta],
        [game.playerTwoId, game.playerTwoDelta],
      ] as const) {
        const playerPoints = ensureBaseline(playerId, eventIndex, game.playedOn);
        const rating = (ratings.get(playerId) as number) + delta;
        ratings.set(playerId, rating);
        playerPoints.push({ eventIndex, date: game.playedOn, rating, kind: "game" });
      }
    } else {
      const { reset } = event;
      const playerPoints = ensureBaseline(reset.userId, eventIndex, reset.effectiveOn);
      ratings.set(reset.userId, reset.rating);
      playerPoints.push({ eventIndex, date: reset.effectiveOn, rating: reset.rating, kind: "reset" });
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
