import type { ConnectionConfig, DatabaseTable } from "@/types";
import type { TabType } from "@/components/TabBar";
import { useSettingsStore } from "@/stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";

export interface ContextBundle {
  connectionId?: string;
  dbType?: string;
  activeTable?: string;
  activeQuery?: string;
  explainPlan?: string;
  selectedEntity?: string;
  customInstructions?: string;
  summaryDescription: string;
}

export type AiIntent =
  | "explain_schema"
  | "explain_table"
  | "generate_sql"
  | "explain_sql"
  | "optimize_query"
  | "explain_relations"
  | "generate_migration"
  | "inspect_entity"
  | "general";

export interface BuildContextParams {
  connection: ConnectionConfig | null;
  activeTab?: TabType | null;
  selectedEntity?: string;
  intent?: AiIntent;
  customQuery?: string;
}

/**
 * Builds a selective, intent-aware database context bundle
 * honoring the user's AI settings without blindly dumping the entire database.
 */
export async function buildSelectiveAiContext({
  connection,
  activeTab,
  selectedEntity,
  intent = "general",
  customQuery,
}: BuildContextParams): Promise<ContextBundle> {
  const settings = useSettingsStore.getState();

  if (!connection) {
    return {
      summaryDescription: "No active database connection",
    };
  }

  const bundle: ContextBundle = {
    connectionId: connection.id,
    dbType: connection.db_type,
    summaryDescription: `${connection.name} (${connection.db_type})`,
  };

  const summaries: string[] = [`Database: ${connection.name} (${connection.db_type})`];

  // 1. Table Context
  if (settings.aiIncludeSelectedTable) {
    if (activeTab?.type === "table" && activeTab.table?.name) {
      bundle.activeTable = activeTab.table.name;
      summaries.push(`Table: ${activeTab.table.name}`);
    }
  }

  // 2. Query Context
  if (settings.aiAutoIncludeQuery) {
    const queryText = customQuery ?? (activeTab?.type === "query" ? activeTab.queryContent : undefined);
    if (queryText && queryText.trim().length > 0) {
      bundle.activeQuery = queryText.trim();
      summaries.push(`SQL: ${queryText.trim().substring(0, 40)}...`);
    }
  }

  // 3. Entity / Relationship Context
  if (settings.aiIncludeRelationships) {
    if (selectedEntity) {
      bundle.selectedEntity = selectedEntity;
      summaries.push(`Entity: ${selectedEntity}`);
    } else if (activeTab?.type === "relation-flow" && activeTab.relationFlowValue) {
      bundle.selectedEntity = activeTab.relationFlowValue;
      summaries.push(`Flow Entity: ${activeTab.relationFlowValue}`);
    }
  }

  // 4. Intent-specific enrichments
  if (intent === "optimize_query" && settings.aiIncludeExplain && bundle.activeQuery) {
    try {
      const plan = await invoke<{ query: string; plan_steps: unknown[]; total_cost?: number; recommendations?: string[] }>(
        "explain_query",
        {
          connectionId: connection.id,
          query: bundle.activeQuery,
          analyze: false,
          dbType: connection.db_type,
        }
      );
      if (plan && plan.plan_steps) {
        bundle.explainPlan = JSON.stringify(plan, null, 2);
        summaries.push("EXPLAIN Plan: Included");
      }
    } catch {
      // Explain might fail for non-SELECT or invalid SQL; gracefully continue
    }
  }

  bundle.summaryDescription = summaries.join(" • ");
  return bundle;
}

/**
 * Detects the most likely intent from the user's prompt
 */
export function detectPromptIntent(prompt: string): AiIntent {
  const p = prompt.toLowerCase();
  if (p.includes("optimize") || p.includes("slow") || p.includes("index") || p.includes("performance") || p.includes("explain plan")) {
    return "optimize_query";
  }
  if (p.includes("explain schema") || p.includes("schema structure") || p.includes("all tables")) {
    return "explain_schema";
  }
  if (p.includes("explain table") || p.includes("columns of") || p.includes("table structure")) {
    return "explain_table";
  }
  if (p.includes("relationship") || p.includes("connected to") || p.includes("foreign key") || p.includes("trace")) {
    return "explain_relations";
  }
  if (p.includes("migration") || p.includes("alter table") || p.includes("create table") || p.includes("add column")) {
    return "generate_migration";
  }
  if (p.includes("write a query") || p.includes("generate sql") || p.includes("select ") || p.includes("find ")) {
    return "generate_sql";
  }
  if (p.includes("explain this sql") || p.includes("explain query") || p.includes("what does this query do")) {
    return "explain_sql";
  }
  return "general";
}
