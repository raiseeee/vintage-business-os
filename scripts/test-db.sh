#!/usr/bin/env bash
# Applica le migrazioni su un Postgres locale temporaneo e lancia i test SQL.
# Non tocca nessun database esistente e non richiede Supabase.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Postgres non parte come root: se serve, rilancia lo script come utente "postgres".
if [ "$(id -u)" = "0" ]; then
  exec runuser -u postgres -- bash "${BASH_SOURCE[0]}" "$@"
fi

PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
if [ -z "${PGBIN:-}" ]; then
  echo "Postgres non trovato (cerco in /usr/lib/postgresql/*/bin)." >&2
  exit 1
fi

TMP="$(mktemp -d)"
cleanup() {
  "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-c listen_addresses='' -k $TMP" -l "$TMP/pg.log" -w start >/dev/null

PSQL=("$PGBIN/psql" -h "$TMP" -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c "create database vintage_test" >/dev/null
PSQL+=(-d vintage_test)

"${PSQL[@]}" -f "$ROOT/supabase/tests/00_harness.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo ">> migrazione $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

"${PSQL[@]}" -f "$ROOT/supabase/tests/01_rls_and_rules.sql"
