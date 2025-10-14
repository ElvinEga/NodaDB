import { format } from 'sql-formatter';
import { DatabaseType } from '@/types';

/**
 * Format SQL query with proper indentation and capitalization
 */
export function formatSQL(sql: string, dbType: DatabaseType = 'sqlite'): string {
  if (!sql || !sql.trim()) {
    return sql;
  }

  try {
    // Map database types to sql-formatter language options
    const getLanguage = (db: DatabaseType): 'sqlite' | 'postgresql' | 'mysql' => {
      switch (db) {
        case 'sqlite': return 'sqlite';
        case 'postgresql': return 'postgresql';
        case 'mysql': return 'mysql';
        default: return 'sqlite';
      }
    };

    return format(sql, {
      language: getLanguage(dbType),
      tabWidth: 2,
      keywordCase: 'upper',
      indentStyle: 'standard',
      logicalOperatorNewline: 'before',
      expressionWidth: 80,
    });
  } catch (error) {
    console.error('Failed to format SQL:', error);
    // Return original SQL if formatting fails
    return sql;
  }
}

/**
 * Toggle line comment (add or remove --)
 */
export function toggleLineComment(line: string): string {
  const trimmed = line.trimStart();
  const indent = line.substring(0, line.length - trimmed.length);
  
  if (trimmed.startsWith('--')) {
    // Remove comment
    return indent + trimmed.substring(2).trimStart();
  } else {
    // Add comment
    return indent + '-- ' + trimmed;
  }
}

/**
 * Toggle comment for selected text or current line
 */
export function toggleComment(text: string): string {
  const lines = text.split('\n');
  
  // Check if all non-empty lines are commented
  const allCommented = lines
    .filter(line => line.trim().length > 0)
    .every(line => line.trimStart().startsWith('--'));
  
  if (allCommented) {
    // Uncomment all
    return lines.map(line => toggleLineComment(line)).join('\n');
  } else {
    // Comment all
    return lines.map(line => {
      if (line.trim().length === 0) return line;
      return toggleLineComment(line);
    }).join('\n');
  }
}

/**
 * Validate SQL syntax (basic checks)
 */
export function validateSQL(sql: string): { valid: boolean; error?: string } {
  if (!sql || !sql.trim()) {
    return { valid: false, error: 'Empty query' };
  }

  const trimmed = sql.trim().toUpperCase();
  
  // Check for balanced parentheses
  let parenCount = 0;
  for (const char of sql) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      return { valid: false, error: 'Unbalanced parentheses' };
    }
  }
  if (parenCount !== 0) {
    return { valid: false, error: 'Unbalanced parentheses' };
  }

  // Check for basic SQL keywords
  const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'PRAGMA', 'EXPLAIN'];
  const hasKeyword = sqlKeywords.some(keyword => trimmed.startsWith(keyword));
  
  if (!hasKeyword) {
    return { valid: false, error: 'Query must start with a SQL keyword' };
  }

  return { valid: true };
}

/**
 * Extract table names from SQL query (simple regex-based)
 */
export function extractTableNames(sql: string): string[] {
  const tables = new Set<string>();
  
  // Match FROM and JOIN clauses
  const fromPattern = /\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  const joinPattern = /\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  
  let match;
  
  while ((match = fromPattern.exec(sql)) !== null) {
    tables.add(match[1]);
  }
  
  while ((match = joinPattern.exec(sql)) !== null) {
    tables.add(match[1]);
  }
  
  return Array.from(tables);
}

/**
 * Split SQL into individual statements
 */
export function splitStatements(sql: string): string[] {
  // Split by semicolon, but be careful with strings
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const prevChar = i > 0 ? sql[i - 1] : '';
    
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    if (char === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last statement if any
  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }
  
  return statements;
}
