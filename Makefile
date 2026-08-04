.PHONY: help install dev build preview typecheck lint lint-check prettier test test-run prepare-ffmpeg docker-build docker-up docker-down clean

# Default target
help:
	@echo "Available commands:"
	@echo "  install       - Install dependencies"
	@echo "  dev           - Run Vite dev server (http://localhost:5173)"
	@echo "  build         - Build production bundle (+ PWA service worker)"
	@echo "  preview       - Preview the production build"
	@echo "  typecheck     - Run vue-tsc --noEmit"
	@echo "  lint          - Run ESLint with autofix"
	@echo "  lint-check    - Run ESLint without autofix"
	@echo "  prettier      - Run Prettier formatter"
	@echo "  test          - Run vitest in watch mode"
	@echo "  test-run      - Run vitest once"
	@echo "  prepare-ffmpeg - Copy @ffmpeg/core-st into public/ffmpeg"
	@echo "  docker-build  - Build Docker image"
	@echo "  docker-up     - Start with Docker Compose"
	@echo "  docker-down   - Stop Docker Compose"
	@echo "  clean         - Remove build artifacts"

# Install dependencies
install:
	@echo "Installing dependencies..."
	pnpm install

# Copy ffmpeg core into public/ffmpeg (also runs automatically on dev/build)
prepare-ffmpeg:
	@echo "Copying ffmpeg core into public/ffmpeg..."
	pnpm run prepare:ffmpeg

# Run the development server
dev:
	@echo "Starting development server..."
	@echo "App: http://localhost:5173"
	@echo "Open the Spike tab and run both checks for the capability matrix."
	pnpm dev

# Get version from git tag + commit
VERSION := $(shell ./scripts/version.sh 2>/dev/null || echo "dev-unknown")

# Build the production bundle
build:
	@echo "Building version: $(VERSION)"
	VITE_APP_VERSION=$(VERSION) pnpm build

# Preview the production build
preview:
	@echo "Previewing production build..."
	pnpm preview

# Run type checking
typecheck:
	@echo "Running vue-tsc..."
	pnpm typecheck

# Run the linter (with autofix)
lint:
	@echo "Running eslint (autofix)..."
	pnpm lint

# Run the linter (no autofix)
lint-check:
	@echo "Running eslint (no autofix)..."
	pnpm lint:check

# Format with prettier
prettier:
	@echo "Running prettier..."
	pnpm prettier

# Run unit tests (watch)
test:
	@echo "Running vitest (watch)..."
	pnpm test

# Run unit tests once
test-run:
	@echo "Running vitest once..."
	pnpm test:run

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist
	rm -rf dev-dist
	rm -rf node_modules

# Docker commands
docker-build:
	@echo "Building Docker image with version: $(VERSION)..."
	docker build --build-arg VERSION=$(VERSION) -t orbital-audiospriter -f Dockerfile .

docker-up:
	@echo "Starting with Docker Compose (version: $(VERSION))..."
	VERSION=$(VERSION) docker compose up -d --build

docker-down:
	@echo "Stopping Docker Compose..."
	VERSION=$(VERSION) docker compose down