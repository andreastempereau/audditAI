use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

#[derive(Serialize)]
struct OpenAiRequest<'a> {
    model: &'a str,
    messages: Vec<Message<'a>>,
}

#[derive(Serialize)]
struct Message<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Deserialize)]
struct Choice {
    message: MessageResp,
}

#[derive(Deserialize)]
struct MessageResp {
    content: String,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<Choice>,
}

pub async fn chat(state: &AppState, prompt: &str, fragments: &[Uuid]) -> Result<String> {
    let ctx = if fragments.is_empty() {
        String::new()
    } else {
        format!("Context docs: {:?}\n", fragments)
    };
    let full_prompt = format!("{}{}", ctx, prompt);
    if !state.settings.openai_api_key.is_empty() {
        let client = Client::new();
        let req = OpenAiRequest {
            model: "gpt-3.5-turbo",
            messages: vec![Message { role: "user", content: &full_prompt }],
        };
        let resp: OpenAiResponse = client
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(&state.settings.openai_api_key)
            .json(&req)
            .send()
            .await?
            .json()
            .await?;
        Ok(resp.choices.first().map(|c| c.message.content.clone()).unwrap_or_default())
    } else {
        Ok(format!("local model response to '{}'", prompt))
    }
}
