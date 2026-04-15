#!/bin/bash
# update-vercel-env.sh — Vercel의 NEXT_PUBLIC_API_URL을 새 tunnel URL로 교체 후 prod 재배포
#
# 호출 형식: update-vercel-env.sh <new_tunnel_url>
# 예: update-vercel-env.sh https://walt-actual-releases-slip.trycloudflare.com
#
# 이 스크립트는 run-tunnel.sh가 새 tunnel URL을 감지했을 때 호출한다.
# LaunchAgent 환경에서 실행되므로 PATH를 가정할 수 없어 모든 CLI는 절대경로로 부른다.

set -eu

URL="${1:-}"
if [[ -z "$URL" ]]; then
  echo "[update-vercel-env] ERROR: URL 인자가 없음" >&2
  exit 1
fi

if [[ ! "$URL" =~ ^https://[a-z0-9-]+\.trycloudflare\.com$ ]]; then
  echo "[update-vercel-env] ERROR: 올바른 trycloudflare URL 형식이 아님: $URL" >&2
  exit 1
fi

WEB_DIR="/Users/choejaewon/project/Ozzycanton/canton-hub/web"
VERCEL="/opt/homebrew/bin/vercel"
LOG="/tmp/canton-hub-vercel-redeploy.log"

cd "$WEB_DIR"

{
  echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Vercel env update triggered ==="
  echo "New URL: $URL"

  # 1) Remove old NEXT_PUBLIC_API_URL (idempotent — 없으면 에러 무시)
  "$VERCEL" env rm NEXT_PUBLIC_API_URL production --yes 2>&1 || true

  # 2) Add new value
  echo "$URL" | "$VERCEL" env add NEXT_PUBLIC_API_URL production 2>&1

  # 3) Trigger production redeploy (baked-in NEXT_PUBLIC_* so rebuild is required)
  "$VERCEL" --prod --yes 2>&1

  echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Done ==="
} >> "$LOG" 2>&1
