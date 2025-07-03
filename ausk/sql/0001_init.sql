CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS audit_ledger (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL,
    ts_start    TIMESTAMPTZ NOT NULL DEFAULT now(),
    prompt      TEXT NOT NULL,
    response    TEXT NOT NULL,
    tokens      INTEGER NOT NULL,
    action      TEXT NOT NULL,
    score       REAL,
    fragment_ids UUID[],
    trace       JSONB
);
