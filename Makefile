.PHONY: help install dev build test lint migrate up down logs backup backups restore admin unadmin

help:
	@echo "install  Install dependencies"
	@echo "dev      Start the development server"
	@echo "build    Create the production build"
	@echo "test     Run unit tests"
	@echo "lint     Run static checks"
	@echo "migrate  Apply database migrations"
	@echo "up       Build and start the production Compose service"
	@echo "down     Stop the production Compose service"
	@echo "logs     Follow production Compose logs"
	@echo "backup   Create and verify a consistent SQLite backup"
	@echo "backups  List available SQLite backups"
	@echo 'restore  Restore safely: make restore BACKUP="file.sqlite" CONFIRM=restore'
	@echo 'admin    Grant admin rights: make admin EMAIL="player@example.com"'
	@echo 'unadmin  Revoke admin rights: make unadmin EMAIL="player@example.com"'

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm test

lint:
	npm run lint

migrate:
	npm run db:migrate

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f app

backup:
	npm run db:ops -- backup

backups:
	npm run db:ops -- list

restore: export RESTORE_BACKUP := $(BACKUP)
restore: export CONFIRM_RESTORE := $(CONFIRM)
restore:
	@test -n "$$RESTORE_BACKUP" || (echo 'Usage: make restore BACKUP="file.sqlite" CONFIRM=restore' && exit 2)
	@test "$$CONFIRM_RESTORE" = "restore" || (echo 'Restore refused. Stop the app and add CONFIRM=restore' && exit 2)
	npm run db:ops -- restore

admin: export ADMIN_EMAIL := $(EMAIL)
admin:
	@test -n "$$ADMIN_EMAIL" || (echo 'Usage: make admin EMAIL="player@example.com"' && exit 2)
	npm run admin -- grant

unadmin: export ADMIN_EMAIL := $(EMAIL)
unadmin:
	@test -n "$$ADMIN_EMAIL" || (echo 'Usage: make unadmin EMAIL="player@example.com"' && exit 2)
	npm run admin -- revoke
