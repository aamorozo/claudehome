#!/usr/bin/env bash
# Run once after `wrangler login` to push all secrets to the worker.
# Usage: bash scripts/set-secrets.sh

set -euo pipefail

secrets=(
  FUB_API_KEY
  SLACK_WEBHOOK_URL
  ARRAN_USER_ID
  KERI_USER_ID
)

for secret in "${secrets[@]}"; do
  echo -n "Enter value for $secret: "
  read -rs value
  echo
  echo "$value" | wrangler secret put "$secret" --env production
  echo "  ✓ $secret set"
done

echo ""
echo "All secrets set. Deploy with: npm run deploy"
