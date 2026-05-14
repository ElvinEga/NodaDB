import { TableColumn } from "@/types";

export function isNullValue(value: unknown): boolean {
  return value === null || value === undefined;
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
