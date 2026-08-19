use crate::agents::adapter::{find_binary_in_path, AgentAdapter, AgentDbContext, AgentInfo};
use anyhow::{anyhow, Result};
use std::process::Command as StdCommand;
use tokio::process::Command as TokioCommand;

pub struct CodexAdapter;

impl AgentAdapter for CodexAdapter {
    fn id(&self) -> &str {
        "codex"
    }

    fn name(&self) -> &str {
        "Codex CLI"
    }

    fn binary_name(&self) -> &str {
        "codex"
    }

    fn description(&self) -> &str {
        "OpenAI Codex coding agent CLI — fast code generation, query optimization, and schema design"
    }

    fn detect(&self) -> Result<AgentInfo> {
        let binary_path = find_binary_in_path("codex");
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
        let binary_path = find_binary_in_path("codex")
            .ok_or_else(|| anyhow!("Codex CLI ('codex') is not installed or not found in PATH"))?;

        let mut cmd = TokioCommand::new(binary_path);
        let combined_prompt = format!(
            "{}\n\n# User Request\n{}",
            context.to_prompt_context(),
            prompt
        );

        // Execute non-interactively via `codex exec`
        cmd.arg("exec").arg(&combined_prompt);

        Ok(cmd)
    }

    fn capabilities(&self) -> Vec<String> {
        vec![
            "SQL Generation".into(),
            "Query Optimization".into(),
            "Migration Scripting".into(),
            "Schema Analysis".into(),
        ]
    }
}
