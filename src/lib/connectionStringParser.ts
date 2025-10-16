/**
 * Parse a PostgreSQL connection string into connection parameters
 * Supports formats like:
 * - postgres://user:password@host:port/database
 * - postgresql://user:password@host:port/database?sslmode=require
 */
export interface ParsedConnectionString {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  sslmode?: string;
}

export function parsePostgresConnectionString(
  connectionString: string
): ParsedConnectionString {
  try {
    // Remove leading/trailing whitespace
    connectionString = connectionString.trim();

    // Match PostgreSQL connection string format
    // postgres[ql]://[username[:password]@][host][:port]/[database][?param1=value1&param2=value2]
    const match = connectionString.match(
      /^(?:postgres(?:ql)?):\/\/(?:([^:@]+)(?::([^@]+))?@)?([^:\/]+)(?::(\d+))?\/([^?]+)(?:\?(.+))?$/
    );

    if (!match) {
      throw new Error("Invalid PostgreSQL connection string format");
    }

    const [, username, password, host, port, database, queryString] = match;

    // Parse query parameters
    const params: Record<string, string> = {};
    if (queryString) {
      queryString.split("&").forEach((param) => {
        const [key, value] = param.split("=");
        if (key && value) {
          params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
    }

    if (!username) {
      throw new Error("Username is required in connection string");
    }

    if (!password) {
      throw new Error("Password is required in connection string");
    }

    if (!host) {
      throw new Error("Host is required in connection string");
    }

    if (!database) {
      throw new Error("Database name is required in connection string");
    }

    return {
      host: decodeURIComponent(host),
      port: port || "5432",
      username: decodeURIComponent(username),
      password: decodeURIComponent(password),
      database: decodeURIComponent(database),
      sslmode: params.sslmode,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse connection string: ${error.message}`);
    }
    throw new Error("Failed to parse connection string: Unknown error");
  }
}

/**
 * Build a PostgreSQL connection string from connection parameters
 */
export function buildPostgresConnectionString(params: {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  sslmode?: string;
}): string {
  const { host, port, username, password, database, sslmode } = params;

  let connectionString = `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;

  if (sslmode) {
    connectionString += `?sslmode=${sslmode}`;
  }

  return connectionString;
}
