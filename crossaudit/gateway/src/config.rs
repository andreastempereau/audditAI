use std::env;

#[derive(Clone)]
pub struct Settings {
    pub server_addr: String,
    pub database_url: String,
    pub openai_api_key: String,
    pub storage_path: String,
    pub local_model_path: Option<String>,
}

impl Settings {
    pub fn from_env() -> Self {
        Self {
            server_addr: env::var("SERVER_ADDR").unwrap_or_else(|_| "0.0.0.0:8000".into()),
            database_url: env::var("DATABASE_URL").unwrap_or_default(),
            openai_api_key: env::var("OPENAI_API_KEY").unwrap_or_default(),
            storage_path: env::var("STORAGE_PATH").unwrap_or_else(|_| "./storage".into()),
            local_model_path: env::var("LOCAL_MODEL_PATH").ok(),
        }
    }
}
