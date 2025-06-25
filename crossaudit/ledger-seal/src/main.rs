use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    loop {
        println!("ledger seal running...");
        sleep(Duration::from_secs(3600)).await;
    }
}
