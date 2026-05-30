#!/bin/bash
set -e

# Start SQL Server in the background so the restore script can run against it.
/opt/mssql/bin/sqlservr &
SQLSERVR_PID=$!

# Restore the sample database (idempotent — skips if already present).
/usr/local/bin/restore.sh

# Forward termination signals and keep the container alive with SQL Server as PID-style anchor.
trap 'kill -TERM "$SQLSERVR_PID" 2>/dev/null' SIGTERM SIGINT
wait "$SQLSERVR_PID"
