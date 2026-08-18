# Pool ranking application — product specification

Status: Draft

This document captures product requirements and decisions. Architecture and implementation choices are intentionally out of scope.

## Purpose and scope

The application is an internal, English-language Elo ladder for company pool games. It is expected to serve roughly 30 people, with an upper bound of approximately 50.

All games belong to a single ranking. Games are always one player against one player and may result in a win, loss, or draw. There are no pool categories, teams, seasons, or placement rules in the initial version.

Only authenticated users may access the application, including rankings and historical results. Mobile usability is desirable. There are no special accessibility or privacy-compliance requirements beyond reasonable application quality.

## Accounts and authentication

- Users register and sign in through email magic links.
- Registration is restricted to email domains on an administrator-managed whitelist.
- A magic link expires 24 hours after it is issued and may be used more than once during that period.
- The first successfully registered user becomes an administrator.
- Users may change their email address.
- Retired players retain access to their accounts.
- The application is English-only.

## Player profiles

- Each player has a unique display name.
- Display names should allow normal names, spaces, punctuation, and international characters. A proposed limit is 2–40 characters after trimming surrounding whitespace.
- Display-name uniqueness should be case-insensitive and ignore surrounding whitespace.
- Players select an avatar from a bundled list of funny avatars. Image uploads and custom avatar URLs are not supported.
- A player may be active or retired.
- Retired players are excluded from the current ranking and from player choices when registering a game.
- Retired players remain visible in historical game results and may still sign in.

## Games

Each game records:

- the two distinct players;
- the result: player one wins, player two wins, or draw;
- the game date, interpreted in `Europe/Brussels`;
- who registered it and when it was registered.

Only the game date is displayed; the time of day is never displayed.

Any authenticated user may register a game between any two active players. Participants do not need to confirm the result. Future game dates are rejected, while historical games may be entered without an age limit.

Only administrators may edit or delete games. Editing a historical game or deleting one causes all affected later ratings to be recomputed.

When games have the same effective timestamp, they are ordered by the first player's display name alphabetically. A stable secondary tie-breaker is still required if those values are equal.

## Elo ranking

- During registration, a new player enters their exact current Elo rating from the previous system. The field accepts whole numbers from 1000 through 2000 inclusive, defaults to 1500, and is presented as: **“What is your current ELO on rankit.io?”** Supporting text explains that 1500 should be used when the player does not know their rating. This is a one-time starting value, not a placement system.
- One standard Elo ranking covers all games.
- The Elo K-factor is 36.
- Each player's calculated rating change is rounded to the nearest integer after every game.
- A win has a score of 1, a draw 0.5, and a loss 0.
- Rating changes are zero-sum between the two players.
- Importing existing ratings from the previous system is deliberately out of scope for version 1.0.0.
- The ranking is derived reproducibly from its imported baseline and ordered game history.

The provided compatibility example is:

- Before the game: Jordi 1646, Rav 1661.
- Jordi wins and gains 16; Rav loses 16.
- After the game: Jordi 1662, Rav 1645.

With the chosen K-factor of 36, this example calculates to approximately 18.77 points and therefore rounds to 19, rather than 16. The imported rating snapshot is treated as a baseline from the previous system, not as a compatibility test for the new rating calculation.

## Ranking and results views

The current ranking shows active players and at least:

- rank;
- avatar and display name;
- current Elo rating;
- weekly Elo trend, expressed as points gained or lost since Monday at 00:00 in `Europe/Brussels`;

Additional statistics may be introduced later. Historical game results show the date, both players, result, and rating changes. Historical results continue to include retired players.

## Administration

Administrators may:

- retire and unretire players;
- edit and delete games;
- grant or revoke administrator rights;
- manage the whitelist of permitted email domains;
- view recorded administrative actions.

Administrative actions are written to an audit log with the acting administrator, action, affected entity, and timestamp.
The audit log is visible only to administrators.

## Operational expectations

- Email delivery may use a conventional transactional-email service; no advanced delivery requirements are currently specified.
- The deployment environment has not yet been chosen.
- The application should be responsive and convenient on mobile devices.

## Open product decisions

1. Decide whether an administrator may correct a player's initial Elo before the player has games.
2. Decide whether changing an email address requires verification through the new address and whether its domain must still be whitelisted. Implemented decision: yes to both.
3. Define which game fields an administrator may edit. Proposed: date, players, and result, with every change audited.
4. Choose deletion semantics. Implemented decision: soft-delete games so the audit history and the possibility of recovery are preserved.
5. Prevent removal of the final administrator and define deterministic handling if two people attempt first registration simultaneously.
6. Define the stable secondary ordering for games on the same date. Implemented decision: permanent creation sequence after alphabetical ordering.
