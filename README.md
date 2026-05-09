# AI-Powered Relational Data Explorer

An intelligent, full-stack data platform that transforms raw files (CSV/JSON) into actionable insights using Natural Language to SQL (NL2SQL) synthesis and automated SQLite database management.

---

## 🌟 Core Features

- **Automated ETL**: Instant schema inference and table generation from uploaded JSON or CSV data.
- **NL2SQL Engine**: Powered by Google Gemini to translate plain English into complex SQLite queries.
- **Dynamic Visualization**: Adaptive charting (Bar, Line, Pie) that intelligently switches based on the query result set.
- **Relational Awareness**: Supports multi-table joins and complex relational logic, going beyond standard spreadsheet capabilities.

---

## 🏗️ Technical Architecture

### Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion.
- **Backend**: Node.js, Express.
- **Database**: SQLite (via `better-sqlite3`).
- **AI Integration**: Google Gemini (GenAI SDK).

### AI & Machine Learning Implementation
The project leverages **Generative AI** (LLMs) to perform high-level cognitive mapping:
- **Zero-Shot SQL Synthesis**: Generates semantically aware SQL queries without requiring previous training pairs.
- **Cognitive Summarization**: Synthesizes structured data into human-readable executive summaries.
- **Heuristic Visualization Choice**: Uses a logic-based approach to match data distribution with optimal visualization patterns.

---

## 🚀 Local Setup Guide

Follow these steps to run the full-stack system locally in VS Code or any standard terminal.

### 🛠️ Prerequisites
- **Node.js**: Version 18 or higher.
- **VS Code**: Recommended for development.
- **Gemini API Key**: Obtain one from [Google AI Studio](https://aistudio.google.com/).

### 📦 Installation

1. **Clone & Install**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **Launch**
   Start the Express backend and Vite frontend simultaneously:
   ```bash
   npm run dev
   ```

4. **Access**
   Navigate to `http://localhost:3000` in your browser.

---

## 🧠 Strategic Rationale

### Why Relational?
While flat CSV viewers are common, real-world business data is relational. This application uses a full SQL engine (SQLite) to allow users to ask questions that require joining multiple datasets—such as "Show me projects managed by employees in high-budget departments."

### Security & Integrity
- **SQL Validator**: Every AI-generated query is scanned against a security allowlist to prevent destructive operations.
- **Schema Grounding**: The AI is strictly contextualized with your specific schema, preventing hallucinations about data that doesn't exist.

---

## 📂 Project Structure

- `/src`: Frontend React components and logic.
- `/server.ts`: Express API server and AI proxy middleware.
- `src/db/init.ts`: SQLite database initialization and management.
- `src/services/gemini.ts`: AI prompt engineering and interaction logic.
