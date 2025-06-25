use anyhow::Result;
use crate::AppState;

pub async fn log_chat(state: &AppState, org_id: &str, prompt: &str, response: &str, action: &str, tokens: i32) -> Result<()> {
    let client = state.pool.get().await?;
    client
        .execute(
            "INSERT INTO audit_ledger (org_id, prompt, response, tokens, action) VALUES ($1,$2,$3,$4,$5)",
            &[&org_id, &prompt, &response, &tokens, &action],
        )
        .await?;
    Ok(())
}
