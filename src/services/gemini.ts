import { GoogleGenAI } from "@google/genai";

export async function generateSQL(prompt: string, schema: any[], apiKey?: string) {
  const ai = new GoogleGenAI({ apiKey: apiKey || (process.env as any).GEMINI_API_KEY });
  const schemaStr = schema.map(s => `${s.tableName}(${s.columns.map((c: any) => c.name).join(',')})`).join('|');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `SQL Engine. Schema: ${schemaStr}. Query: ${prompt}. JSON: {"sql":"SELECT...","relevantTables":["..."]}`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Gemini SQL Error:", e);
    return { sql: "", relevantTables: [] };
  }
}

export async function generateInsights(dataSample: any[], schemaContext: string, apiKey?: string) {
  const ai = new GoogleGenAI({ apiKey: apiKey || (process.env as any).GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest 5 strategic questions for this schema: ${schemaContext}. Sample: ${JSON.stringify(dataSample.slice(0,3))}. Return JSON array strings.`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "[]") as string[];
  } catch (e) {
    console.error("Gemini Insights Error:", e);
    return [];
  }
}

export async function analyzeResults(query: string, results: any[], apiKey?: string) {
  const ai = new GoogleGenAI({ apiKey: apiKey || (process.env as any).GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze: ${query}. Data: ${JSON.stringify(results.slice(0, 5))}. Return JSON: {"summary":"...","visualization":"bar"|"line"|"pie"|"table"|"dashboard","chartConfig":{"xAxis":"...","yAxis":"..."},"suggestedQuestions":["..."],"isDashboardCapable":true}`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Gemini Analyze Error:", e);
    return { summary: "Synthesis complete.", visualization: "table", suggestedQuestions: [] };
  }
}
