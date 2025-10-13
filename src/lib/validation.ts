/**
 * Data validation utilities for table cell editing
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  transformedValue?: any;
}

/**
 * Validate a value based on SQL data type
 */
export function validateCellValue(value: string, dataType: string): ValidationResult {
  const type = dataType.toUpperCase();

  // Empty string handling
  if (value.trim() === '') {
    return { valid: true, transformedValue: null };
  }

  // Integer types
  if (type.includes('INT') || type.includes('SERIAL')) {
    const num = parseInt(value);
    if (isNaN(num)) {
      return { valid: false, error: 'Must be a valid integer' };
    }
    if (type.includes('SMALLINT') && (num < -32768 || num > 32767)) {
      return { valid: false, error: 'Must be between -32,768 and 32,767' };
    }
    if (type.includes('TINYINT') && (num < 0 || num > 255)) {
      return { valid: false, error: 'Must be between 0 and 255' };
    }
    return { valid: true, transformedValue: num };
  }

  // Float/Decimal types
  if (
    type.includes('FLOAT') ||
    type.includes('REAL') ||
    type.includes('DOUBLE') ||
    type.includes('NUMERIC') ||
    type.includes('DECIMAL')
  ) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return { valid: false, error: 'Must be a valid number' };
    }
    return { valid: true, transformedValue: num };
  }

  // Boolean types
  if (type.includes('BOOL') || type === 'BIT') {
    const lower = value.toLowerCase();
    if (['true', '1', 't', 'yes', 'y'].includes(lower)) {
      return { valid: true, transformedValue: true };
    }
    if (['false', '0', 'f', 'no', 'n'].includes(lower)) {
      return { valid: true, transformedValue: false };
    }
    return { valid: false, error: 'Must be true/false, 1/0, yes/no, t/f, or y/n' };
  }

  // Date types
  if (type.includes('DATE') && !type.includes('TIME')) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Must be a valid date (YYYY-MM-DD)' };
    }
    return { valid: true, transformedValue: value };
  }

  // DateTime types
  if (type.includes('DATETIME') || type.includes('TIMESTAMP')) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Must be a valid date-time (YYYY-MM-DD HH:MM:SS)' };
    }
    return { valid: true, transformedValue: value };
  }

  // Time types
  if (type.includes('TIME') && !type.includes('DATE')) {
    // Simple time validation (HH:MM:SS or HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    if (!timeRegex.test(value)) {
      return { valid: false, error: 'Must be a valid time (HH:MM:SS or HH:MM)' };
    }
    return { valid: true, transformedValue: value };
  }

  // JSON types
  if (type.includes('JSON')) {
    try {
      JSON.parse(value);
      return { valid: true, transformedValue: value };
    } catch {
      return { valid: false, error: 'Must be valid JSON' };
    }
  }

  // Email validation (for VARCHAR/TEXT fields)
  if (value.includes('@') && value.length > 5) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, error: 'Invalid email format' };
    }
  }

  // URL validation
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      new URL(value);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  // VARCHAR length check (if type includes length)
  const varcharMatch = type.match(/VARCHAR\((\d+)\)/);
  if (varcharMatch) {
    const maxLength = parseInt(varcharMatch[1]);
    if (value.length > maxLength) {
      return { valid: false, error: `Maximum length is ${maxLength} characters` };
    }
  }

  // CHAR length check
  const charMatch = type.match(/CHAR\((\d+)\)/);
  if (charMatch) {
    const exactLength = parseInt(charMatch[1]);
    if (value.length !== exactLength) {
      return { valid: false, error: `Must be exactly ${exactLength} characters` };
    }
  }

  // Default: accept as string
  return { valid: true, transformedValue: value };
}

/**
 * Get user-friendly placeholder text for a data type
 */
export function getPlaceholderForType(dataType: string): string {
  const type = dataType.toUpperCase();

  if (type.includes('INT')) return 'Enter integer...';
  if (type.includes('FLOAT') || type.includes('REAL') || type.includes('DOUBLE') || type.includes('NUMERIC'))
    return 'Enter number...';
  if (type.includes('BOOL')) return 'true/false or 1/0';
  if (type.includes('DATE') && !type.includes('TIME')) return 'YYYY-MM-DD';
  if (type.includes('DATETIME') || type.includes('TIMESTAMP')) return 'YYYY-MM-DD HH:MM:SS';
  if (type.includes('TIME')) return 'HH:MM:SS';
  if (type.includes('JSON')) return '{"key": "value"}';
  if (type.includes('VARCHAR')) {
    const match = type.match(/VARCHAR\((\d+)\)/);
    if (match) return `Text (max ${match[1]} chars)`;
  }

  return 'Enter value...';
}

/**
 * Get visual feedback color for validation state
 */
export function getValidationColor(valid: boolean): string {
  return valid ? 'border-success' : 'border-destructive';
}
