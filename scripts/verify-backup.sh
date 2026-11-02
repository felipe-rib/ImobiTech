#!/bin/sh
# Execute inside the backup service. Never restores over the source database.
set -eu
file=${1:?Informe o caminho do dump no volume /backups}
case "$file" in /backups/*.dump) ;; *) echo 'Use um dump de /backups.' >&2; exit 1;; esac
test -f "$file"
target="imobitech_restore_check_$(date -u +%Y%m%d%H%M%S)_$$"
test "$target" != "$PGDATABASE"
createdb "$target"
cleanup() { dropdb --if-exists "$target"; }
trap cleanup EXIT INT TERM
pg_restore --exit-on-error --no-owner --dbname="$target" "$file"
psql --dbname="$target" --set=ON_ERROR_STOP=1 --command="SELECT 'users' AS entidade,count(*) FROM users UNION ALL SELECT 'properties',count(*) FROM properties UNION ALL SELECT 'contracts',count(*) FROM contracts UNION ALL SELECT 'payments',count(*) FROM payments UNION ALL SELECT 'audit_events',count(*) FROM audit_events;"
echo 'Restauração verificada em banco temporário separado.'
