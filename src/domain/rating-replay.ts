import { calculateRatingChange, type GameScore } from "./elo";

export type ReplayPlayer = { id: number; initialRating: number };

export type ReplayGame = {
  id: number;
  playerOneId: number;
  playerTwoId: number;
  result: "player_one" | "player_two" | "draw";
  playedOn: string;
  playerOneName: string;
  sequence: number;
};

export type ReplayReset = {
  id: number;
  userId: number;
  rating: number;
  effectiveOn: string;
  sequence: number;
};

export type ReplayedGame = ReplayGame & { playerOneDelta: number; playerTwoDelta: number };
export type ReplayedReset = ReplayReset & { previousRating: number };

export type ReplayEvent =
  | { kind: "game"; date: string; sequence: number; game: ReplayedGame }
  | { kind: "reset"; date: string; sequence: number; reset: ReplayedReset };

function scoreFor(result: ReplayGame["result"]): GameScore {
  if (result === "player_one") return 1;
  if (result === "player_two") return 0;
  return 0.5;
}

/**
 * Replays games and rating resets in chronological order to derive every player's current rating.
 *
 * A game's delta is always computed from the ratings in effect at that point in the timeline, so
 * inserting or editing a past game still recalculates everything after it, as before. A reset event
 * is different: it sets its player's rating directly, without going through the Elo formula. That
 * means a reset never needs to be "solved for" to hit a target value, and — because it only ever
 * touches its own player's slot in the ratings map — it never rewrites the deltas of games that
 * happened before it, and never affects any other player except through games *they* play against
 * this player *after* the reset.
 */
export function replayRatings(players: ReplayPlayer[], games: ReplayGame[], resets: ReplayReset[] = []) {
  const ratings = new Map(players.map((player) => [player.id, player.initialRating]));

  const events: (
    | { kind: "game"; date: string; sequence: number; game: ReplayGame }
    | { kind: "reset"; date: string; sequence: number; reset: ReplayReset }
  )[] = [
    ...games.map((game) => ({ kind: "game" as const, date: game.playedOn, sequence: game.sequence, game })),
    ...resets.map((reset) => ({ kind: "reset" as const, date: reset.effectiveOn, sequence: reset.sequence, reset })),
  ];

  events.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    (a.kind === "game" && b.kind === "game"
      ? a.game.playerOneName.localeCompare(b.game.playerOneName, "en", { sensitivity: "base" })
      : 0) ||
    a.sequence - b.sequence,
  );

  const replayedGames: ReplayedGame[] = [];
  const replayedResets: ReplayedReset[] = [];
  const timeline: ReplayEvent[] = [];

  for (const event of events) {
    if (event.kind === "game") {
      const { game } = event;
      const playerOneRating = ratings.get(game.playerOneId);
      const playerTwoRating = ratings.get(game.playerTwoId);
      if (playerOneRating === undefined || playerTwoRating === undefined) throw new Error("Game references an unknown player");
      const change = calculateRatingChange(playerOneRating, playerTwoRating, scoreFor(game.result));
      ratings.set(game.playerOneId, change.playerOneRating);
      ratings.set(game.playerTwoId, change.playerTwoRating);
      const replayed = { ...game, playerOneDelta: change.playerOneDelta, playerTwoDelta: change.playerTwoDelta };
      replayedGames.push(replayed);
      timeline.push({ kind: "game", date: event.date, sequence: event.sequence, game: replayed });
    } else {
      const { reset } = event;
      const previousRating = ratings.get(reset.userId);
      if (previousRating === undefined) throw new Error("Reset references an unknown player");
      ratings.set(reset.userId, reset.rating);
      const replayed = { ...reset, previousRating };
      replayedResets.push(replayed);
      timeline.push({ kind: "reset", date: event.date, sequence: event.sequence, reset: replayed });
    }
  }

  return { ratings, games: replayedGames, resets: replayedResets, timeline };
}
