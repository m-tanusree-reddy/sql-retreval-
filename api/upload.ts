import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db/init';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data, tableName } = req.body;
  if (!data || !Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Valid data array is required' });
  }

  const name = tableName || `uploaded_${Date.now()}`;
  // Sanitize table name: only alphanumeric and underscores
  const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');

  try {
    // 1. Create table dynamically based on data keys
    const sample = data[0];
    const columns = Object.keys(sample)
      .map((key) => {
        const value = sample[key];
        let type = 'TEXT';
        if (typeof value === 'number') {
          type = Number.isInteger(value) ? 'INTEGER' : 'REAL';
        }
        return `"${key}" ${type}`;
      })
      .join(', ');

    // Use a transaction for safety
    const runTransaction = db.transaction(() => {
      // Drop existing if name matches (optional, but good for "Schema-Aware" prompt)
      db.prepare(`DROP TABLE IF EXISTS "${sanitizedName}"`).run();
      db.prepare(`CREATE TABLE "${sanitizedName}" (${columns})`).run();

      // 2. Insert rows
      const keys = Object.keys(sample);
      const placeholders = keys.map(() => '?').join(', ');
      const insertStmt = db.prepare(
        `INSERT INTO "${sanitizedName}" ("${keys.join('", "')}") VALUES (${placeholders})`
      );

      for (const row of data) {
        const values = keys.map((k) => row[k]);
        insertStmt.run(...values);
      }
    });

    runTransaction();

    res.status(200).json({
      success: true,
      tableName: sanitizedName,
      rowCount: data.length,
    });
  } catch (error: any) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
}
