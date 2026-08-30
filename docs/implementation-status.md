# Implementation status

Status: Version 1.0.0 development

## Implemented

- Email magic-link authentication with local console delivery and Resend support
- Friendly retryable handling for sign-in and email-change delivery failures
- Domain-restricted registration and administrator-managed whitelist
- Player profile, avatar, email, retirement, and administrator management
- Elo ranking, weekly trends, game registration, history, and administrator deletion
- Live fire badges for players with at least three consecutive wins
- Persistent monthly bronze, silver, and gold leader awards
- Administrator audit-log interface
- libSQL migrations with local SQLite and remote Turso support
- Local SQLite backup/list/restore Make commands with seven-day retention
- Standalone Docker image and Docker Compose deployment
- Automatic container-start database migrations
- Database-aware `/api/health` health check
- Separate Compose volumes for the live database and backups

## Remaining TODOs

1. Test real Resend delivery end-to-end using the production hostname and verified sending domain.
2. Add administrator game editing for date, players, and result, with audit logging and rating replay.
3. Schedule daily `make backup` execution outside the application container.
4. Optionally schedule monthly award processing while retaining Ranking-page catch-up as a fallback.
5. Add browser-level tests for authentication, game mutations, and administrator authorization.
6. Complete production configuration for secrets, TLS proxying, external backup lifecycle, logging, and monitoring.

## Deliberately out of scope

- Importing players, games, or rating snapshots from the previous ranking system.
