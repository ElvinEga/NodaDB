import mysqlIcon from "@/assets/icons/db/mysql-icon.svg";
import postgresIcon from "@/assets/icons/db/postgresql-icon.svg";
import sqliteIcon from "@/assets/icons/db/sqlite-icon.svg";
import supabaseIcon from "@/assets/icons/db/supabase-icon.svg";
import neonIcon from "@/assets/icons/db/neon-icon.svg";
import mariadbIcon from "@/assets/icons/db/mariadb-icon.svg";
import mongodbIcon from "@/assets/icons/db/mongodb-icon.svg";
import clickhouseIcon from "@/assets/icons/db/clickhouse-icon.svg";
import planetscaleIcon from "@/assets/icons/db/planetscale-icon.svg";
import prismaIcon from "@/assets/icons/db/prisma-icon.svg";
import tursoIcon from "@/assets/icons/db/turso-icon.svg";
import vtIcon from "@/assets/icons/db/vt-icon.svg";
import redisIcon from "@/assets/icons/db/redis-icon.svg";
import cloudflareIcon from "@/assets/icons/db/cloudflare-icon.svg";
import { Database } from "lucide-react";

export function getDbIconSrc(dbType?: string): string | null {
  if (!dbType) return null;
  const type = dbType.toLowerCase();
  if (type.includes("cloudflare") || type === "d1") return cloudflareIcon;
  if (type.includes("redis")) return redisIcon;
  if (type.includes("prisma")) return prismaIcon;
  if (type.includes("valtown") || type === "vt") return vtIcon;
  if (type.includes("turso") || type.includes("libsql")) return tursoIcon;
  if (type.includes("clickhouse")) return clickhouseIcon;
  if (type.includes("planetscale")) return planetscaleIcon;
  if (type.includes("postgres") || type.includes("pg")) return postgresIcon;
  if (type.includes("mysql")) return mysqlIcon;
  if (type.includes("mariadb") || type.includes("maria")) return mariadbIcon;
  if (type.includes("mongodb") || type.includes("mongo")) return mongodbIcon;
  if (type.includes("sqlite")) return sqliteIcon;
  if (type.includes("supabase")) return supabaseIcon;
  if (type.includes("neon")) return neonIcon;
  return null;
}

export function DbIcon({
  dbType,
  provider,
  className = "h-4 w-4 shrink-0",
}: {
  dbType?: string;
  provider?: string;
  className?: string;
}) {
  // Provider overrides db_type icon (e.g. Supabase/Neon are postgresql underneath)
  const iconSrc = provider ? getDbIconSrc(provider) : getDbIconSrc(dbType);
  if (!iconSrc) {
    return <Database className={className} />;
  }
  return <img src={iconSrc} alt={provider ?? dbType} className={className} />;
}
