# GeoPostcodes Ranking

Internal pool Elo ladder built with Next.js and SQLite.

See [Implementation status](docs/implementation-status.md) for completed features, remaining work, and deliberate exclusions.

## Local setup

```sh
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. In the default development configuration, sign-in emails are not sent externally: the magic-link URL is printed in the terminal running Next.js.

## Real email with Resend

Create a Resend API key, verify the sending domain, and configure:

```dotenv
RESEND_API_KEY=re_...
EMAIL_FROM=GeoPostcodes Ranking <ranking@your-domain.example>
```

When `RESEND_API_KEY` is absent, the application always uses the development console mailer. `INITIAL_ALLOWED_DOMAINS` is a comma-separated bootstrap list; after the first account is created, new registrations must use a listed or administrator-managed domain.

Magic links remain usable for 24 hours. Successful authentication creates a revocable, HTTP-only session lasting 30 days.

## Monthly awards

The monthly leader earns a persistent bronze, silver, or gold award based on consecutive months at number one. Awards currently use idempotent, Ranking-page-triggered processing rather than an external scheduler. See [Monthly ranking awards](docs/monthly-awards.md) for the complete rules and orchestration behavior.

## Administrator CLI

Grant or revoke administrator rights by player email:

```sh
make admin EMAIL="jordi@geopostcodes.com"
make unadmin EMAIL="jordi@geopostcodes.com"
```

The command uses `DATABASE_URL` from the environment or `.env.local`, performs a case-insensitive email lookup, and refuses to revoke the final administrator.

## Database backups

Create, verify, and list consistent SQLite backups:

```sh
make backup
make backups
```

Backups are written to `BACKUP_DIR` (default: `./backups`), which must be outside the live database directory. Managed backups older than `BACKUP_RETENTION_DAYS` (default: seven days) are removed after a successful backup. In production, mount `BACKUP_DIR` on storage with an independent lifecycle from the live database volume.

To restore, first stop the application so no process has the SQLite database open. Then choose a filename shown by `make backups` and provide the explicit confirmation:

```sh
make restore BACKUP="rankit-2026-07-27T10-00-00Z.sqlite" CONFIRM=restore
```

Restore validates the selected backup, restricts selection to managed files inside `BACKUP_DIR`, creates a pre-restore safety backup, verifies the replacement database, and then replaces the live database. Restart the application after it completes.

## Docker Compose deployment

Copy `.env.example` to `.env`, configure the public `APP_URL`, email credentials, and other secrets, then start the single application instance:

```sh
make up
make logs
```

Compose builds the standalone Next.js image, runs database migrations when the container starts, exposes the app on `APP_PORT` (default `3000`), and checks `/api/health`. The live SQLite database and backups use separate named volumes. Stop the service with `make down`; this preserves both volumes.
