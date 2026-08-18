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

export type ReplayedGame = ReplayGame & { playerOneDelta: number; playerTwoDelta: number };

function scoreFor(result: ReplayGame["result"]): GameScore {
  if (result === "player_one") return 1;
  if (result === "player_two") return 0;
  return 0.5;
}

export function replayRatings(players: ReplayPlayer[], games: ReplayGame[]) {
  const ratings = new Map(players.map((player) => [player.id, player.initialRating]));
  const orderedGames = [...games].sort((a, b) =>
    a.playedOn.localeCompare(b.playedOn) ||
    a.playerOneName.localeCompare(b.playerOneName, "en", { sensitivity: "base" }) ||
    a.sequence - b.sequence,
  );

  const replayedGames: ReplayedGame[] = orderedGames.map((game) => {
    const playerOneRating = ratings.get(game.playerOneId);
    const playerTwoRating = ratings.get(game.playerTwoId);
    if (playerOneRating === undefined || playerTwoRating === undefined) throw new Error("Game references an unknown player");
    const change = calculateRatingChange(playerOneRating, playerTwoRating, scoreFor(game.result));
    ratings.set(game.playerOneId, change.playerOneRating);
    ratings.set(game.playerTwoId, change.playerTwoRating);
    return { ...game, playerOneDelta: change.playerOneDelta, playerTwoDelta: change.playerTwoDelta };
  });

  return { ratings, games: replayedGames };
}
