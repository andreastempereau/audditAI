use axum::{routing::{get, post}, Router, Json};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use deadpool_postgres::{Manager, Pool, RecyclingMethod, ManagerConfig};
use tokio_postgres::{NoTls, Config as PgConfig};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    pool: Pool,
}

#[derive(Deserialize)]
struct NewKey {
    provider: String,
    api_key: String,
    org_id: Option<Uuid>,
}

#[derive(Serialize)]
struct KeyInfo {
    id: Uuid,
    provider: String,
    api_key: String,
}

async fn list_keys(state: axum::extract::State<AppState>) -> anyhow::Result<Json<Vec<KeyInfo>>> {
    let client = state.pool.get().await?;
    let rows = client
        .query("SELECT id, provider, api_key FROM evaluator_keys", &[])
        .await?;
    let keys = rows
        .iter()
        .map(|r| KeyInfo {
            id: r.get(0),
            provider: r.get(1),
            api_key: r.get(2),
        })
        .collect();
    Ok(Json(keys))
}

async fn add_key(state: axum::extract::State<AppState>, Json(body): Json<NewKey>) -> anyhow::Result<()> {
    let client = state.pool.get().await?;
    client
        .execute(
            "INSERT INTO evaluator_keys (org_id, provider, api_key) VALUES ($1,$2,$3)",
            &[&body.org_id.unwrap_or_else(Uuid::nil), &body.provider, &body.api_key],
        )
        .await?;
    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let db_url = std::env::var("DATABASE_URL").unwrap_or_default();
    let mut pg_cfg: PgConfig = db_url.parse()?;
    let mgr_config = ManagerConfig { recycling_method: RecyclingMethod::Fast };
    let mgr = Manager::from_config(pg_cfg, NoTls, mgr_config);
    let pool = Pool::builder(mgr).max_size(16).build().unwrap();

    let state = AppState { pool };
    let app = Router::new()
        .route("/keys", get(list_keys).post(add_key))
        .with_state(state);

    let addr: SocketAddr = "0.0.0.0:9101".parse()?;
    axum::Server::bind(&addr).serve(app.into_make_service()).await?;
    Ok(())
}
