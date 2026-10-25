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

SHARED="20261025000001_shared_business.sql"

# 1) Tutte le migrazioni precedenti: il database com'era prima dell'attività condivisa.
for f in "$ROOT"/supabase/migrations/*.sql; do
  [[ "$(basename "$f")" < "$SHARED" ]] || continue
  echo ">> migrazione $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

# 2) Test del modello a utente singolo: lasciano dati veri dell'utente A (prova della migrazione dei dati).
"${PSQL[@]}" -f "$ROOT/supabase/tests/01_rls_and_rules.sql"

# 3) Applica l'attività condivisa SUI DATI ESISTENTI e controlla che sia intatto tutto.
echo ">> migrazione $SHARED"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/$SHARED"

# Copia del database appena migrato (per provare il rollback sugli stessi dati).
"$PGBIN/psql" -h "$TMP" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X \
  -c "create database vintage_rollback template vintage_test" >/dev/null

# 4) Test del nuovo modello.
"${PSQL[@]}" -f "$ROOT/supabase/tests/02_shared_business.sql"

# 4b) Migrazioni successive all'attività condivisa, poi i loro test.
for f in "$ROOT"/supabase/migrations/*.sql; do
  [[ "$(basename "$f")" > "$SHARED" ]] || continue
  echo ">> migrazione $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f "$ROOT/supabase/tests/04_inventory.sql"
"${PSQL[@]}" -f "$ROOT/supabase/tests/05_inventory_stock.sql"

# 5) Rollback sulla copia: i dati ci sono ancora e il vecchio modello funziona di nuovo.
echo ">> rollback (su copia)"
RB=("$PGBIN/psql" -h "$TMP" -U postgres -d vintage_rollback -v ON_ERROR_STOP=1 -q -X)
"${RB[@]}" -f "$ROOT/supabase/rollback/20261025000001_shared_business_down.sql"
"${RB[@]}" -f "$ROOT/supabase/tests/03_rollback.sql"
# 6) Rollback dell'inventario (alla fine, sul database di prova): la vendita resta, spariscono tabella e colonna.
SALES_BEFORE="$("${PSQL[@]}" -t -A -c "select count(*) from public.sales")"
"${PSQL[@]}" -f "$ROOT/supabase/rollback/20261027000001_inventory_stock_down.sql"
"${PSQL[@]}" -f "$ROOT/supabase/rollback/20261026000001_inventory_down.sql"
"${PSQL[@]}" -c "select test.expect_equal((select count(*) from information_schema.columns where table_name = 'sales' and column_name = 'materials_cost_cents'), 0, 'rollback inventario: colonna rimossa')" >/dev/null
"${PSQL[@]}" -c "select test.expect_equal((select count(*) from public.sales), $SALES_BEFORE, 'rollback inventario: le vendite restano')" >/dev/null
echo '=== TUTTI I TEST SQL SUPERATI ==='
