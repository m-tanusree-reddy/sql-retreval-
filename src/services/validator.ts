export class SQLValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SQLValidationError';
  }
}

export function validateSQL(sql: string): void {
  const upperSQL = sql.trim().toUpperCase();
  
  if (!upperSQL.startsWith('SELECT')) {
    throw new SQLValidationError('Only SELECT statements are allowed for security reasons.');
  }

  const forbiddenKeywords = [
    'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 
    'REPLACE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE'
  ];

  for (const keyword of forbiddenKeywords) {
    // Use regex to find whole words only
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(sql)) {
      throw new SQLValidationError(`Forbidden keyword detected: ${keyword}`);
    }
  }

  // Check for multiple statements
  if (sql.includes(';')) {
    const parts = sql.split(';').filter(p => p.trim().length > 0);
    if (parts.length > 1) {
      throw new SQLValidationError('Multiple SQL statements are not allowed.');
    }
  }
}
