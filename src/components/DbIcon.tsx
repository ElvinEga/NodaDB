import mysqlIcon from "@/assets/icons/db/mysql-icon.svg";
import postgresIcon from "@/assets/icons/db/postgresql-icon.svg";
import sqliteIcon from "@/assets/icons/db/sqlite-icon.svg";
import supabaseIcon from "@/assets/icons/db/supabase-icon.svg";
import { Database } from "lucide-react";

export function getDbIconSrc(dbType?: string): string | null {
  if (!dbType) return null;
  const type = dbType.toLowerCase();
  if (type.includes("postgres") || type.includes("pg")) return postgresIcon;
  if (type.includes("mysql") || type.includes("maria")) return mysqlIcon;
  if (type.includes("sqlite")) return sqliteIcon;
  if (type.includes("supabase")) return supabaseIcon;
  return null;
}

export function DbIcon({
  dbType,
  className = "h-4 w-4 shrink-0",
}: {
  dbType?: string;
  className?: string;
}) {
  const iconSrc = getDbIconSrc(dbType);
  if (!iconSrc) {
    return <Database className={className} />;
  }
  return <img src={iconSrc} alt={dbType} className={className} />;
}
