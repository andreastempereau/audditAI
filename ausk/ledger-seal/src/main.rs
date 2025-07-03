use tokio::time::{sleep, Duration};
use deadpool_postgres::{Manager, Pool, RecyclingMethod, ManagerConfig};
use tokio_postgres::{NoTls, Config as PgConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let db_url = std::env::var("DATABASE_URL").unwrap_or_default();
    let pg_cfg: PgConfig = db_url.parse()?;
    let mgr_config = ManagerConfig { recycling_method: RecyclingMethod::Fast };
    let mgr = Manager::from_config(pg_cfg, NoTls, mgr_config);
    let pool = Pool::builder(mgr).max_size(4).build().unwrap();

    loop {
        let client = pool.get().await?;
        client
            .execute(
                "UPDATE audit_ledger SET trace = coalesce(trace, '{}'::jsonb) || jsonb_build_object('sealed', true) WHERE trace->>'sealed' IS NULL",
                &[],
            )
            .await?;
        sleep(Duration::from_secs(3600)).await;
    }
}
