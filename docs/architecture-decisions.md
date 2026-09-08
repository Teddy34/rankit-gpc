# Architecture decisions

Status: Draft

## Application shape

The application will be a single Next.js application using the App Router and TypeScript.

- Pages are primarily rendered on the server with React Server Components.
- Forms and mutations use Server Actions where appropriate.
- Route Handlers are reserved for endpoints such as magic-link callbacks.
- There is no separate frontend application or general-purpose JSON API.
- Authenticated pages are rendered dynamically; ranking data is not statically cached.
- The application runs in the Node.js runtime, not the Edge runtime.

## Storage

SQLite is the primary database. It is stored on a persistent local volume and accessed only by the single application instance.

- Proposed database location: `/data/rankit.sqlite`.
- SQLite WAL mode is enabled.
- Schema changes use versioned migrations.
- Drizzle is the proposed database toolkit.
- The deployment must not run multiple application replicas against the SQLite file.
- Backups are covered at the application level: an administrator-gated export/restore panel plus
  a bearer-token endpoint an external system can poll for offsite copies. See `src/lib/backup.ts`.

If future hosting requires ephemeral instances, horizontal scaling, or serverless execution, storage will need to move to a network-accessible database such as PostgreSQL.

## Deployment

The application is packaged as a Docker image and deployed through Docker Compose.

The Compose setup will contain one application service and one named volume for persistent data. Email delivery remains an external service.

TLS and hostname routing are provided by an existing reverse proxy and are not part of this Compose project. Magic-link email is delivered through a transactional email provider.

Production deployment must provide:

- a persistent Docker volume;
- application secrets and email credentials through environment variables or deployment secrets;
- a restart policy;
- a health check;
- a single running application replica.

## Operational commands

Make is the task orchestrator for development and operational commands. The repository will provide discoverable targets for common actions rather than requiring operators to remember raw Docker Compose commands.

At minimum, it will provide targets to:

- build and start the application;
- stop the application;
- run database migrations.

Backup and restore are administrator-facing application features rather than Make targets: an
admin-only panel in `/admin` downloads a versioned JSON snapshot and restores from one (with a
pre-restore safety copy and a typed confirmation), and `GET /api/backup` lets an external system
pull the same snapshot on its own schedule using a bearer token, for offsite retention.

## Deliberate exclusions

The initial architecture does not include PostgreSQL, Redis, queues, microservices, a separate API service, client-side state management, or Kubernetes.
