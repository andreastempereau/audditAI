pub mod chunks;
pub mod embed;
pub mod pdf;

use anyhow::Result;
use reqwest::Client;
use tokio::fs;

pub async fn upload(path: &str, endpoint: &str) -> Result<()> {
    let data = fs::read(path).await?;
    Client::new()
        .post(endpoint)
        .body(data)
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}
