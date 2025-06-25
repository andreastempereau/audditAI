use axum::{extract::State, response::{IntoResponse, sse::{Event, Sse, KeepAlive}}, Json};
use futures_util::{StreamExt, stream::Stream};
use tokio_stream::wrappers::BroadcastStream;
use serde::{Deserialize, Serialize};
use crate::{data_room, llm_client, audit, AppState};
use axum::http::StatusCode;
use std::convert::Infallible;

#[derive(Deserialize)]
pub struct ChatRequest {
    pub prompt: String,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub response: String,
}

pub async fn chat(State(state): State<AppState>, Json(body): Json<ChatRequest>) -> impl IntoResponse {
    let (modified, action) = state.policy.apply(&body.prompt);
    if matches!(action.as_deref(), Some("block")) {
        let _ = audit::log_chat(&state, "00000000-0000-0000-0000-000000000000", &body.prompt, "", "block", 0).await;
        let _ = state.alerts.send(format!("blocked:{}", body.prompt));
        return (StatusCode::FORBIDDEN, "blocked").into_response();
    }

    let prompt = if matches!(action.as_deref(), Some("rewrite")) { modified } else { body.prompt.clone() };

    match llm_client::chat(&state, &prompt).await {
        Ok(resp) => {
            let tokens = resp.split_whitespace().count() as i32;
            let act = action.as_deref().unwrap_or("allow");
            let _ = audit::log_chat(&state, "00000000-0000-0000-0000-000000000000", &body.prompt, &resp, act, tokens).await;
            Json(ChatResponse { response: resp }).into_response()
        }
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()).into_response(),
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

pub async fn alerts(State(state): State<AppState>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.alerts.subscribe();
    let stream = BroadcastStream::new(rx)
        .filter_map(|msg| async move { msg.ok() })
        .map(|msg| Ok(Event::default().data(msg)));
    Sse::new(stream).keep_alive(KeepAlive::default())
}
