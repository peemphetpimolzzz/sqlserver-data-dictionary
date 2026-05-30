#!/bin/bash
set -e

SQLCMD="/opt/mssql-tools18/bin/sqlcmd"
DB_NAME="${DB_NAME:-AdventureWorksLT}"
BAK="/var/opt/mssql/backup/AdventureWorksLT2022.bak"

# Wait until SQL Server actually accepts logins (a real probe, not a fixed sleep).
# -C trusts the server's self-signed certificate (tools v18 encrypt by default).
for i in $(seq 1 60); do
  if "$SQLCMD" -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  echo "Waiting for SQL Server to accept connections ($i/60)..."
  sleep 1
done

# Idempotent: if the database is already there (persisted volume / restart), do nothing.
EXISTS=$("$SQLCMD" -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -h -1 \
  -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.databases WHERE name='$DB_NAME'" | tr -d '[:space:]')
if [ "$EXISTS" = "1" ]; then
  echo "Database $DB_NAME already present; skipping restore."
  exit 0
fi

echo "Restoring $DB_NAME from $BAK ..."
"$SQLCMD" -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -b -Q \
  "RESTORE DATABASE [$DB_NAME] FROM DISK='$BAK' WITH \
     MOVE 'AdventureWorksLT2022_Data' TO '/var/opt/mssql/data/${DB_NAME}.mdf', \
     MOVE 'AdventureWorksLT2022_Log'  TO '/var/opt/mssql/data/${DB_NAME}.ldf', \
     REPLACE, RECOVERY;"
echo "Restore complete."
