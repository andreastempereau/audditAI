use anyhow::Result;
use clap::Parser;

use crate::{config::Settings, llm_client, init_state};

#[derive(Parser)]
pub struct Args {
    pub prompt: String,
}

pub async fn run() -> Result<()> {
    let args = Args::parse();
    let settings = Settings::from_env();
    let state = init_state(settings).await?;
    let resp = llm_client::chat(&state, &args.prompt).await?;
    println!("{}", resp);
    Ok(())
}
