import { Check, X } from "lucide-react";
import { ReactNode } from "react";

/**
 * Format a date value with relative or absolute display
 */
export function formatDate(value: any): string {
  if (!value) return "";

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Show relative time for recent dates
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 0 ? "Just now" : `${diffMinutes}m ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    // Show absolute date for older dates
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(value);
  }
}

/**
 * Format a number with appropriate formatting
 */
export function formatNumber(value: any, dataType: string): string {
  if (value === null || value === undefined) return "";

  const num = parseFloat(value);
  if (isNaN(num)) return String(value);

  const type = dataType.toUpperCase();

  // Integer types - no decimals
  if (type.includes("INT") || type.includes("SERIAL")) {
    return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  // Float/decimal types - show up to 2 decimals
  if (
    type.includes("FLOAT") ||
    type.includes("REAL") ||
    type.includes("DOUBLE") ||
    type.includes("NUMERIC")
  ) {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  return String(value);
}

/**
 * Render a boolean value as a visual indicator
 */
export function BooleanCell({ value }: { value: any }) {
  const isTrue =
    value === true || value === 1 || value === "true" || value === "t";
  const isFalse =
    value === false || value === 0 || value === "false" || value === "f";

  if (!isTrue && !isFalse) {
    return <span className="text-muted-foreground italic">NULL</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {isTrue ? (
        <>
          <Check className="h-3.5 w-3.5 text-success" />
          <span className="text-xs text-success">True</span>
        </>
      ) : (
        <>
          <X className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">False</span>
        </>
      )}
    </div>
  );
}

/**
 * Render JSON data with pretty formatting
 */
export function JsonCell({ value }: { value: any }) {
  if (!value) return <span className="text-muted-foreground italic">NULL</span>;

  try {
    let jsonObj = value;
    if (typeof value === "string") {
      jsonObj = JSON.parse(value);
    }

    const jsonStr = JSON.stringify(jsonObj, null, 2);
    const preview =
      jsonStr.length > 50 ? jsonStr.substring(0, 50) + "..." : jsonStr;

    return (
      <div className="font-mono text-xs">
        <details className="cursor-pointer">
          <summary className="text-muted-foreground hover:text-foreground">
            {preview.split("\n")[0]}
          </summary>
          <pre className="mt-2 p-2 bg-secondary rounded text-[10px] overflow-auto max-h-48">
            {jsonStr}
          </pre>
        </details>
      </div>
    );
  } catch {
    return <span className="font-mono text-xs">{String(value)}</span>;
  }
}

/**
 * Render a date cell with formatted display
 */
export function DateCell({ value }: { value: any }) {
  if (!value) return <span className="text-muted-foreground italic">NULL</span>;

  const formatted = formatDate(value);
  const fullDate = new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="group relative">
      <span className="text-xs text-muted-foreground">{formatted}</span>
      <div className="absolute hidden group-hover:block left-0 top-full mt-1 px-2 py-1 bg-popover border border-border rounded shadow-lg text-xs whitespace-nowrap z-50">
        {fullDate}
      </div>
    </div>
  );
}

/**
 * Render a number cell with formatted display
 */
export function NumberCell({
  value,
  dataType,
}: {
  value: any;
  dataType: string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">NULL</span>;
  }

  const formatted = formatNumber(value, dataType);

  return (
    <span className="font-mono text-xs tabular-nums text-right block">
      {formatted}
    </span>
  );
}

/**
 * Render a text cell with truncation and tooltip
 */
export function TextCell({
  value,
  maxLength = 50,
}: {
  value: any;
  maxLength?: number;
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">NULL</span>;
  }

  const text = String(value);
  const isTruncated = text.length > maxLength;
  const display = isTruncated ? text.substring(0, maxLength) + "..." : text;

  if (!isTruncated) {
    return <span className="text-xs font-normal">{text}</span>;
  }

  return (
    <div className="group relative">
      <span className="text-xs font-normal">{display}</span>
      <div className="absolute hidden group-hover:block left-0 top-full mt-1 px-2 py-1 bg-popover border border-border rounded shadow-lg text-xs max-w-sm z-50">
        {text}
      </div>
    </div>
  );
}

/**
 * Get appropriate cell renderer based on data type
 */
export function getCellRenderer(dataType: string, value: any): ReactNode {
  const type = dataType.toUpperCase();

  // Boolean types
  if (type.includes("BOOL") || type === "BIT") {
    return <BooleanCell value={value} />;
  }

  // Date/Time types
  if (type.includes("DATE") || type.includes("TIME")) {
    return <DateCell value={value} />;
  }

  // Number types
  if (
    type.includes("INT") ||
    type.includes("SERIAL") ||
    type.includes("FLOAT") ||
    type.includes("REAL") ||
    type.includes("DOUBLE") ||
    type.includes("NUMERIC") ||
    type.includes("DECIMAL")
  ) {
    return <NumberCell value={value} dataType={dataType} />;
  }

  // JSON types
  if (type.includes("JSON")) {
    return <JsonCell value={value} />;
  }

  // Default text rendering
  return <TextCell value={value} />;
}
