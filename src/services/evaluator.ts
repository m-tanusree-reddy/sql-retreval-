import { db } from '../db/init';

export interface EvaluationResult {
  isCorrect: boolean;
  predictedResults: any[];
  groundTruthResults: any[];
  error?: string;
}

export function evaluateSQL(predictedSQL: string, groundTruthSQL: string): EvaluationResult {
  try {
    const predictedResults = db.prepare(predictedSQL).all();
    const groundTruthResults = db.prepare(groundTruthSQL).all();

    // Compare results
    // We stringify for a deep comparison, but order might matter or not depending on the query.
    // For academic purposes, we can do a simple comparison or a sorted comparison.
    const isCorrect = JSON.stringify(predictedResults) === JSON.stringify(groundTruthResults);

    return {
      isCorrect,
      predictedResults,
      groundTruthResults
    };
  } catch (error: any) {
    return {
      isCorrect: false,
      predictedResults: [],
      groundTruthResults: [],
      error: error.message
    };
  }
}
