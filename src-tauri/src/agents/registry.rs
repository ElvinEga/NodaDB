use crate::agents::adapter::{AgentAdapter, AgentInfo};
use crate::agents::adapters::{ClaudeAdapter, CodexAdapter, GeminiAdapter, OpenCodeAdapter};
use anyhow::{anyhow, Result};
use std::sync::Arc;

pub struct AgentRegistry {
    adapters: Vec<Arc<dyn AgentAdapter>>,
}

impl Default for AgentRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentRegistry {
    pub fn new() -> Self {
        let adapters: Vec<Arc<dyn AgentAdapter>> = vec![
            Arc::new(CodexAdapter),
            Arc::new(ClaudeAdapter),
            Arc::new(OpenCodeAdapter),
            Arc::new(GeminiAdapter),
        ];

        Self { adapters }
    }

    pub fn detect_all(&self) -> Vec<AgentInfo> {
        self.adapters
            .iter()
            .map(|a| a.detect().unwrap_or_else(|_| AgentInfo {
                id: a.id().to_string(),
                name: a.name().to_string(),
                binary_name: a.binary_name().to_string(),
                installed: false,
                version: None,
                path: None,
                capabilities: a.capabilities(),
                description: a.description().to_string(),
            }))
            .collect()
    }

    pub fn get_adapter(&self, id: &str) -> Result<Arc<dyn AgentAdapter>> {
        self.adapters
            .iter()
            .find(|a| a.id() == id || a.binary_name() == id)
            .cloned()
            .ok_or_else(|| anyhow!("Unknown agent ID: '{}'. Available: codex, claude, opencode, gemini", id))
    }
}
