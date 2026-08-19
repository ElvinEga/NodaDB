use crate::agents::adapter::{find_binary_in_path, AgentAdapter, AgentDbContext, AgentInfo};
use anyhow::{anyhow, Result};
use std::process::Command as StdCommand;
use tokio::process::Command as TokioCommand;

pub struct GeminiAdapter;

impl AgentAdapter for GeminiAdapter {
    fn id(&self) -> &str {
        "gemini"
    }

    fn name(&self) -> &str {
        "Gemini CLI"
    }

    fn binary_name(&self) -> &str {
        "gemini"
    }

    fn description(&self) -> &str {
        "Google Gemini CLI / AGY — ultra-fast large-context analysis, SQL optimization, and database architecture"
    }

    fn detect(&self) -> Result<AgentInfo> {
        // Check for `gemini` or `agy`
        let binary_path = find_binary_in_path("gemini").or_else(|| find_binary_in_path("agy"));
        let installed = binary_path.is_some();
        let mut version = None;

        if let Some(ref path) = binary_path {
            if let Ok(output) = StdCommand::new(path).arg("--version").output() {
                if output.status.success() {
                    let v = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !v.is_empty() {
                        version = Some(v);
                    }
                }
            }
        }

        Ok(AgentInfo {
            id: self.id().to_string(),
            name: self.name().to_string(),
            binary_name: self.binary_name().to_string(),
            installed,
            version,
            path: binary_path,
            capabilities: self.capabilities(),
            description: self.description().to_string(),
        })
    }

    fn build_command(&self, prompt: &str, context: &AgentDbContext) -> Result<TokioCommand> {
        let binary_path = find_binary_in_path("gemini")
            .or_else(|| find_binary_in_path("agy"))
            .ok_or_else(|| anyhow!("Gemini CLI ('gemini' or 'agy') is not installed or not found in PATH"))?;

        let mut cmd = TokioCommand::new(binary_path);
        let combined = format!(
            "{}\n\n# User Request\n{}",
            context.to_prompt_context(),
            prompt
        );

        // Run non-interactively via `-p/--prompt`
        cmd.arg("-p").arg(&combined);

        Ok(cmd)
    }

    fn capabilities(&self) -> Vec<String> {
        vec![
            "1M+ Token Context".into(),
            "Fast Query Analytics".into(),
            "Complex SQL Explain".into(),
            "Database Schema Synthesis".into(),
        ]
    }
}
