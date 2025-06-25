use axum::{routing::get, Router};
use std::net::SocketAddr;

async fn key() -> &'static str { "not-implemented" }

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let app = Router::new().route("/key", get(key));
    let addr: SocketAddr = "0.0.0.0:9101".parse()?;
    axum::Server::bind(&addr).serve(app.into_make_service()).await?;
    Ok(())
}
