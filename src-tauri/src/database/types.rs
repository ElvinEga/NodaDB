use crate::models::{ColumnTypeFamily, TableConstraint};

pub fn normalize_type_name(type_name: &str) -> String {
    type_name.trim().to_uppercase()
}

pub fn classify_sqlite_type(declared_type: &str) -> ColumnTypeFamily {
    let t = declared_type.trim().to_lowercase();

    if t == "bool" || t == "boolean" || t.contains("boolean") {
        return ColumnTypeFamily::Boolean;
    }
    if t == "json" || t == "jsonb" || t.contains("json") {
        return ColumnTypeFamily::Json;
    }
    if t.contains("int") {
        return ColumnTypeFamily::Integer;
    }
    if t.contains("real") || t.contains("float") || t.contains("double") {
        return ColumnTypeFamily::Float;
    }
    if t.contains("numeric") || t.contains("decimal") {
        return ColumnTypeFamily::Decimal;
    }
    if t.contains("char") || t.contains("text") || t.contains("clob") || t.contains("varchar") {
        return ColumnTypeFamily::Text;
    }
    if t.contains("blob") {
        return ColumnTypeFamily::Binary;
    }
    if t.contains("datetime") || t.contains("timestamp") {
        return ColumnTypeFamily::DateTime;
    }
    if t == "date" {
        return ColumnTypeFamily::Date;
    }
    if t == "time" {
        return ColumnTypeFamily::Time;
    }

    ColumnTypeFamily::Unknown
}

pub fn classify_postgres_type(
    formatted: &str,
    raw: &str,
    type_kind: &str,
    is_array: bool,
) -> ColumnTypeFamily {
    let f = formatted.to_lowercase();
    let r = raw.to_lowercase();

    if is_array || f.ends_with("[]") || r.starts_with('_') {
        return ColumnTypeFamily::Array;
    }

    if type_kind == "e" {
        return ColumnTypeFamily::Enum;
    }
    if type_kind == "d" {
        return ColumnTypeFamily::Domain;
    }

    match r.as_str() {
        "bool" => ColumnTypeFamily::Boolean,
        "int2" | "int4" | "int8" | "serial" | "bigserial" | "smallserial" => {
            ColumnTypeFamily::Integer
        }
        "float4" | "float8" => ColumnTypeFamily::Float,
        "numeric" | "decimal" | "money" => ColumnTypeFamily::Decimal,
        "text" | "varchar" | "bpchar" | "char" => ColumnTypeFamily::Text,
        "date" => ColumnTypeFamily::Date,
        "time" | "timetz" => ColumnTypeFamily::Time,
        "timestamp" | "timestamptz" | "interval" => ColumnTypeFamily::DateTime,
        "json" | "jsonb" => ColumnTypeFamily::Json,
        "uuid" => ColumnTypeFamily::Uuid,
        "bytea" => ColumnTypeFamily::Binary,
        "inet" | "cidr" | "macaddr" | "macaddr8" => ColumnTypeFamily::Network,
        "int4range" | "int8range" | "numrange" | "daterange" | "tsrange" | "tstzrange"
        | "int4multirange" | "int8multirange" | "nummultirange" | "datemultirange"
        | "tsmultirange" | "tstzmultirange" => ColumnTypeFamily::Range,
        "tsvector" | "tsquery" => ColumnTypeFamily::FullText,
        "hstore" | "ltree" | "vector" | "geometry" | "geography" => ColumnTypeFamily::Extension,
        "citext" => ColumnTypeFamily::Text,
        _ => ColumnTypeFamily::Unknown,
    }
}

pub fn classify_mysql_type(data_type: &str) -> ColumnTypeFamily {
    let t = data_type.trim().to_lowercase();

    match t.as_str() {
        "bool" | "boolean" => ColumnTypeFamily::Boolean,
        "tinyint" | "smallint" | "mediumint" | "int" | "integer" | "bigint" => {
            ColumnTypeFamily::Integer
        }
        "float" | "double" | "real" => ColumnTypeFamily::Float,
        "decimal" | "numeric" => ColumnTypeFamily::Decimal,
        "char" | "varchar" | "text" | "tinytext" | "mediumtext" | "longtext" => {
            ColumnTypeFamily::Text
        }
        "date" => ColumnTypeFamily::Date,
        "time" => ColumnTypeFamily::Time,
        "datetime" | "timestamp" => ColumnTypeFamily::DateTime,
        "json" => ColumnTypeFamily::Json,
        "binary" | "varbinary" | "blob" | "tinyblob" | "mediumblob" | "longblob" => {
            ColumnTypeFamily::Binary
        }
        "enum" => ColumnTypeFamily::Enum,
        _ => ColumnTypeFamily::Unknown,
    }
}

pub fn extract_sqlite_json_columns_from_ddl(ddl: &str) -> std::collections::HashSet<String> {
    let mut columns = std::collections::HashSet::new();
    let lower = ddl.to_lowercase();
    let targets = ["json_valid", "json_type"];

    for target in targets {
        let mut start_idx = 0;
        while let Some(idx) = lower[start_idx..].find(target) {
            let actual_idx = start_idx + idx + target.len();
            start_idx = actual_idx;

            // Look for '('
            let rest = &ddl[actual_idx..];
            let mut chars = rest.char_indices();
            let mut paren_found = false;
            let mut after_paren_idx = 0;

            for (c_idx, ch) in chars.by_ref() {
                if ch.is_whitespace() {
                    continue;
                }
                if ch == '(' {
                    paren_found = true;
                    after_paren_idx = actual_idx + c_idx + 1;
                    break;
                }
                break;
            }

            if !paren_found || after_paren_idx >= ddl.len() {
                continue;
            }

            let after_paren = &ddl[after_paren_idx..];
            let mut col_chars = after_paren.char_indices();
            let mut quote_char = None;
            let mut col_start = 0;

            // Skip whitespace to get first char of identifier
            for (c_idx, ch) in col_chars.by_ref() {
                if ch.is_whitespace() {
                    continue;
                }
                if ch == '"' || ch == '\'' || ch == '`' {
                    quote_char = Some(ch);
                    col_start = c_idx + 1;
                    break;
                } else if ch == '[' {
                    quote_char = Some(']');
                    col_start = c_idx + 1;
                    break;
                } else {
                    col_start = c_idx;
                    break;
                }
            }

            let col_source = &after_paren[col_start..];
            let mut col_end = 0;
            if let Some(closer) = quote_char {
                if let Some(end_idx) = col_source.find(closer) {
                    col_end = end_idx;
                }
            } else {
                for (c_idx, ch) in col_source.char_indices() {
                    if ch == ')' || ch == ',' || ch.is_whitespace() || ch == '=' || ch == '<' || ch == '>' {
                        col_end = c_idx;
                        break;
                    }
                    col_end = c_idx + ch.len_utf8();
                }
            }

            if col_end > 0 {
                let col_name = col_source[..col_end].trim();
                if !col_name.is_empty() {
                    columns.insert(col_name.to_lowercase());
                }
            }
        }
    }

    columns
}

pub fn extract_sqlite_check_constraints(table_name: &str, ddl: &str) -> Vec<TableConstraint> {
    let mut constraints = Vec::new();
    let lower = ddl.to_lowercase();
    let mut search_idx = 0;
    let mut count = 1;

    while let Some(rel_idx) = lower[search_idx..].find("check") {
        let check_idx = search_idx + rel_idx;
        search_idx = check_idx + 5;

        // Ensure "check" is a standalone keyword
        if check_idx > 0 {
            if let Some(prev_char) = ddl[..check_idx].chars().last() {
                if prev_char.is_alphanumeric() || prev_char == '_' {
                    continue;
                }
            }
        }

        // Find '(' after "check"
        let rest = &ddl[check_idx + 5..];
        let mut chars = rest.char_indices();
        let mut paren_start_rel = None;

        for (c_idx, ch) in chars.by_ref() {
            if ch.is_whitespace() {
                continue;
            }
            if ch == '(' {
                paren_start_rel = Some(c_idx);
                break;
            }
            break;
        }

        let paren_start_rel = match paren_start_rel {
            Some(idx) => idx,
            None => continue,
        };

        let expr_start = check_idx + 5 + paren_start_rel + 1;
        let mut depth = 1;
        let mut expr_end = None;

        for (c_idx, ch) in ddl[expr_start..].char_indices() {
            if ch == '(' {
                depth += 1;
            } else if ch == ')' {
                depth -= 1;
                if depth == 0 {
                    expr_end = Some(expr_start + c_idx);
                    break;
                }
            }
        }

        let expr_end = match expr_end {
            Some(idx) => idx,
            None => continue,
        };

        let check_expr = ddl[expr_start..expr_end].trim().to_string();

        // Check if there was CONSTRAINT <name> before "check"
        let before_check = ddl[..check_idx].trim_end();
        let constraint_name = if let Some(last_nl) = before_check.rfind(['\n', ',']) {
            let line_prefix = before_check[last_nl + 1..].trim();
            if let Some(c_pos) = line_prefix.to_lowercase().find("constraint") {
                let name_part = line_prefix[c_pos + 10..].trim();
                let clean_name = name_part.trim_matches(|c| c == '"' || c == '`' || c == '[' || c == ']' || c == '\'');
                if !clean_name.is_empty() {
                    clean_name.to_string()
                } else {
                    format!("chk_{}_{}", table_name, count)
                }
            } else {
                format!("chk_{}_{}", table_name, count)
            }
        } else {
            format!("chk_{}_{}", table_name, count)
        };

        count += 1;
        search_idx = expr_end + 1;

        constraints.push(TableConstraint {
            constraint_name,
            constraint_type: "CHECK".to_string(),
            table_schema: None,
            table_name: table_name.to_string(),
            column_names: Vec::new(),
            foreign_table_schema: None,
            foreign_table_name: None,
            foreign_column_names: None,
            check_expression: Some(check_expr),
            is_deferrable: None,
            initially_deferred: None,
        });
    }

    constraints
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_sqlite_boolean_and_integer_separately() {
        assert_eq!(classify_sqlite_type("BOOLEAN"), ColumnTypeFamily::Boolean);
        assert_eq!(classify_sqlite_type("INTEGER"), ColumnTypeFamily::Integer);
    }

    #[test]
    fn classifies_sqlite_json_types() {
        assert_eq!(classify_sqlite_type("JSON"), ColumnTypeFamily::Json);
        assert_eq!(classify_sqlite_type("JSONB"), ColumnTypeFamily::Json);
        assert_eq!(classify_sqlite_type("json"), ColumnTypeFamily::Json);
    }

    #[test]
    fn extracts_sqlite_json_columns_from_ddl() {
        let ddl = r#"
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                profile TEXT CHECK(json_valid(profile)),
                "settings" TEXT CHECK ( json_valid ( "settings" ) = 1 ),
                `meta` TEXT CHECK(json_valid(`meta`)),
                [config] TEXT CHECK(json_valid([config])),
                details TEXT CHECK(json_type(details) IS NOT NULL),
                plain_text TEXT,
                CONSTRAINT chk_multi CHECK (json_valid(col_a) AND json_valid(col_b))
            )
        "#;
        let json_cols = extract_sqlite_json_columns_from_ddl(ddl);
        assert!(json_cols.contains("profile"));
        assert!(json_cols.contains("settings"));
        assert!(json_cols.contains("meta"));
        assert!(json_cols.contains("config"));
        assert!(json_cols.contains("details"));
        assert!(json_cols.contains("col_a"));
        assert!(json_cols.contains("col_b"));
        assert!(!json_cols.contains("plain_text"));
        assert!(!json_cols.contains("id"));
    }

    #[test]
    fn extracts_sqlite_check_constraints_from_ddl() {
        let ddl = r#"
            CREATE TABLE products (
                id INTEGER PRIMARY KEY,
                price REAL CHECK(price >= 0),
                meta TEXT CHECK (json_valid(meta)),
                CONSTRAINT chk_named CHECK (json_valid(config))
            )
        "#;
        let checks = extract_sqlite_check_constraints("products", ddl);
        assert_eq!(checks.len(), 3);
        assert_eq!(checks[0].check_expression.as_deref(), Some("price >= 0"));
        assert_eq!(checks[1].check_expression.as_deref(), Some("json_valid(meta)"));
        assert_eq!(checks[2].constraint_name, "chk_named");
        assert_eq!(checks[2].check_expression.as_deref(), Some("json_valid(config)"));
    }

    #[test]
    fn classifies_postgres_common_types() {
        assert_eq!(
            classify_postgres_type("boolean", "bool", "b", false),
            ColumnTypeFamily::Boolean
        );
        assert_eq!(
            classify_postgres_type("integer", "int4", "b", false),
            ColumnTypeFamily::Integer
        );
        assert_eq!(
            classify_postgres_type("jsonb", "jsonb", "b", false),
            ColumnTypeFamily::Json
        );
    }

    #[test]
    fn classifies_postgres_enum_and_array() {
        assert_eq!(
            classify_postgres_type("status", "status", "e", false),
            ColumnTypeFamily::Enum
        );
        assert_eq!(
            classify_postgres_type("integer[]", "_int4", "b", true),
            ColumnTypeFamily::Array
        );
    }

    #[tokio::test]
    async fn sqlite_json_check_constraint_detection() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query(
            r#"
            CREATE TABLE test_items (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                metadata TEXT CHECK(json_valid(metadata)),
                settings TEXT CHECK(json_valid("settings") = 1),
                config TEXT
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        let create_sql: Option<String> = sqlx::query_scalar(
            "SELECT sql FROM sqlite_master WHERE type IN ('table', 'view') AND name = 'test_items'"
        )
        .fetch_optional(&pool)
        .await
        .unwrap();

        let json_cols = extract_sqlite_json_columns_from_ddl(create_sql.as_deref().unwrap());
        assert!(json_cols.contains("metadata"));
        assert!(json_cols.contains("settings"));
        assert!(!json_cols.contains("name"));
        assert!(!json_cols.contains("config"));

        let checks = extract_sqlite_check_constraints("test_items", create_sql.as_deref().unwrap());
        assert_eq!(checks.len(), 2);
    }
}


