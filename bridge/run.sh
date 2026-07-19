#!/bin/bash
# Start the coach bridge with the right PATH (so `claude` is found).
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
exec node server.js
