# Monthly ranking awards

## Award rules

At the beginning of each calendar month in `Europe/Brussels`, the player at the top of the eligible ranking receives one permanent award for the new month:

- first consecutive month at number one: bronze (`🥉`);
- second consecutive month: silver (`🥈`);
- third and every later consecutive month: gold (`🥇`).

Each award is displayed separately. A player who earns the same award level several times therefore sees several copies of that medal.

The winner is calculated from games played before the first day of the award month. Players must have registered before that month began and must not have been retired at the month boundary. Rating ties are resolved by display name using the same deterministic alphabetical ordering as the ranking.

Awards are snapshots. Once an award has been stored, subsequently registering, editing, or deleting a historical game does not change that award.

### Award month vs. displayed month

Internally, an award is keyed by `award_month`: the calendar month at whose start it was detected (e.g. `2026-09`), computed from games played *before* that month began. That key is what admin commands (`award set`/`award remove`) and streak continuity use.

To a player, though, the award is for the month those games were played in — the month that had just *finished*, not the one that had just started. So the displayed label (badge tooltip) always names `award_month` minus one month: an `award_month` of `2026-09` is shown to players as "August 2026", never "September 2026".

## Current orchestration

Award processing is currently lazy and idempotent; there is no cron job or external scheduler.

Whenever an authenticated user opens the Ranking page, the application:

1. determines the current month in `Europe/Brussels`;
2. checks the latest stored award month;
3. processes any missing months in chronological order;
4. reconstructs the ranking at each month boundary;
5. determines the winner and their consecutive-month streak;
6. inserts the award if it does not already exist.

The `monthly_awards.award_month` database column has a unique index, so concurrent page requests cannot create duplicate awards for one month.

If nobody opens the application on the first day of a month, the award is created on the next Ranking-page visit. The result is still based on the ranking at the month boundary, not on the ranking at the time of that visit.

An admin can remove an award (`award remove <player> <yyyy-mm>` in the admin console). Removal is a soft delete (`deleted_at`/`deleted_by`), not a row delete: the `award_month` stays occupied, so the lazy processing above still sees that month as handled and will not recompute and reinsert it on the next page visit. Re-running `award set` for that same month revives the row.

## Future scheduled execution

Production may later invoke the same idempotent processing from a monthly cron job or scheduled container task shortly after Brussels midnight. The Ranking-page check should remain as a fallback so a missed scheduled run can recover automatically.
