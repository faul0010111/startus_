.PHONY: help install up down migrate seed dev test e2e simulate lint build clean

help: ## Show the available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install workspace dependencies
	pnpm install

up: ## Start Kafka, Postgres, Redis, Prometheus, Grafana and the OTel collector
	pnpm infra:up

down: ## Stop the local infrastructure and drop its volumes
	pnpm infra:down

migrate: ## Apply database migrations
	pnpm db:migrate

seed: ## Load the deterministic demo dataset
	pnpm --filter @stratus/api seed

dev: ## Run every service and the console in watch mode
	pnpm dev

simulate: ## Replay the deployment-incident scenario against the running stack
	pnpm simulate -- --scenario deployment-incident

test: ## Run the unit test suite
	pnpm test

e2e: ## Run the Playwright console tests
	pnpm test:e2e

lint: ## Lint and typecheck
	pnpm lint && pnpm typecheck

build: ## Build every package and app
	pnpm build

clean: ## Remove build output
	rm -rf **/dist **/.next **/*.tsbuildinfo
