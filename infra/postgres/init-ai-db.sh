#!/bin/bash
# Runs once on first Postgres boot (docker-entrypoint-initdb.d).
# Creates the AI service's database alongside Chatwoot's, and enables pgvector in both.
set -e

AI_DB="${AI_KB_DB:-marketing_ai}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
	SELECT 'CREATE DATABASE ${AI_DB}'
	WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${AI_DB}')\gexec
EOSQL

# Enable the vector extension in the AI database (and Chatwoot's, harmless if unused).
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${AI_DB}" -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${POSTGRES_DB}" -c "CREATE EXTENSION IF NOT EXISTS vector;"
