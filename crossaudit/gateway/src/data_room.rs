use anyhow::Result;
use axum::body::Bytes;

use crate::{storage::Storage, AppState};

pub async fn save_doc(state: &AppState, bytes: Bytes) -> Result<()> {
    state.storage.save(&bytes).await.map(|_| ())
}

pub async fn list_docs(state: &AppState) -> Result<Vec<String>> {
    state.storage.list().await
}
