use axum::{extract::State, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};

use crate::{data_room, llm_client, AppState};

#[derive(Deserialize)]
pub struct ChatRequest {
    pub prompt: String,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub response: String,
}

pub async fn chat(State(state): State<AppState>, Json(body): Json<ChatRequest>) -> impl IntoResponse {
    match llm_client::chat(&state, &body.prompt).await {
        Ok(resp) => Json(ChatResponse { response: resp }).into_response(),
        Err(err) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, err.to_string()).into_response(),
    }
}

pub async fn list_docs(State(state): State<AppState>) -> impl IntoResponse {
    match data_room::list_docs(&state).await {
        Ok(list) => Json(list).into_response(),
        Err(err) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, err.to_string()).into_response(),
    }
}

pub async fn upload_doc(State(state): State<AppState>, bytes: axum::body::Bytes) -> impl IntoResponse {
    match data_room::save_doc(&state, bytes).await {
        Ok(()) => axum::http::StatusCode::CREATED.into_response(),
        Err(err) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, err.to_string()).into_response(),
    }
}
