# SQL Server Data Dictionary Generator

Point it at a SQL Server database and it produces a polished, multi-sheet **Excel data
dictionary** — every table and column with its data type, nullability, primary/foreign keys,
identity and computed flags, defaults, and the descriptions stored as SQL Server extended
properties. Markdown output is available too.

The repository ships with the public **AdventureWorksLT** sample database, restored
automatically, so `docker compose up` produces a real dictionary with zero setup.

![CI](https://github.com/peem/sqlserver-data-dictionary/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

## What it captures

- Tables grouped by schema, with an **Overview** index sheet that links to each table.
- Per column: ordinal, data type (e.g. `nvarchar(50)`, `decimal(18,2)`), nullability,
  primary key, foreign key target, identity, computed, default value.
- Table and column **descriptions** read from `MS_Description` extended properties.

## Quick start

> Prerequisites: **Docker and git only.**

```bash
git clone https://github.com/peem/sqlserver-data-dictionary.git
cd sqlserver-data-dictionary
cp .env.example .env
docker compose up --build
```

When it finishes, the dictionary is at `output/AdventureWorksLT-data-dictionary.xlsx`.

### Point it at your own database

```bash
docker compose run --rm generator \
  node dist/index.js --host my-server --database MyDb --user sa --password '***' \
  --output /app/output/MyDb.xlsx
```

Markdown instead of Excel:

```bash
docker compose run --rm generator node dist/index.js --format markdown
```

## Configuration

| Flag | Env | Default |
|------|-----|---------|
| `--host` | `DB_HOST` | `localhost` |
| `--port` | `DB_PORT` | `1433` |
| `--user` | `DB_USER` | `sa` |
| `--password` | `DB_PASSWORD` | — |
| `--database` | `DB_NAME` | `AdventureWorksLT` |
| `--output` | `OUTPUT_PATH` | `output/data-dictionary.xlsx` |
| `--format` | `OUTPUT_FORMAT` | `excel` |

## How it works

```
docker compose up
  └─ sqlserver  : custom image restores AdventureWorksLT from a baked-in .bak, then reports
                  healthy only once the database is online
  └─ generator  : waits for healthy, reads sys.* catalog views, builds the model, writes Excel
```

The schema introspection lives in `src/db/introspect.ts`; the pure rows→model transform in
`src/model/mapper.ts`; the Excel rendering in `src/output/excel.ts`.

## Tests

```bash
# Unit tests (pure mapping + workbook building, no database)
docker build -t data-dictionary .
docker run --rm data-dictionary npm run test:unit

# Integration test (against the dockerized sample database)
docker compose up -d --build sqlserver
docker compose run --rm generator npm run test:integration
```

Both suites also run on every push via GitHub Actions.

## License

[MIT](LICENSE)
