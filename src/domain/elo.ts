export const ELO_K_FACTOR = 36;

export type GameScore = 0 | 0.5 | 1;

export interface RatingChange {
  playerOneDelta: number;
  playerTwoDelta: number;
  playerOneRating: number;
  playerTwoRating: number;
}

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function calculateRatingChange(
  playerOneRating: number,
  playerTwoRating: number,
  playerOneScore: GameScore,
): RatingChange {
  const playerOneDelta = Math.round(
    ELO_K_FACTOR * (playerOneScore - expectedScore(playerOneRating, playerTwoRating)),
  );

  return {
    playerOneDelta,
    playerTwoDelta: -playerOneDelta,
    playerOneRating: playerOneRating + playerOneDelta,
    playerTwoRating: playerTwoRating - playerOneDelta,
  };
}
