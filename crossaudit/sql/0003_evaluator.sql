-- evaluator keys
CREATE TABLE IF NOT EXISTS evaluator_keys (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL,
    provider    TEXT NOT NULL,
    api_key     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
