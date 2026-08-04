#!/bin/bash
# Deploy: build the container from source and start it
set -euo pipefail

VERSION=$(bash scripts/version.sh)
echo "Building and starting container (version: ${VERSION})..."
VERSION="$VERSION" docker compose up -d --build
