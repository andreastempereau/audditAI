use crate::{config::Settings, policy::PolicyEngine, storage::Storage};
use deadpool_postgres::{Manager, ManagerConfig, Pool, RecyclingMethod};
use tokio_postgres::{NoTls, Config as PgConfig};
use tokio::fs;

#[derive(Clone)]
pub struct AppState {
    pub settings: Settings,
    pub pool: Pool,
    pub policy: PolicyEngine,
    pub storage: Storage,
}

pub async fn init_state(settings: Settings) -> anyhow::Result<AppState> {
    let mut pg_cfg: PgConfig = settings.database_url.parse()?;
    let mgr_config = ManagerConfig { recycling_method: RecyclingMethod::Fast };
    let mgr = Manager::from_config(pg_cfg, NoTls, mgr_config);
    let pool = Pool::builder(mgr).max_size(16).build().unwrap();

    let policy = PolicyEngine::load_default()?;
    let storage = Storage::new(&settings.storage_path).await?;

    run_migrations(&pool).await?;

    Ok(AppState { settings, pool, policy, storage })
}

pub fn build_router(state: AppState) -> axum::Router {
    use axum::routing::{get, post};
    axum::Router::new()
        .route("/chat", post(crate::routes::chat))
        .route("/docs", get(crate::routes::list_docs))
        .route("/upload", post(crate::routes::upload_doc))
        .with_state(state)
}

async fn run_migrations(pool: &Pool) -> anyhow::Result<()> {
    let client = pool.get().await?;
    let tx = client.transaction().await?;
    for entry in fs::read_dir("./sql").await? {
        let entry = entry?;
        if entry.file_type().await?.is_file() {
            let sql = fs::read_to_string(entry.path()).await?;
            tx.batch_execute(&sql).await?;
        }
    }
    tx.commit().await?;
    Ok(())
}
