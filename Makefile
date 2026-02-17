# Spotary - Project Management Makefile

.PHONY: setup run build test lint backup restore migrate reindex release help

# --- Defaults ---
VERSION ?= $(shell grep '"version"' apps/api/package.json 2>/dev/null | cut -d'"' -f4 || echo "latest")
TARGET ?= all

# --- Development ---

help:
	@echo "🌟 Spotary Project Management"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  setup       Install all dependencies (NX, Python, Node)"
	@echo "  run         Run all services locally using NX"
	@echo "  build       Build all applications"
	@echo "  test        Run backend tests"
	@echo "  lint        Run linting for all apps"
	@echo ""
	@echo "Operations:"
	@echo "  backup      Backup PostgreSQL and data directories"
	@echo "  restore     Restore PostgreSQL from a backup file (FILE=path/to/file)"
	@echo "  migrate     Run database migrations"
	@echo "  reindex     Re-index vector database"
	@echo ""
	@echo "Release:"
	@echo "  release     Prepare a new release (TARGET=api|dashboard|admin VERSION=vX.Y.Z)"
	@echo ""

setup:
	@echo "📦 Setting up project..."
	npm install
	nx run-many --target=install

run:
	@echo "🚀 Starting all services..."
	nx run-many --target=all --parallel

build:
	@echo "🏗️ Building all services..."
	nx run-many --target=build

test:
	@echo "🧪 Running backend tests..."
	nx run api:test

lint:
	@echo "🧹 Linting..."
	nx run-many --target=lint

# --- Database & Ops ---

backup:
	@echo "💾 Starting backup..."
	./tools/scripts/backup_db.sh

restore:
	@echo "⏪ Restoring from $(FILE)..."
	@if [ -z "$(FILE)" ]; then echo "Error: FILE argument is required (e.g. make restore FILE=backups/postgres_xxx.sql.gz)"; exit 1; fi
	./tools/scripts/restore_db.sh $(FILE)

migrate:
	@echo "🔄 Running migrations..."
	nx run api:migrate

reindex:
	@echo "🔎 Re-indexing vectors..."
	./tools/scripts/reindex_db.sh

# --- Release ---

release:
	@echo "🚀 Releasing $(TARGET) $(VERSION)..."
	@if [ -z "$(TARGET)" ] || [ "$(TARGET)" = "all" ]; then \
		./tools/scripts/release.sh api $(VERSION); \
		./tools/scripts/release.sh dashboard $(VERSION); \
		./tools/scripts/release.sh admin $(VERSION); \
	else \
		./tools/scripts/release.sh $(TARGET) $(VERSION); \
	fi
