use axum::{extract::State, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};

use crate::{data_room, llm_client, audit, AppState};
use uuid::Uuid;
use serde_json::json;

#[derive(Deserialize)]
pub struct ChatRequest {
    pub prompt: String,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub response: String,
}

pub async fn chat(State(state): State<AppState>, Json(body): Json<ChatRequest>) -> impl IntoResponse {
    // search relevant docs
    let fragments = match data_room::search(&state, &body.prompt, 3).await {
        Ok(list) => list,
        Err(_) => Vec::new(),
    };
    let (mut rewritten, action) = state.policy.apply(&body.prompt);
    if action.as_deref() == Some("block") {
        audit::log_chat(&state, "00000000-0000-0000-0000-000000000000", &body.prompt, "blocked", "block", 0, None, &fragments, None).await.ok();
        return (axum::http::StatusCode::FORBIDDEN, "blocked").into_response();
    }
    if let Some(act) = action {
        if act == "rewrite" {
            rewritten = rewritten.clone();
        }
    }
    match llm_client::chat(&state, &rewritten, &fragments).await {
        Ok(resp) => {
            let _ = audit::log_chat(&state, "00000000-0000-0000-0000-000000000000", &body.prompt, &resp, action.as_deref().unwrap_or("pass"), resp.len() as i32, None, &fragments, Some(&json!({"rewritten": rewritten != body.prompt}))).await;
            Json(ChatResponse { response: resp }).into_response()
        },
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
