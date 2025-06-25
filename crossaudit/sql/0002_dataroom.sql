-- dataroom tables
CREATE TABLE IF NOT EXISTS documents (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL,
    path        TEXT NOT NULL,
    sha256      BYTEA NOT NULL,
    mime        TEXT NOT NULL,
    bytes       INTEGER NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id     UUID NOT NULL,
    doc_id     UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_idx  INTEGER NOT NULL,
    embedding  VECTOR(1536),
    plaintext  TEXT
);
