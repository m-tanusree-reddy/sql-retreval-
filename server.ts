import express from "express";
import { createServer as createViteServer } from "vite";
import { initDb, db } from "./src/db/init";
import { getFullSchema } from "./src/services/schema";
import { validateSQL, SQLValidationError } from "./src/services/validator";
import { evaluateSQL } from "./src/services/evaluator";

async function startServer() {
  // Initialize Database
  initDb();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/schema", (req, res) => {
    try {
      const schema = getFullSchema();
      res.json(schema);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/execute", (req, res) => {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: "SQL query is required" });

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
      
      res.json({
        results,
        info,
        executionTimeMs: (end - start).toFixed(2),
        rowCount: results.length
      });
    } catch (error: any) {
      console.error("SQL Execution Error:", error);
      if (error instanceof SQLValidationError) {
        res.status(403).json({ 
          error: error.message,
          type: 'validation'
        });
      } else {
        res.status(400).json({ 
          error: error.message,
          type: 'database',
          hint: "Check your table names and column identifiers."
        });
      }
    }
  });

  // Dynamic Data Upload API
  app.post("/api/upload", (req, res) => {
    const { data, tableName } = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Valid data array is required" });
    }

    const name = tableName || `uploaded_${Date.now()}`;
    // Sanitize table name: only alphanumeric and underscores
    const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');

    try {
      // 1. Create table dynamically based on data keys
      const sample = data[0];
      const columns = Object.keys(sample).map(key => {
        const value = sample[key];
        let type = 'TEXT';
        if (typeof value === 'number') {
          type = Number.isInteger(value) ? 'INTEGER' : 'REAL';
        }
        return `"${key}" ${type}`;
      }).join(', ');

      // Use a transaction for safety
      const runTransaction = db.transaction(() => {
        // Drop existing if name matches (optional, but good for "Schema-Aware" prompt)
        db.prepare(`DROP TABLE IF EXISTS "${sanitizedName}"`).run();
        db.prepare(`CREATE TABLE "${sanitizedName}" (${columns})`).run();

        // 2. Insert rows
        const keys = Object.keys(sample);
        const placeholders = keys.map(() => '?').join(', ');
        const insertStmt = db.prepare(`INSERT INTO "${sanitizedName}" ("${keys.join('", "')}") VALUES (${placeholders})`);

        for (const row of data) {
          const values = keys.map(k => row[k]);
          insertStmt.run(...values);
        }
      });

      runTransaction();

      res.json({ 
        success: true, 
        tableName: sanitizedName, 
        rowCount: data.length 
      });
    } catch (error: any) {
      console.error("Upload Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/evaluate", (req, res) => {
    const { predictedSQL, groundTruthSQL } = req.body;
    if (!predictedSQL || !groundTruthSQL) {
      return res.status(400).json({ error: "Both predicted and ground truth SQL are required" });
    }

    const evaluation = evaluateSQL(predictedSQL, groundTruthSQL);
    res.json(evaluation);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
