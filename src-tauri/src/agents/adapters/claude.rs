use crate::agents::adapter::{find_binary_in_path, AgentAdapter, AgentDbContext, AgentInfo};
use anyhow::{anyhow, Result};
use std::process::Command as StdCommand;
use tokio::process::Command as TokioCommand;

pub struct ClaudeAdapter;

impl AgentAdapter for ClaudeAdapter {
    fn id(&self) -> &str {
        "claude"
    }

    fn name(&self) -> &str {
        "Claude Code"
    }

    fn binary_name(&self) -> &str {
        "claude"
    }

    fn description(&self) -> &str {
        "Anthropic Claude Code CLI — deep reasoning, complex database refactoring, and multi-table flow analysis"
    }

    fn detect(&self) -> Result<AgentInfo> {
        let binary_path = find_binary_in_path("claude");
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
        let binary_path = find_binary_in_path("claude")
            .ok_or_else(|| anyhow!("Claude Code CLI ('claude') is not installed or not found in PATH"))?;

        let mut cmd = TokioCommand::new(binary_path);
        let db_ctx = context.to_prompt_context();

        // Use print non-interactive mode with append-system-prompt
        cmd.arg("-p")
            .arg(prompt)
            .arg("--append-system-prompt")
            .arg(&db_ctx);

        Ok(cmd)
    }

    fn capabilities(&self) -> Vec<String> {
        vec![
            "Deep DB Reasoning".into(),
            "Relationship Flow Analysis".into(),
            "Query Plan Diagnosis".into(),
            "Zero-Data-Loss Refactoring".into(),
        ]
    }
}
