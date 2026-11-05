#!/usr/bin/env bash
#
# QA suite: runs every test in tests/qa against a production build that is
# pointed at a SCRATCH copy of the local database - the real database is only
# read (pg_dump), never written.
#
#   pnpm qa                    # build, test, clean up
#   QA_SKIP_BUILD=1 pnpm qa    # reuse the existing .next build
#   QA_ADMIN_PASSWORD=... pnpm qa   # if the local admin password is not admin123
#
# Steps: copy DB -> apply current schema to the copy -> build -> start the
# build on :3001 against the copy -> run tests -> stop server, drop the copy.
# Cleanup runs even if a test fails or the script is interrupted.

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

PORT="${QA_PORT:-3001}"
QA_DB="bef_foundry_test"
DATABASE_URL="${DATABASE_URL:-$(grep -E '^DATABASE_URL=' .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")}"
TEST_URL="${DATABASE_URL%/*}/$QA_DB"
DUMP="$(mktemp -d)/qa-source.dump"
SERVER_STARTED=""

port_pids() {
  if command -v netstat >/dev/null && [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]]; then
    netstat -ano | grep -E ":$PORT .*LISTEN" | awk '{print $NF}' | sort -u
  else
    (lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  fi
}

cleanup() {
  if [[ -n "$SERVER_STARTED" ]]; then
    for pid in $(port_pids); do
      if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]]; then taskkill //F //PID "$pid" >/dev/null 2>&1; else kill "$pid" 2>/dev/null; fi
    done
  fi
  # Only ever drops the scratch database, and only from a connection to the real one.
  if [[ "$(psql "$DATABASE_URL" -At -c "select 1 from pg_database where datname = '$QA_DB'")" == "1" ]]; then
    psql "$DATABASE_URL" -q -c "drop database $QA_DB" && echo "[qa] scratch database dropped"
  fi
  rm -f "$DUMP"
}
trap cleanup EXIT

if [[ -n "$(port_pids)" ]]; then echo "[qa] port $PORT is in use - stop whatever is running there first"; exit 1; fi
if [[ "$(psql "$DATABASE_URL" -At -c "select 1 from pg_database where datname = '$QA_DB'")" == "1" ]]; then
  echo "[qa] $QA_DB already exists (left over?) - drop it first: psql <url> -c 'drop database $QA_DB'"; trap - EXIT; exit 1
fi

echo "[qa] copying the local database to $QA_DB"
pg_dump "$DATABASE_URL" -Fc -f "$DUMP" || exit 1
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -c "create database $QA_DB" || exit 1
pg_restore --no-owner -d "$TEST_URL" "$DUMP" || exit 1

echo "[qa] applying data migrations (scripts/migrations) to the copy"
for m in scripts/migrations/*.sql; do psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$m" >/dev/null || { echo "[qa] migration $m FAILED"; exit 1; }; done
echo "[qa] applying the current schema to the copy"
DATABASE_URL="$TEST_URL" npx drizzle-kit push 2>&1 | grep -E "Changes applied|No changes|rror" || true
echo "[qa] applying post-schema migrations (scripts/migrations/post) to the copy"
for m in scripts/migrations/post/*.sql; do psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$m" >/dev/null || { echo "[qa] migration $m FAILED"; exit 1; }; done

if [[ "${QA_SKIP_BUILD:-}" != "1" ]]; then
  echo "[qa] building"
  pnpm build >/dev/null 2>&1 || { echo "[qa] build FAILED - run pnpm build to see why"; exit 1; }
fi

echo "[qa] starting the build on :$PORT against the copy"
DATABASE_URL="$TEST_URL" npx next start -p "$PORT" >/dev/null 2>&1 &
SERVER_STARTED=1
for _ in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$PORT/login" && break; sleep 1; done

FAILED=()
for t in throttle api history concurrency cart stock login realtime; do
  echo; echo "========== $t =========="
  QA_BASE_URL="http://localhost:$PORT" QA_DB_NAME="$QA_DB" node --env-file=.env.local "tests/qa/$t.test.mjs" || FAILED+=("$t")
done

echo
if [[ ${#FAILED[@]} -eq 0 ]]; then echo "[qa] ALL SUITES PASSED"; exit 0; fi
echo "[qa] FAILED SUITES: ${FAILED[*]}"; exit 1
