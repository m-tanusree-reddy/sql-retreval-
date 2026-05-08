import { GoogleGenAI } from "@google/genai";

const DEFAULT_API_KEY = process.env.GEMINI_API_KEY || "";
const SUPPORTED_MODEL = "gemini-2.5-flash";

function getAiClient(apiKey?: string) {
  const effectiveKey = apiKey || DEFAULT_API_KEY;
  if (!effectiveKey) {
    throw new Error('Gemini API key is required. Set GEMINI_API_KEY in the environment or enter a custom key in the UI.');
  }
  return new GoogleGenAI({ apiKey: effectiveKey });
}

function extractJson(text: string) {
  let cleaned = text.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
  }

  const jsonStart = Math.min(
    cleaned.indexOf('{') === -1 ? Infinity : cleaned.indexOf('{'),
    cleaned.indexOf('[') === -1 ? Infinity : cleaned.indexOf('[')
  );

  if (jsonStart !== Infinity && jsonStart > 0) {
    cleaned = cleaned.slice(jsonStart);
  }

  try {
    return JSON.parse(cleaned);
  } catch (error: any) {
    throw new Error(`Failed to parse AI JSON response: ${error.message}. Raw response: ${text}`);
  }
}

export async function generateSQL(prompt: string, schema: any[], apiKey?: string) {
  const ai = getAiClient(apiKey);
  const schemaStr = schema.map(s => `${s.tableName}(${s.columns.map((c: any) => c.name).join(',')})`).join('|');

  const response = await ai.models.generateContent({
    model: SUPPORTED_MODEL,
    contents: `SQL Engine. Schema: ${schemaStr}. Query: ${prompt}. Respond with a JSON object only, like {"sql":"SELECT ...","relevantTables":["..."]}`
  });

  try {
    return extractJson(response.text || "{}");
  } catch (e: any) {
    console.error("generateSQL error:", e?.message || e);
    return { sql: "", relevantTables: [] };
  }
}

export async function generateInsights(dataSample: any[], schemaContext: string, apiKey?: string) {
  const ai = getAiClient(apiKey);
  const response = await ai.models.generateContent({
    model: SUPPORTED_MODEL,
    contents: `Suggest 5 strategic questions for this schema: ${schemaContext}. Sample: ${JSON.stringify(dataSample.slice(0,3))}. Respond with a JSON array only.`
  });

  try {
    return extractJson(response.text || "[]") as string[];
  } catch (e: any) {
    console.error("generateInsights error:", e?.message || e);
    return [];
  }
}

export async function analyzeResults(query: string, results: any[], apiKey?: string) {
  const ai = getAiClient(apiKey);
  const response = await ai.models.generateContent({
    model: SUPPORTED_MODEL,
    contents: `Analyze the query: ${query}. Data sample: ${JSON.stringify(results.slice(0, 5))}. Respond with a JSON object only in this shape: {"summary":"...","visualization":"bar|line|pie|table|dashboard","chartConfig":{"xAxis":"...","yAxis":"..."},"suggestedQuestions":["..."],"isDashboardCapable":true}`
  });

  try {
    return extractJson(response.text || "{}");
  } catch (e: any) {
    console.error("analyzeResults error:", e?.message || e);
    return { summary: "Synthesis complete.", visualization: "table", suggestedQuestions: [] };
  }
}
