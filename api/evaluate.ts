import type { VercelRequest, VercelResponse } from '@vercel/node';
import { evaluateSQL } from '../src/services/evaluator';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { predictedSQL, groundTruthSQL } = req.body;
  if (!predictedSQL || !groundTruthSQL) {
    return res
      .status(400)
      .json({ error: 'Both predicted and ground truth SQL are required' });
  }

  try {
    const evaluation = evaluateSQL(predictedSQL, groundTruthSQL);
    res.status(200).json(evaluation);
  } catch (error: any) {
    console.error('Evaluation Error:', error);
    res.status(500).json({ error: error.message });
  }
}
