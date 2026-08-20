use crate::agents::adapter::{find_binary_in_path, AgentAdapter, AgentDbContext, AgentInfo};
use anyhow::{anyhow, Result};
use std::process::Command as StdCommand;
use tokio::process::Command as TokioCommand;

pub struct OpenCodeAdapter;

impl AgentAdapter for OpenCodeAdapter {
    fn id(&self) -> &str {
        "opencode"
    }

    fn name(&self) -> &str {
        "OpenCode"
    }

    fn binary_name(&self) -> &str {
        "opencode"
    }

    fn description(&self) -> &str {
        "OpenCode AI CLI — multi-provider open-source coding agent with database tooling"
    }

    fn detect(&self) -> Result<AgentInfo> {
        let binary_path = find_binary_in_path("opencode");
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
        let binary_path = find_binary_in_path("opencode")
            .ok_or_else(|| anyhow!("OpenCode CLI ('opencode') is not installed or not found in PATH"))?;

        let mut cmd = TokioCommand::new(binary_path);
        let combined = format!(
            "{}\n\n# Task\n{}",
            context.to_prompt_context(),
            prompt
        );

        // Run non-interactively via `opencode run`
        cmd.arg("run").arg(&combined);

        Ok(cmd)
    }

    fn capabilities(&self) -> Vec<String> {
        vec![
            "Multi-Model Switching".into(),
            "Interactive Sessions".into(),
            "Schema Generation".into(),
            "DB Scripting".into(),
        ]
    }
}
