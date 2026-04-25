-- =============================================================================
-- HUB PostgreSQL Init Script
-- Creates all required databases for the hub stack
-- Auto-runs on first container start via /docker-entrypoint-initdb.d/
-- =============================================================================

-- app_db is created automatically by POSTGRES_DB env var
-- We only need to create n8n_db here

SELECT 'CREATE DATABASE n8n_db OWNER hub_user'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'n8n_db'
)\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE n8n_db TO hub_user;
GRANT ALL PRIVILEGES ON DATABASE app_db TO hub_user;

-- Connect to n8n_db and set up schema
\connect n8n_db
GRANT ALL ON SCHEMA public TO hub_user;

-- Connect to app_db and ensure schema is ready
\connect app_db
GRANT ALL ON SCHEMA public TO hub_user;
