use anyhow::{Context, Result};
use regex::Regex;
use serde::Deserialize;
use std::fs;

#[derive(Deserialize, Clone)]
pub struct Rule {
    pub id: String,
    pub pattern: String,
    pub action: String,
    pub replacement: Option<String>,
}

#[derive(Deserialize)]
struct RawPolicy {
    rules: Vec<Rule>,
}

#[derive(Clone)]
pub struct CompiledRule {
    pub rule: Rule,
    pub regex: Regex,
}

#[derive(Clone)]
pub struct PolicyEngine {
    pub rules: Vec<CompiledRule>,
}

impl PolicyEngine {
    pub fn load_default() -> Result<Self> {
        Self::load_from_path("config/rules.yaml")
    }

    pub fn load_from_path(path: &str) -> Result<Self> {
        let txt = fs::read_to_string(path)?;
        let raw: RawPolicy = serde_yaml::from_str(&txt)?;
        let mut rules = Vec::new();
        for r in raw.rules {
            let regex = Regex::new(&r.pattern).context("invalid regex")?;
            rules.push(CompiledRule { rule: r, regex });
        }
        Ok(Self { rules })
    }

    pub fn apply(&self, text: &str) -> (String, Option<String>) {
        let mut out = text.to_string();
        let mut action = None;
        for rule in &self.rules {
            if rule.regex.is_match(text) {
                action = Some(rule.rule.action.clone());
                if let Some(rep) = &rule.rule.replacement {
                    out = rule.regex.replace_all(text, rep.as_str()).into();
                }
                break;
            }
        }
        (out, action)
    }
}
