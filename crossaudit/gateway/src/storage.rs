use std::path::{Path, PathBuf};

use anyhow::Result;
use tokio::fs;

#[derive(Clone)]
pub struct Storage {
    root: PathBuf,
}

impl Storage {
    pub async fn new(root: &str) -> Result<Self> {
        let path = PathBuf::from(root);
        fs::create_dir_all(&path).await?;
        Ok(Self { root: path })
    }

    pub async fn save(&self, bytes: &[u8]) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let file = self.root.join(&id);
        fs::write(&file, bytes).await?;
        Ok(id)
    }

    pub async fn list(&self) -> Result<Vec<String>> {
        let mut out = Vec::new();
        let mut entries = fs::read_dir(&self.root).await?;
        while let Some(e) = entries.next_entry().await? {
            if e.file_type().await?.is_file() {
                if let Some(name) = e.file_name().to_str() {
                    out.push(name.to_string());
                }
            }
        }
        Ok(out)
    }
}
