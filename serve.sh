#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")"
exec "${PYTHON:-python3}" -B -m uvicorn backend.api:app \
    --host 127.0.0.1 --port "${PORT:-8765}" --no-proxy-headers --no-access-log
