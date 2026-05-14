use crate::models::ColumnTypeFamily;

pub fn normalize_type_name(type_name: &str) -> String {
    type_name.trim().to_uppercase()
}

pub fn classify_sqlite_type(declared_type: &str) -> ColumnTypeFamily {
    let t = declared_type.trim().to_lowercase();

    if t == "bool" || t == "boolean" || t.contains("boolean") {
        return ColumnTypeFamily::Boolean;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_sqlite_boolean_and_integer_separately() {
        assert_eq!(classify_sqlite_type("BOOLEAN"), ColumnTypeFamily::Boolean);
        assert_eq!(classify_sqlite_type("INTEGER"), ColumnTypeFamily::Integer);
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
}
