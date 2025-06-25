use crate::{config::Settings, policy::PolicyEngine, storage::Storage};
use deadpool_postgres::{Manager, ManagerConfig, Pool, RecyclingMethod};
use tokio_postgres::{NoTls, Config as PgConfig};
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct AppState {
    pub settings: Settings,
    pub pool: Pool,
    pub policy: PolicyEngine,
    pub storage: Storage,
    pub alerts: broadcast::Sender<String>,
}

pub async fn init_state(settings: Settings) -> anyhow::Result<AppState> {
    let mut pg_cfg: PgConfig = settings.database_url.parse()?;
    let mgr_config = ManagerConfig { recycling_method: RecyclingMethod::Fast };
    let mgr = Manager::from_config(pg_cfg, NoTls, mgr_config);
    let pool = Pool::builder(mgr).max_size(16).build().unwrap();

    let policy = PolicyEngine::load_default()?;
    let storage = Storage::new(&settings.storage_path).await?;
    let (tx, _rx) = broadcast::channel(100);

    Ok(AppState { settings, pool, policy, storage, alerts: tx })
}

pub fn build_router(state: AppState) -> axum::Router {
    use axum::routing::{get, post};
    axum::Router::new()
        .route("/chat", post(crate::routes::chat))
        .route("/alerts", get(crate::routes::alerts))
        .route("/docs", get(crate::routes::list_docs))
        .route("/upload", post(crate::routes::upload_doc))
        .with_state(state)
}
