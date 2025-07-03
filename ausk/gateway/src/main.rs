use crossaudit_gateway::{build_router, init_state, config::Settings};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let settings = Settings::from_env();
    let state = init_state(settings.clone()).await?;
    let router = build_router(state);
    println!("Starting gateway on {}", settings.server_addr);
    axum::Server::bind(&settings.server_addr.parse()?)
        .serve(router.into_make_service())
        .await?;
    Ok(())
}
