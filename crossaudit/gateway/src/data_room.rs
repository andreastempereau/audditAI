use anyhow::Result;
use axum::body::Bytes;
use pgvector::Vector;
use tokio_postgres::types::ToSql;
use uuid::Uuid;

use crossaudit_ingestor::{chunks, embed, pdf};

use crate::{storage::Storage, AppState};

pub async fn save_doc(state: &AppState, bytes: Bytes) -> Result<()> {
    let path = state.storage.save(&bytes).await?;
    let text = pdf::parse(&bytes)?;
    let pieces = chunks::chunk_text(&text, 50);
    let embeddings = embed::embed_chunks(&pieces)?;

    let sha = {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut h = DefaultHasher::new();
        bytes.hash(&mut h);
        let digest = h.finish().to_be_bytes();
        [digest.repeat(4)].concat()
    };

    let doc_id = Uuid::new_v4();
    let client = state.pool.get().await?;
    client
        .execute(
            "INSERT INTO documents (id, org_id, path, sha256, mime, bytes) VALUES ($1,$2,$3,$4,$5,$6)",
            &[
                &doc_id,
                &Uuid::nil(),
                &path,
                &sha.as_slice() as &dyn ToSql,
                &"application/pdf",
                &(bytes.len() as i32),
            ],
        )
        .await?;

    for (idx, (chunk, emb)) in pieces.iter().zip(embeddings.iter()).enumerate() {
        let chunk_id = Uuid::new_v4();
        let vec: Vector = emb.clone().into();
        client
            .execute(
                "INSERT INTO chunks (id, org_id, doc_id, chunk_idx, embedding, plaintext) VALUES ($1,$2,$3,$4,$5,$6)",
                &[
                    &chunk_id,
                    &Uuid::nil(),
                    &doc_id,
                    &(idx as i32),
                    &vec,
                    chunk,
                ],
            )
            .await?;
    }
    Ok(())
}

pub async fn list_docs(state: &AppState) -> Result<Vec<String>> {
    state.storage.list().await
}

pub async fn search(state: &AppState, query: &str, limit: i64) -> Result<Vec<Uuid>> {
    let embedding = embed::embed_chunks(&[query.to_string()])?.remove(0);
    let vec: Vector = embedding.into();
    let client = state.pool.get().await?;
    let rows = client
        .query(
            "SELECT doc_id FROM chunks ORDER BY embedding <-> $1 LIMIT $2",
            &[&vec, &limit],
        )
        .await?;
    Ok(rows.iter().map(|r| r.get(0)).collect())
}
