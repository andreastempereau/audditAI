use anyhow::Result;
use crate::AppState;
use uuid::Uuid;
use serde_json::Value;

pub async fn log_chat(
    state: &AppState,
    org_id: &str,
    prompt: &str,
    response: &str,
    action: &str,
    tokens: i32,
    score: Option<f32>,
    fragments: &[Uuid],
    trace: Option<&Value>,
) -> Result<()> {
    let client = state.pool.get().await?;
    client
        .execute(
            "INSERT INTO audit_ledger (org_id, prompt, response, tokens, action, score, fragment_ids, trace) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
            &[&org_id, &prompt, &response, &tokens, &action, &score, &fragments, &trace],
        )
        .await?;
    Ok(())
}
