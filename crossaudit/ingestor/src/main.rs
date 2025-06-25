use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    println!("Ingestor CLI. Use `cargo run --bin cli -- <file>`");
    Ok(())
}
