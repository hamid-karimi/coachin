# CoachIn — one command per task. Run `make help` for the list.
COMPOSE := docker compose -f compose.yaml -f compose.dev.yaml

.DEFAULT_GOAL := help
.PHONY: help up infra down logs ps migrate migrate-status reset-db seed import-supabase gen e2e test lint

help: ## List the available commands
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  make %-15s %s\n", $$1, $$2}'

.env:
	cp .env.example .env

up: .env ## Start the whole stack with hot reload at http://localhost:8080
	$(COMPOSE) up --build --watch

infra: .env ## Start only Postgres, Garage, and Mailpit (run api/web natively)
	$(COMPOSE) up -d --build postgres garage storage-init mailpit

down: ## Stop the stack (data volumes are kept)
	$(COMPOSE) down

logs: ## Follow the logs of every service
	$(COMPOSE) logs -f

ps: ## Show service status
	$(COMPOSE) ps -a

migrate: .env ## Apply pending database migrations
	$(COMPOSE) run --rm --build migrate migrate up

migrate-status: .env ## Show which migrations are applied
	$(COMPOSE) run --rm --build migrate migrate status

reset-db: .env ## Delete the local database and re-create it from migrations
	$(COMPOSE) rm -sfv postgres
	docker volume rm -f coachin_pgdata
	$(COMPOSE) up -d --wait postgres
	$(COMPOSE) run --rm --build migrate migrate up

seed: .env ## Load demo accounts (trainee@ / coach@coachin.local, password Coachin-demo1)
	$(COMPOSE) run --rm --build migrate seed

import-supabase: .env ## One-time go-live copy of the Supabase project (SUPABASE_* in .env; ARGS=-dry-run rehearses)
	$(COMPOSE) run --rm --build migrate import-supabase $(ARGS)

gen: ## Regenerate sqlc queries, openapi/openapi.json, and the web app's typed API client
	cd apps/api && sqlc generate
	cd apps/api && go run ./cmd/api openapi > ../../openapi/openapi.json
	cd apps/web && pnpm gen:api

e2e: .env ## Run the Playwright QA journeys against the stack with the fake Claude (compose.e2e.yaml)
	docker compose -f compose.yaml -f compose.e2e.yaml up -d --build
	docker compose -f compose.yaml -f compose.e2e.yaml run --rm migrate seed
	cd apps/web && pnpm e2e

test: ## Run Go and web unit/integration tests (Go tests need Docker)
	cd apps/api && go test ./...
	cd apps/web && pnpm test

lint: ## Vet, lint, and typecheck both apps
	cd apps/api && go vet ./... && golangci-lint run
	cd apps/web && pnpm typecheck && pnpm lint
