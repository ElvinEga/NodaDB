import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export function getAiIconSrc(name?: string): string | null {
  if (!name) return null;
  const n = name.toLowerCase().trim();

  // Claude Code / Anthropic
  if (n.includes("claude") || n.includes("anthropic")) {
    return "/icons/ai/claude.svg";
  }

  // OpenAI Codex
  if (n.includes("codex")) {
    return "/icons/ai/codex.svg";
  }

  // OpenCode
  if (n.includes("opencode")) {
    return "/icons/ai/opencode.svg";
  }

  // Google Antigravity / AGY
  if (n.includes("antigravity") || n === "agy" || n.startsWith("agy-") || n.startsWith("omg-") || n.startsWith("oma-")) {
    return "/icons/ai/google-antigravity.svg";
  }

  // Google Gemini CLI / Gemini
  if (n.includes("gemini")) {
    return "/icons/ai/gemini-cli.svg";
  }

  // DeepSeek
  if (n.includes("deepseek")) {
    return "/icons/ai/deepseek.svg";
  }

  // xAI Grok
  if (n.includes("grok") || n.includes("xai")) {
    return "/icons/ai/grok.svg";
  }

  // OpenAI / ChatGPT / GPT-4o
  if (
    n.includes("openai") ||
    n.includes("gpt") ||
    n.includes("chatgpt") ||
    n.startsWith("o1") ||
    n.startsWith("o3")
  ) {
    return "/icons/ai/openai.svg";
  }

  return null;
}

export function AiIcon({
  name,
  className = "h-4 w-4 shrink-0",
  fallbackClassName,
}: {
  name?: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const iconSrc = getAiIconSrc(name);

  if (!iconSrc) {
    return <Bot className={cn(className, fallbackClassName)} />;
  }

  return (
    <img
      src={iconSrc}
      alt={name ?? "AI Agent"}
      className={cn("object-contain", className)}
      loading="lazy"
    />
  );
}
