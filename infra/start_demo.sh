#!/usr/bin/env bash
# Lance le backend + frontend (machine dev)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo "[1/1] Démarrage backend + frontend..."
docker-compose -f docker-compose.yml up -d
echo ""
echo "✓ Backend  : http://localhost:4000"
echo "✓ Frontend : http://localhost:3000"
