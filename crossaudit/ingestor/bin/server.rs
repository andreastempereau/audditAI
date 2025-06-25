use axum::{routing::post, Router};
use std::net::SocketAddr;

async fn upload(bytes: axum::body::Bytes) -> axum::http::StatusCode {
    tokio::fs::write("/tmp/uploaded", bytes).await.ok();
    axum::http::StatusCode::OK
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let app = Router::new().route("/ingest", post(upload));
    let addr: SocketAddr = "0.0.0.0:9000".parse()?;
    axum::Server::bind(&addr).serve(app.into_make_service()).await?;
    Ok(())
}
