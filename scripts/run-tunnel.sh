#!/bin/bash
# run-tunnel.sh — Cloudflare Quick Tunnel 래퍼 + 자동 Vercel env 교체
#
# LaunchAgent(com.cobling.canton-hub-tunnel)가 이 스크립트를 실행한다.
# 동작:
#   1. cloudflared tunnel --url http://localhost:8000 을 자식 프로세스로 실행
#   2. stdout에서 trycloudflare.com URL 감지
#   3. 이전 실행의 URL(/tmp/canton-hub-tunnel-url.txt)과 비교
#   4. 다르면 scripts/update-vercel-env.sh 호출해서 Vercel 재배포 트리거
#   5. cloudflared가 죽으면 스크립트도 같이 종료 (LaunchAgent KeepAlive가 재시작)
#
# Quick Tunnel은 매 실행마다 랜덤 URL을 받으므로 재시작 시에만 변경이 발생한다.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CLOUDFLARED="/opt/homebrew/opt/cloudflared/bin/cloudflared"
TUNNEL_LOG="/tmp/canton-hub-tunnel.log"
URL_STATE_FILE="/tmp/canton-hub-tunnel-url.txt"
WRAPPER_LOG="/tmp/canton-hub-tunnel-wrapper.log"
BACKEND_URL="http://localhost:8000"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$WRAPPER_LOG"
}

log "=== run-tunnel.sh START (pid $$) ==="

# 1) 이전 cloudflared 로그 회전
if [[ -f "$TUNNEL_LOG" ]]; then
  mv "$TUNNEL_LOG" "$TUNNEL_LOG.prev" 2>/dev/null || true
fi

# 2) cloudflared 실행 (stdout + stderr을 파일로)
"$CLOUDFLARED" tunnel --url "$BACKEND_URL" > "$TUNNEL_LOG" 2>&1 &
CF_PID=$!
log "cloudflared started with pid=$CF_PID"

# 3) cloudflared가 죽으면 래퍼도 같이 종료되게 trap
cleanup() {
  log "cleanup: killing cloudflared (pid=$CF_PID)"
  kill "$CF_PID" 2>/dev/null || true
  wait "$CF_PID" 2>/dev/null || true
  log "=== run-tunnel.sh EXIT ==="
}
trap cleanup EXIT INT TERM

# 4) URL이 로그에 나타날 때까지 대기 (최대 60초)
NEW_URL=""
for i in $(seq 1 60); do
  if ! kill -0 "$CF_PID" 2>/dev/null; then
    log "cloudflared died before URL appeared — will exit so LaunchAgent can restart"
    exit 1
  fi
  URL=$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)
  if [[ -n "$URL" ]]; then
    NEW_URL="$URL"
    break
  fi
  sleep 1
done

if [[ -z "$NEW_URL" ]]; then
  log "ERROR: URL not found in cloudflared output after 60s"
  exit 1
fi
log "tunnel URL: $NEW_URL"

# 5) 이전 URL과 비교
PREV_URL=""
if [[ -f "$URL_STATE_FILE" ]]; then
  PREV_URL=$(cat "$URL_STATE_FILE" 2>/dev/null || true)
fi

if [[ "$NEW_URL" != "$PREV_URL" ]]; then
  log "URL changed: '$PREV_URL' → '$NEW_URL' — triggering Vercel redeploy"
  echo "$NEW_URL" > "$URL_STATE_FILE"
  # 백그라운드에서 Vercel 업데이트 (3~5분 걸릴 수 있음)
  nohup "$SCRIPT_DIR/update-vercel-env.sh" "$NEW_URL" >/dev/null 2>&1 &
  log "update-vercel-env.sh dispatched in background"
else
  log "URL unchanged — Vercel update skipped"
fi

# 6) cloudflared 프로세스를 forreground로 대기 (죽을 때까지)
log "waiting for cloudflared to exit..."
wait "$CF_PID"
CF_EXIT=$?
log "cloudflared exited with code $CF_EXIT"
exit "$CF_EXIT"
