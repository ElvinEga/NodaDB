//! NodaDB CLI (`noda`) — Control Center for AI Coding Agents and Database Operations.
//!
//! Examples:
//!   noda agent list
//!   noda agent run codex "Investigate why orders query is slow"
//!   noda agent run claude "Design a migration for user audit logs"
//!   noda agent run gemini "Explain the database architecture"
//!   noda /schema users
//!   noda /explain "SELECT * FROM orders WHERE status = 'pending'"

use anyhow::{anyhow, Result};
use std::env;
use std::process::Command;

fn print_banner() {
    println!("\x1b[1;36m╔══════════════════════════════════════════════════════╗\x1b[0m");
    println!("\x1b[1;36m║\x1b[0m   \x1b[1;37mNodaDB — Database Control Plane for AI Agents\x1b[0m      \x1b[1;36m║\x1b[0m");
    println!("\x1b[1;36m╚══════════════════════════════════════════════════════╝\x1b[0m\n");
}

fn print_help() {
    print_banner();
    println!("\x1b[1mUSAGE:\x1b[0m");
    println!("  noda <command> [arguments...]\n");
    println!("\x1b[1mAI AGENT COMMANDS:\x1b[0m");
    println!("  noda agent list                         List installed agent CLIs & versions");
    println!("  noda agent run <agent> \"<prompt>\"       Execute agent with database context");
    println!("                                          Agents: codex, claude, opencode, gemini\n");
    println!("\x1b[1mDATABASE COMMANDS:\x1b[0m (Requires DATABASE_URL environment variable)");
    println!("  noda /explore                           List all tables in the active database");
    println!("  noda /schema [table]                    Inspect columns and types for a table");
    println!("  noda /explain \"<sql>\"                   Explain SQL query execution plan");
    println!("  noda /query \"<sql>\"                     Execute a SQL query");
    println!("  noda /status                            Show database connection status\n");
}

fn detect_agent_cli(_name: &str, which_name: &str) -> (bool, Option<String>, Option<String>) {
    let which = Command::new("which").arg(which_name).output();
    if let Ok(w) = which {
        if w.status.success() {
            let path = String::from_utf8_lossy(&w.stdout).trim().to_string();
            let mut version = None;
            if let Ok(ver_out) = Command::new(&path).arg("--version").output() {
                if ver_out.status.success() {
                    version = Some(String::from_utf8_lossy(&ver_out.stdout).trim().to_string());
                }
            }
            return (true, version, Some(path));
        }
    }

    // Try common homebrew / local paths
    let home = env::var("HOME").unwrap_or_default();
    let candidates = [
        format!("{}/.local/bin/{}", home, which_name),
        format!("{}/.bun/bin/{}", home, which_name),
        format!("{}/.cargo/bin/{}", home, which_name),
        format!("/opt/homebrew/bin/{}", which_name),
        format!("/usr/local/bin/{}", which_name),
    ];

    for c in candidates {
        if std::path::Path::new(&c).exists() {
            let mut version = None;
            if let Ok(ver_out) = Command::new(&c).arg("--version").output() {
                if ver_out.status.success() {
                    version = Some(String::from_utf8_lossy(&ver_out.stdout).trim().to_string());
                }
            }
            return (true, version, Some(c));
        }
    }

    (false, None, None)
}

fn handle_agent_list() {
    print_banner();
    println!("\x1b[1mDETECTED AI CODING AGENTS:\x1b[0m\n");

    let agents = [
        ("codex", "Codex CLI", "OpenAI Codex coding agent", "codex"),
        ("claude", "Claude Code", "Anthropic Claude Code CLI", "claude"),
        ("opencode", "OpenCode", "OpenCode multi-provider AI", "opencode"),
        ("gemini", "Gemini CLI / AGY", "Google Gemini CLI agent", "gemini"),
    ];

    for (id, name, desc, bin) in agents {
        let (installed, version, path) = detect_agent_cli(name, bin);
        if installed {
            let ver_str = version.unwrap_or_else(|| "unknown".into());
            println!("  \x1b[1;32m●\x1b[0m \x1b[1m{}\x1b[0m (\x1b[36m{}\x1b[0m)", name, id);
            println!("    Status:   \x1b[32mInstalled\x1b[0m (v{})", ver_str);
            if let Some(p) = path {
                println!("    Path:     {}", p);
            }
            println!("    About:    {}\n", desc);
        } else {
            println!("  \x1b[1;31m○\x1b[0m \x1b[1m{}\x1b[0m (\x1b[36m{}\x1b[0m)", name, id);
            println!("    Status:   \x1b[31mNot Found\x1b[0m in PATH");
            println!("    About:    {}\n", desc);
        }
    }

    println!("\x1b[90mRun an agent: noda agent run <agent_id> \"<prompt>\"\x1b[0m");
}

fn handle_agent_run(agent_id: &str, prompt: &str) -> Result<()> {
    let (installed, _, path) = match agent_id {
        "codex" => detect_agent_cli("Codex CLI", "codex"),
        "claude" => detect_agent_cli("Claude Code", "claude"),
        "opencode" => detect_agent_cli("OpenCode", "opencode"),
        "gemini" | "agy" => {
            let g = detect_agent_cli("Gemini CLI", "gemini");
            if g.0 { g } else { detect_agent_cli("AGY", "agy") }
        }
        _ => return Err(anyhow!("Unknown agent '{}'. Available: codex, claude, opencode, gemini", agent_id)),
    };

    if !installed {
        return Err(anyhow!(
            "Agent '{}' is not installed. Run 'noda agent list' to check available agents.",
            agent_id
        ));
    }

    let bin_path = path.unwrap_or_else(|| agent_id.to_string());

    println!("\x1b[1;36m▶ Running {} with prompt:\x1b[0m {}", agent_id, prompt);
    println!("\x1b[90m──────────────────────────────────────────────────────\x1b[0m\n");

    let mut cmd = Command::new(&bin_path);

    // Build agent-specific arguments
    match agent_id {
        "codex" => {
            cmd.arg("exec").arg(prompt);
        }
        "claude" => {
            cmd.arg("-p").arg(prompt);
        }
        "opencode" => {
            cmd.arg("run").arg(prompt);
        }
        "gemini" | "agy" => {
            cmd.arg("-p").arg(prompt);
        }
        _ => {
            cmd.arg(prompt);
        }
    }

    // Forward stdin/stdout/stderr directly to terminal
    let status = cmd
        .stdin(std::process::Stdio::inherit())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit())
        .status()?;

    println!("\n\x1b[90m──────────────────────────────────────────────────────\x1b[0m");
    if status.success() {
        println!("\x1b[1;32m✔ Completed successfully.\x1b[0m");
    } else {
        println!("\x1b[1;31m✘ Exited with code: {}\x1b[0m", status.code().unwrap_or(-1));
    }

    Ok(())
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        print_help();
        return Ok(());
    }

    match args[1].as_str() {
        "agent" | "agents" => {
            if args.len() == 2 || args[2] == "list" || args[2] == "ls" {
                handle_agent_list();
            } else if (args[2] == "run" || args[2] == "exec") && args.len() >= 5 {
                let agent_id = &args[3];
                let prompt = args[4..].join(" ");
                handle_agent_run(agent_id, &prompt)?;
            } else if args.len() >= 4 {
                let agent_id = &args[2];
                let prompt = args[3..].join(" ");
                handle_agent_run(agent_id, &prompt)?;
            } else {
                println!("Usage: noda agent run <agent_id> \"<prompt>\"");
            }
        }
        "/schema" | "schema" => {
            let table = args.get(2).map(|s| s.as_str()).unwrap_or("");
            println!("Schema inspection for: {}", if table.is_empty() { "all tables" } else { table });
            println!("\x1b[90m(To query live database, ensure DATABASE_URL is set or use NodaDB desktop)\x1b[0m");
        }
        "/explain" | "explain" => {
            let sql = args.get(2..).map(|parts| parts.join(" ")).unwrap_or_default();
            if sql.is_empty() {
                println!("Usage: noda /explain \"<sql_query>\"");
            } else {
                println!("Explaining query: {}", sql);
            }
        }
        "/status" | "status" => {
            print_banner();
            println!("NodaDB CLI Version: 0.3.10");
            if let Ok(db) = env::var("DATABASE_URL") {
                let sanitized = db.split('@').last().unwrap_or(&db);
                println!("Connected Database: {}", sanitized);
            } else {
                println!("Database: (none set — configure DATABASE_URL or launch NodaDB desktop)");
            }
        }
        "help" | "--help" | "-h" => {
            print_help();
        }
        unknown => {
            println!("Unknown command: '{}'. Run 'noda help' for usage.", unknown);
        }
    }

    Ok(())
}
