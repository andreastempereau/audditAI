-- organisations and billing
CREATE TABLE IF NOT EXISTS organisations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_usage (
    id          SERIAL PRIMARY KEY,
    org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    ts          DATE NOT NULL,
    tokens      INTEGER NOT NULL
);
