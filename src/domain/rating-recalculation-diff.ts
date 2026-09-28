export type StoredGameDelta = { id: number; playerOneDelta: number; playerTwoDelta: number };
export type StoredRating = { id: number; currentRating: number };

/**
 * A full replay recomputes every game's delta on every recalculation, but only the games from the
 * changed point in the timeline onward actually come out different. Comparing against what's
 * already stored lets the caller skip writing back rows whose delta didn't change.
 */
export function gamesToUpdate(stored: readonly StoredGameDelta[], replayed: readonly StoredGameDelta[]): StoredGameDelta[] {
  const storedById = new Map(stored.map((game) => [game.id, game]));
  return replayed.filter((game) => {
    const previous = storedById.get(game.id);
    return !previous || previous.playerOneDelta !== game.playerOneDelta || previous.playerTwoDelta !== game.playerTwoDelta;
  });
}

/** Same idea as {@link gamesToUpdate}, for the ratings a replay produces per player. */
export function ratingsToUpdate(stored: readonly StoredRating[], replayed: ReadonlyMap<number, number>): StoredRating[] {
  const storedById = new Map(stored.map((player) => [player.id, player.currentRating]));
  const updates: StoredRating[] = [];
  for (const [id, currentRating] of replayed) {
    if (storedById.get(id) !== currentRating) updates.push({ id, currentRating });
  }
  return updates;
}
