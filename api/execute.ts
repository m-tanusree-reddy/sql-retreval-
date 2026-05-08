import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db/init';
import { validateSQL, SQLValidationError } from '../src/services/validator';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sql } = req.body;
  if (!sql) {
    return res.status(400).json({ error: 'SQL query is required' });
  }

  try {
    validateSQL(sql);
    const start = performance.now();
    const statement = db.prepare(sql);

    let results;
    let info;

    if (statement.reader) {
      results = statement.all();
    } else {
      info = statement.run();
      results = [];
    }

    const end = performance.now();

    res.status(200).json({
      results,
      info,
      executionTimeMs: (end - start).toFixed(2),
      rowCount: results.length,
    });
  } catch (error: any) {
    console.error('SQL Execution Error:', error);
    if (error instanceof SQLValidationError) {
      res.status(403).json({
        error: error.message,
        type: 'validation',
      });
    } else {
      res.status(400).json({
        error: error.message,
        type: 'database',
        hint: 'Check your table names and column identifiers.',
      });
    }
  }
}
