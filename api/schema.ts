import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFullSchema } from '../src/services/schema';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const schema = getFullSchema();
    res.status(200).json(schema);
  } catch (error: any) {
    console.error('Schema error:', error);
    res.status(500).json({ error: error.message });
  }
}
