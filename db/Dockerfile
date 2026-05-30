# Custom SQL Server image that bakes in the public AdventureWorksLT sample database
# and restores it automatically on first start. Build context is the repository root.
FROM mcr.microsoft.com/mssql/server:2022-latest

USER root

# Install the command-line tools used by the restore script and download the sample
# backup at build time so the first `docker compose up` is deterministic and offline.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl gnupg apt-transport-https \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc -o /etc/apt/trusted.gpg.d/microsoft.asc \
    && curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/prod.list -o /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends mssql-tools18 \
    && mkdir -p /var/opt/mssql/backup \
    && curl -fsSL -o /var/opt/mssql/backup/AdventureWorksLT2022.bak \
       https://github.com/Microsoft/sql-server-samples/releases/download/adventureworks/AdventureWorksLT2022.bak \
    && rm -rf /var/lib/apt/lists/*

COPY db/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY db/restore.sh /usr/local/bin/restore.sh
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/restore.sh

USER mssql
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
