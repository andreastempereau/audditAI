use clap::Parser;
use crossaudit_ingestor::upload;

#[derive(Parser)]
struct Args {
    file: String,
    #[clap(long, default_value = "http://localhost:8000/upload")]
    endpoint: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    upload(&args.file, &args.endpoint).await?;
    Ok(())
}
