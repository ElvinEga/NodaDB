import { ColumnTypeFamily, DatabaseType, TableColumn } from "@/types";
import { ColumnDisplayOverride } from "@/stores/columnDisplayStore";

export function isNullValue(value: unknown): boolean {
  return value === null || value === undefined;
}

export function resolveEffectiveTypeFamily(
  column: TableColumn,
  override?: ColumnDisplayOverride | null,
): ColumnTypeFamily {
  return override?.typeFamily ?? column.type_family;
}

export function withEffectiveTypeFamily(
  column: TableColumn,
  override?: ColumnDisplayOverride | null,
): TableColumn {
  const effectiveTypeFamily = resolveEffectiveTypeFamily(column, override);

  return {
    ...column,
    type_family: effectiveTypeFamily,
    is_boolean_like: effectiveTypeFamily === "boolean",
  };
}

export function getTypeFamilyLabel(typeFamily: ColumnTypeFamily): string {
  switch (typeFamily) {
    case "boolean":
      return "BOOLEAN";
    case "integer":
      return "INTEGER";
    case "float":
      return "FLOAT";
    case "decimal":
      return "DECIMAL";
    case "text":
      return "TEXT";
    case "date_time":
      return "DATETIME";
    case "date":
      return "DATE";
    case "time":
      return "TIME";
    case "json":
      return "JSON";
    case "uuid":
      return "UUID";
    case "binary":
      return "BINARY";
    case "enum":
      return "ENUM";
    case "array":
      return "ARRAY";
    case "network":
      return "NETWORK";
    case "range":
      return "RANGE";
    case "full_text":
      return "FULL TEXT";
    case "extension":
      return "EXTENSION";
    case "domain":
      return "DOMAIN";
    case "custom":
      return "CUSTOM";
    default:
      return "UNKNOWN";
  }
}

export function getTypeBadgeColor(typeFamily: ColumnTypeFamily): string {
  switch (typeFamily) {
    case "boolean":
      return "text-purple-400 bg-purple-500/10";
    case "integer":
      return "text-blue-400 bg-blue-500/10";
    case "text":
      return "text-green-400 bg-green-500/10";
    case "date":
    case "date_time":
    case "time":
      return "text-yellow-400 bg-yellow-500/10";
    case "float":
    case "decimal":
      return "text-orange-400 bg-orange-500/10";
    case "json":
    case "array":
      return "text-cyan-400 bg-cyan-500/10";
    case "uuid":
    case "network":
      return "text-pink-400 bg-pink-500/10";
    case "binary":
      return "text-slate-300 bg-slate-500/10";
    default:
      return "text-gray-400 bg-gray-500/10";
  }
}

export function isInvalidBooleanValue(column: TableColumn, value: unknown): boolean {
  if (column.type_family !== "boolean" || isNullValue(value)) {
    return false;
  }

  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : value;

  return !(
    value === true ||
    value === false ||
    value === 1 ||
    value === 0 ||
    normalized === "1" ||
    normalized === "0" ||
    normalized === "true" ||
    normalized === "false" ||
    normalized === "t" ||
    normalized === "f"
  );
}

export function resolveColumnInputType(column: TableColumn): string {
  switch (column.type_family) {
    case "integer":
    case "float":
    case "decimal":
      return "number";
    case "date":
      return "date";
    case "date_time":
      return "datetime-local";
    case "time":
      return "time";
    default:
      return "text";
  }
}

export function parseInputValue(column: TableColumn, rawValue: unknown): unknown {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return null;
  }

  switch (column.type_family) {
    case "boolean": {
      const normalized =
        typeof rawValue === "string" ? rawValue.trim().toLowerCase() : rawValue;
      return (
        rawValue === true ||
        normalized === "true" ||
        normalized === "1" ||
        normalized === "on" ||
        normalized === "t" ||
        normalized === "yes"
      );
    }
    case "integer": {
      const parsed = Number.parseInt(String(rawValue), 10);
      if (Number.isNaN(parsed)) {
        throw new Error(`${column.name} must be a valid integer`);
      }
      return parsed;
    }
    case "float":
    case "decimal": {
      const parsed = Number.parseFloat(String(rawValue));
      if (Number.isNaN(parsed)) {
        throw new Error(`${column.name} must be a valid number`);
      }
      return parsed;
    }
    case "json":
      try {
        return JSON.parse(String(rawValue));
      } catch {
        throw new Error(`${column.name} must be valid JSON`);
      }
    case "array":
      try {
        return JSON.parse(String(rawValue));
      } catch {
        return rawValue;
      }
    default:
      return rawValue;
  }
}

export function coerceValueForDatabase(
  column: TableColumn,
  value: unknown,
  dbType: DatabaseType,
): unknown {
  if (column.type_family === "boolean" && !isNullValue(value)) {
    const normalized = parseInputValue(column, value);
    if (dbType === "sqlite") {
      return normalized ? 1 : 0;
    }
    return normalized;
  }

  return value;
}

export function formatCellValue(column: TableColumn, value: unknown): string {
  if (isNullValue(value)) {
    return "NULL";
  }

  if (column.type_family === "json" || column.type_family === "array") {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  if (column.type_family === "boolean") {
    if (isInvalidBooleanValue(column, value)) {
      return String(value);
    }
    const parsed = parseInputValue(column, value);
    return parsed ? "true" : "false";
  }

  return String(value);
}
