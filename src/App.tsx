import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  Database, 
  Search, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Code, 
  Table as TableIcon,
  Clock,
  Info,
  Layers,
  Activity,
  ChevronRight,
  Plus,
  RefreshCw,
  LayoutGrid,
  FileCode2,
  Zap,
  Upload,
  Sparkles,
  BarChart,
  Lightbulb,
  FileText,
  Trash2,
  Cpu,
  TableProperties,
  Filter,
  Download,
  Send,
  User,
  Bot,
  ArrowDownCircle,
  FileSpreadsheet,
  Edit,
  Save,
  FileStack,
  Key,
  Sun,
  Moon
} from 'lucide-react';
import { generateSQL, generateInsights, analyzeResults } from './services/gemini';
import { Suggestions } from './components/Suggestions';
import { HistorySidebar } from './components/HistorySidebar';
import { Visualizer } from './components/Visualizer';

interface Schema {
  tableName: string;
  columns: { name: string; type: string }[];
}

interface HistoryItem {
  query: string;
  sql: string;
  id: string;
  timestamp: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  results?: any[];
  sql?: string;
  analysis?: any;
  timestamp: number;
}

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState<Schema[]>([]);
  const [filteredSchema, setFilteredSchema] = useState<Schema[]>([]);
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [executionTime, setExecutionTime] = useState<string>('');
  const [error, setError] = useState<{ message: string; type: string; hint?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'query' | 'schema' | 'evaluation' | 'data' | 'viewer'>('query');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [queryNotes, setQueryNotes] = useState<Record<string, string>>({});
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('user-gemini-api-key') || '');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
    }
    return 'dark';
  });
  const [importedTables, setImportedTables] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('imported-tables') || '[]');
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('user-gemini-api-key', userApiKey);
  }, [userApiKey]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('imported-tables', JSON.stringify(importedTables));
  }, [importedTables]);

  // Viewer State
  const [selectedViewerTable, setSelectedViewerTable] = useState<string | null>(null);
  const [viewerData, setViewerData] = useState<any[]>([]);

  // Lab/Data State
  const [uploadedData, setUploadedData] = useState<any[]>([]);
  const [uploadInsights, setUploadInsights] = useState<string[]>([]);
  const [uploadFileName, setUploadFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSchema();
    const saved = localStorage.getItem('sql-engine-history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const fetchSchema = async (newTableName?: string, overrideTables?: string[]) => {
    try {
      const res = await fetch('/api/schema');
      const data = await res.json();
      
      const tablesToUse = overrideTables || importedTables;
      // Filter schema to only show imported tables
      const filtered = (data as Schema[]).filter(t => tablesToUse.includes(t.tableName));
      setSchema(filtered);
      
      // If a new table was uploaded, prioritize it in the viewer
      if (newTableName) {
        setSelectedViewerTable(newTableName);
        fetchTableData(newTableName);
      } else if (filtered.length > 0 && (!selectedViewerTable || !tablesToUse.includes(selectedViewerTable))) {
        // Default to first table if nothing selected or current selection missing
        setSelectedViewerTable(filtered[0].tableName);
        fetchTableData(filtered[0].tableName);
      }
    } catch (err) {
      console.error('Failed to fetch schema', err);
    }
  };

  const fetchTableData = async (tableName: string) => {
    setLoading(true);
    try {
      const resp = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: `SELECT * FROM "${tableName}" LIMIT 1000` })
      });
      const data = await resp.json();
      setViewerData(data.results || []);
    } catch (err) {
      console.error("Failed to fetch table data", err);
    } finally {
      setLoading(false);
    }
  };

  const saveToHistory = (q: string, s: string) => {
    const newItem: HistoryItem = {
      query: q,
      sql: s,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
    const updated = [newItem, ...history].slice(0, 20);
    setHistory(updated);
    localStorage.setItem('sql-engine-history', JSON.stringify(updated));
  };

  const handleProcess = async (overriddenQuery?: string) => {
    const activeQuery = overriddenQuery || query;
    if (!activeQuery.trim()) return;
    
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      role: 'user',
      content: activeQuery,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    if (!overriddenQuery) setQuery('');
    setLoading(true);
    setError(null);

    try {
      // 1. Generation & Synthesis (Consolidated for speed)
      const { sql, relevantTables } = await generateSQL(activeQuery, schema, userApiKey);
      
      const relevant = schema.filter(s => relevantTables?.includes(s.tableName));
      setFilteredSchema(relevant);

      if (!sql) throw new Error('Engine returned empty SQL.');

      // 2. Execution
      const execRes = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });
      const execData = await execRes.json();

      if (execRes.ok) {
        // 4. Analysis
        const analysis = await analyzeResults(activeQuery, execData.results, userApiKey);
        
        const assistantMsg: ChatMessage = {
          id: Math.random().toString(36).substr(2, 9),
          role: 'assistant',
          content: analysis.summary || "Here are the strategic results:",
          results: execData.results,
          sql: sql,
          analysis: analysis,
          timestamp: Date.now()
        };
        
        setMessages(prev => [...prev, assistantMsg]);
        setExecutionTime(execData.executionTimeMs);
        saveToHistory(activeQuery, sql);
      } else {
        throw new Error(execData.error || 'Execution failed');
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: `Neural Error: ${err.message}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setLoading(true);
    try {
      const demoTables = [
        {
          name: 'departments',
          data: [
            { id: 1, name: 'Engineering', budget: 5000000, location: 'San Francisco' },
            { id: 2, name: 'Product', budget: 2000000, location: 'New York' },
            { id: 3, name: 'Sales', budget: 3500000, location: 'Chicago' },
            { id: 4, name: 'HR', budget: 1000000, location: 'San Francisco' }
          ]
        },
        {
          name: 'employees',
          data: [
            { id: 1, name: 'Elena Vance', department_id: 1, role: 'CTO', salary: 250000, hire_date: '2020-05-15' },
            { id: 2, name: 'Gordon Freeman', department_id: 1, role: 'Lead Engineer', salary: 180000, hire_date: '2021-03-10' },
            { id: 3, name: 'Alyx Vance', department_id: 2, role: 'Product Lead', salary: 165000, hire_date: '2021-06-20' },
            { id: 4, name: 'Barney Calhoun', department_id: 3, role: 'Sales Director', salary: 190000, hire_date: '2020-11-01' },
            { id: 5, name: 'Isaac Kleiner', department_id: 1, role: 'Research Scientist', salary: 210000, hire_date: '2019-08-12' },
            { id: 6, name: 'Judith Mossman', department_id: 4, role: 'HR Manager', salary: 120000, hire_date: '2022-01-15' }
          ]
        },
        {
          name: 'projects',
          data: [
            { id: 101, name: 'Project Borealis', department_id: 1, manager_id: 2, priority: 'Critical', start_date: '2024-01-01' },
            { id: 102, name: 'Gravity Gun v2', department_id: 1, manager_id: 5, priority: 'High', start_date: '2024-02-15' },
            { id: 103, name: 'User Growth Q3', department_id: 2, manager_id: 3, priority: 'Medium', start_date: '2024-03-20' },
            { id: 104, name: 'EMEA Expansion', department_id: 3, manager_id: 4, priority: 'High', start_date: '2024-04-10' }
          ]
        },
        {
          name: 'financials',
          data: [
            { id: 1001, project_id: 101, category: 'Infrastructure', amount: 150000.00, date: '2024-02-01' },
            { id: 1002, project_id: 101, category: 'R&D', amount: 85000.00, date: '2024-02-15' },
            { id: 1003, project_id: 102, category: 'Hardware', amount: 320000.00, date: '2024-03-01' },
            { id: 1004, project_id: 103, category: 'Marketing', amount: 45000.00, date: '2024-03-25' },
            { id: 1005, project_id: 104, category: 'Legal', amount: 12000.00, date: '2024-04-05' }
          ]
        }
      ];

      const currentTables = [...importedTables];
      for (const table of demoTables) {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: table.data, tableName: table.name })
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(`Upload failed for ${table.name}: ${errData.error}`);
        }
        
        if (!currentTables.includes(table.name)) {
          currentTables.push(table.name);
        }
      }
      
      setImportedTables(currentTables);
      await fetchSchema(demoTables[1].name, currentTables); // Show employees by default
      setUploadedData(demoTables[1].data); 
      setUploadFileName("global_enterprise_suite");
      setActiveTab('viewer');
      setUploadInsights([
        "Calculate the total salary expense per department",
        "Show me all projects managed by Engineering employees",
        "List employees earning more than their department's average salary",
        "What is the total financial spend for 'Project Borealis'?",
        "Find departments located in San Francisco with a budget over $2M",
        "Rank departments by their count of active projects"
      ]);
    } catch (err: any) {
      console.error("Demo load error", err);
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: `Upload Error: ${err.message}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setUploadedData(data);
        
        // Sync with backend SQLite for the engine to be schema-aware
        const tableName = file.name.split('.')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, tableName })
        });
        
        if (uploadRes.ok) {
          const resJson = await uploadRes.json();
          const updatedTables = Array.from(new Set([...importedTables, resJson.tableName]));
          setImportedTables(updatedTables);
          fetchSchema(resJson.tableName, updatedTables); // Refresh and select the new table
          setActiveTab('viewer'); // Switch to viewer immediately as requested
        } else {
          const err = await uploadRes.json();
          throw new Error(err.error || 'Upload failed');
        }

        // Generate AI Insights from uploaded data
        const schemaCtx = Object.keys(data[0] || {}).map(k => `${k} (inferred)`).join(', ');
        const insights = await generateInsights(data, `Table: ${tableName}\nColumns: ${schemaCtx}`, userApiKey);
        setUploadInsights(insights);
      } catch (err) {
        console.error("Upload error", err);
        setError({ message: "Failed to parse file. Ensure it is a valid CSV or Excel.", type: "critical" });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const LoadingBar = () => (
    <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 overflow-hidden z-[100]">
      <motion.div
        initial={{ left: '-100%' }}
        animate={{ left: '100%' }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        className="absolute h-full w-1/3 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_20px_rgba(79,70,229,1)]"
      />
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0F1115] text-white dark' : 'bg-[#FAFAFB] text-gray-900'} font-sans flex text-sm overflow-hidden selection:bg-emerald-500/30`}>
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] ${theme === 'dark' ? 'bg-indigo-600/10' : 'bg-indigo-500/5'} blur-[120px] rounded-full animate-pulse`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] ${theme === 'dark' ? 'bg-purple-600/10' : 'bg-purple-500/5'} blur-[120px] rounded-full animate-pulse delay-1000`} />
      </div>

      {/* Sidebar - History & Config */}
      <aside className={`w-80 ${theme === 'dark' ? 'bg-[#161922] border-white/5' : 'bg-white border-gray-200'} border-r flex flex-col p-6 hidden xl:flex z-50`}>
        <div className="flex items-center gap-3 mb-10 group">
          <div className="bg-gradient-to-tr from-emerald-500 via-emerald-600 to-lime-500 p-2.5 rounded-2xl text-white shadow-2xl shadow-emerald-500/20 group-hover:scale-110 transition-transform cursor-pointer">
            <Zap size={24} fill="white" className="animate-pulse" />
          </div>
          <div>
            <h1 className={`text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${theme === 'dark' ? 'from-white to-gray-400' : 'from-emerald-600 to-lime-600'}`}>SQL Genie</h1>
            <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} font-bold uppercase tracking-widest`}>Enterprise Intelligence</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <HistorySidebar 
            history={history} 
            onSelect={(item) => { setQuery(item.query); setGeneratedSQL(item.sql); setActiveTab('explorer'); }}
            onClear={() => { setHistory([]); localStorage.removeItem('sql-engine-history'); }}
          />
        </div>

        <div className="mt-6 pt-6 border-t border-white/5 font-mono text-[10px] text-gray-500 space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              <span>DB STATUS</span>
            </div>
            <span className="text-white font-black uppercase text-[9px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-emerald-400">
               <Cpu size={12} />
               <span>MODEL</span>
            </div>
            <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>G-PRO 3.1</span>
          </div>

          <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              <Key size={12} />
              <span>Neural Key</span>
            </div>
            <input 
              type="password"
              value={userApiKey}
              onChange={(e) => setUserApiKey(e.target.value)}
              placeholder="Enter Gemini API Key..."
              className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] placeholder:text-gray-700 outline-none focus:border-emerald-500/50 transition-all font-mono ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-300'}`}
            />
            {userApiKey && (
              <p className="text-[9px] text-emerald-500/60 flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                Custom Key Active
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden h-screen">
        {loading && <LoadingBar />}
        
        {/* Top Navbar */}
        <header className={`h-20 ${theme === 'dark' ? 'bg-[#161922]/50 border-white/5' : 'bg-white/80 border-gray-200'} backdrop-blur-3xl border-b flex items-center justify-between px-10 z-10 sticky top-0`}>
          <nav className={`flex gap-2 p-1.5 ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-100 border-gray-200'} rounded-2xl border`}>
            {(['query', 'viewer', 'schema', 'data', 'evaluation'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-xl text-[11px] font-black tracking-[0.1em] uppercase transition-all flex items-center gap-2.5 ${
                  activeTab === tab 
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-white/10' 
                    : `${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-emerald-600 hover:bg-white'}`
                }`}
              >
                {tab === 'query' && <Search size={14} className={activeTab === tab ? 'animate-pulse' : ''} />}
                {tab === 'schema' && <Layers size={14} />}
                {tab === 'evaluation' && <Activity size={14} />}
                {tab === 'data' && <Sparkles size={14} />}
                {tab === 'viewer' && <TableProperties size={14} />}
                {tab === 'data' ? 'Input Data' : tab === 'viewer' ? 'Data View' : tab === 'query' ? 'Query Hub' : tab === 'evaluation' ? 'Synthesis Report' : tab}
              </button>
            ))}
          </nav>
          
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-4 text-[10px] font-black ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} uppercase tracking-[0.2em]`}>
              <span className={`flex items-center gap-2 ${theme === 'dark' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'} px-3 py-1.5 rounded-lg border shadow-inner`}><TableIcon size={12} /> {schema.length} Entities</span>
              <span className={`flex items-center gap-2 ${theme === 'dark' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'} px-3 py-1.5 rounded-lg border shadow-inner`}><Clock size={12} /> {executionTime || '0.00'}ms</span>
            </div>

            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2.5 rounded-xl border transition-all hover:scale-105 active:scale-95 ${
                theme === 'dark' 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-lg shadow-amber-500/10' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 shadow-lg shadow-emerald-500/10'
              }`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-emerald-600 to-lime-500 p-0.5 shadow-2xl shadow-emerald-500/20 cursor-pointer hover:scale-110 active:scale-95 transition-all">
              <div className={`w-full h-full rounded-[14px] ${theme === 'dark' ? 'bg-[#0F1115]' : 'bg-white'} flex items-center justify-center font-bold text-xs ${theme === 'dark' ? 'text-white' : 'text-emerald-600'}`}>
                TR
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Viewport */}
        <div className="flex-1 overflow-y-auto bg-transparent scroll-smooth custom-scrollbar">
          <div className="max-w-7xl mx-auto p-10 h-full">
            <AnimatePresence mode="wait">
              {activeTab === 'query' && (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex gap-10 h-[calc(100vh-180px)]"
                >
                  {/* Left Sidebar: Neural Pulse Insights */}
                  <div className="w-80 flex-shrink-0 flex flex-col gap-6">
                    <section className={`${theme === 'dark' ? 'bg-[#161922] border-white/5' : 'bg-white border-gray-200 shadow-xl'} rounded-[32px] border p-8 flex-1 overflow-hidden flex flex-col`}>
                      <div className="flex items-center gap-3 mb-6">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                          <Lightbulb size={20} />
                        </div>
                        <div>
                          <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Neural Pulse</h3>
                          <p className={`text-[9px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Autonomous Insights</p>
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
                        {uploadInsights.length > 0 ? uploadInsights.map((insight, i) => (
                          <motion.button 
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => handleProcess(insight)}
                            className={`w-full text-left p-4 rounded-2xl border transition-all group ${theme === 'dark' ? 'bg-white/[0.02] border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30' : 'bg-gray-50 border-gray-100 hover:bg-emerald-50 hover:border-emerald-200 shadow-sm'}`}
                          >
                            <p className={`text-[11px] font-bold leading-relaxed ${theme === 'dark' ? 'text-gray-400 group-hover:text-white' : 'text-gray-600 group-hover:text-emerald-700'}`}>{insight}</p>
                          </motion.button>
                        )) : (
                           <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4 px-4">
                              <Cpu size={32} className={theme === 'dark' ? 'text-white' : 'text-gray-900'} />
                              <p className={`text-[10px] font-black uppercase tracking-widest leading-relaxed ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Awaiting Data Upload<br/>for Pulse Sync</p>
                           </div>
                        )}
                      </div>
                    </section>
                    
                    <section className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[32px] p-6 text-white shadow-2xl relative overflow-hidden group flex-shrink-0">
                      <div className="flex items-center gap-3 mb-3 relative">
                        <Layers size={16} />
                        <h4 className="font-black text-[10px] uppercase tracking-widest">Cognitive Scope</h4>
                      </div>
                      <div className="flex flex-wrap gap-1.5 relative">
                        {schema.slice(0, 5).map(s => (
                          <span key={s.tableName} className="text-[8px] font-black bg-white/10 px-2 py-1 rounded-md uppercase">
                            {s.tableName}
                          </span>
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* Main Content: Chat Terminal */}
                  <div className={`flex-1 flex flex-col ${theme === 'dark' ? 'bg-[#161922] border-white/5' : 'bg-white border-gray-200'} rounded-[40px] shadow-3xl border overflow-hidden`}>
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-6">
                          <Bot size={64} className={`${theme === 'dark' ? 'text-emerald-400 opacity-60' : 'text-emerald-600 opacity-40'} animate-pulse`} />
                          <div className="text-center space-y-2">
                             <h3 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'} uppercase tracking-tight`}>Neural Sync Ready</h3>
                             <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} font-medium uppercase tracking-[0.2em]`}>Awaiting instructions...</p>
                          </div>
                          
                          <div className="w-full max-w-md space-y-4 pt-10">
                             <p className={`text-[10px] font-black ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'} uppercase tracking-widest text-center`}>Suggested Starting Protocols</p>
                             <div className="grid grid-cols-1 gap-2">
                                <Suggestions onSelect={(text) => handleProcess(text)} schema={schema} theme={theme} />
                             </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {messages.map((msg) => (
                            <motion.div 
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-4`}
                            >
                              <div className={`flex items-center gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${msg.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-emerald-600/10 text-emerald-600 border border-emerald-600/20 shadow-sm'}`}>
                                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                </div>
                                <span className={`text-[10px] font-black ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'} uppercase tracking-widest`}>
                                  {msg.role === 'user' ? 'Authorized Client' : 'Neural System'}
                                </span>
                              </div>
                              
                              <div className={`max-w-[85%] p-6 rounded-[28px] ${
                                msg.role === 'user' 
                                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-tr-none shadow-xl shadow-emerald-500/10' 
                                  : `${theme === 'dark' ? 'bg-[#0D0E10] text-gray-300 border-white/5' : 'bg-gray-50 text-gray-700 border-gray-200'} border rounded-tl-none shadow-2xl`
                              }`}>
                                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                
                                {msg.results && (
                                  <div className="mt-8 space-y-6">
                                    <div className={`p-1 ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-white border-gray-200'} rounded-3xl border shadow-xl`}>
                                       <Visualizer 
                                          data={msg.results} 
                                          config={msg.analysis?.chartConfig} 
                                          defaultMode={msg.analysis?.visualization} 
                                       />
                                    </div>
                                    
                                    {msg.sql && (
                                      <div className={`p-4 border rounded-2xl ${theme === 'dark' ? 'bg-lime-500/5 border-lime-500/20' : 'bg-lime-50 border-lime-200 text-lime-900 group'}`}>
                                         <div className={`flex items-center gap-2 mb-2 text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-lime-400' : 'text-lime-600'}`}>
                                            <FileCode2 size={12} /> Execution Logic
                                         </div>
                                         <code className={`text-[11px] font-mono whitespace-pre-wrap block ${theme === 'dark' ? 'text-lime-300/80' : 'text-lime-800'}`}>{msg.sql}</code>
                                      </div>
                                    )}

                                    {msg.analysis?.suggestedQuestions && (
                                      <div className={`space-y-4 pt-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                        <p className={`text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                          <Sparkles size={12} /> Discovered Follow-ups
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {msg.analysis.suggestedQuestions.map((q: string, i: number) => (
                                            <button 
                                              key={i} 
                                              onClick={() => handleProcess(q)}
                                              className={`px-4 py-2 rounded-xl border text-[10px] font-bold transition-all text-left shadow-sm ${theme === 'dark' ? 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10' : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'}`}
                                            >
                                              {q}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                          <div ref={chatEndRef} className="h-4" />
                        </>
                      )}
                    </div>

                     <div className={`p-8 border-t flex gap-4 ${theme === 'dark' ? 'bg-[#1B1E26] border-white/5' : 'bg-gray-50 border-gray-200 shadow-inner'}`}>
                        <div className="flex-1 relative">
                          <input 
                             value={query}
                             onChange={(e) => setQuery(e.target.value)}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter' && !e.shiftKey) {
                                 e.preventDefault();
                                 handleProcess();
                               }
                             }}
                             placeholder="Instruct Neural Engine..."
                             className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-gray-400 outline-none transition-all shadow-inner ${theme === 'dark' ? 'bg-[#0D0E10] border-white/5 text-white focus:ring-emerald-500/50' : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/30'}`}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                             <Sparkles size={16} className={`${theme === 'dark' ? 'text-gray-700' : 'text-gray-400'}`} />
                          </div>
                        </div>
                        <button 
                           onClick={() => handleProcess()}
                           disabled={loading || !query.trim()}
                           className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-95 ${
                             loading || !query.trim() 
                               ? 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600' 
                               : 'bg-gradient-to-br from-emerald-500 to-lime-600 text-white hover:scale-105 shadow-emerald-500/20'
                           }`}
                        >
                           {loading ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
                        </button>
                     </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'viewer' && (
                <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="flex flex-col h-[calc(100vh-160px)]"
                >
                   <div className="flex gap-8 h-full">
                    {/* Table Sidebar (Power BI Style) */}
                    <div className={`w-72 ${theme === 'dark' ? 'bg-[#161922] border-white/5' : 'bg-white border-gray-200'} rounded-[32px] border p-6 space-y-6 overflow-y-auto custom-scrollbar shadow-xl`}>
                      <div className="flex items-center gap-3 px-2">
                        <Database size={18} className="text-emerald-500" />
                        <h3 className={`text-[10px] font-black ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-[0.2em]`}>Semantic Model</h3>
                      </div>
                      <div className="space-y-1">
                        {importedTables.length === 0 ? (
                          <div className="py-10 text-center space-y-2">
                             <p className="text-[10px] font-black text-gray-500 uppercase">Input Required</p>
                             <button onClick={() => setActiveTab('data')} className="text-[9px] text-emerald-500 font-bold underline">Go to Data Hub</button>
                          </div>
                        ) : schema.map(table => (
                          <button
                            key={table.tableName}
                            onClick={() => { setSelectedViewerTable(table.tableName); fetchTableData(table.tableName); }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${
                              selectedViewerTable === table.tableName 
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                : `${theme === 'dark' ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:text-emerald-600 hover:bg-emerald-50'}`
                            }`}
                          >
                             <span className="truncate">{table.tableName}</span>
                             <ChevronRight size={14} className={`${selectedViewerTable === table.tableName ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'} transition-opacity`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Data Canvas */}
                    <div className={`flex-1 ${theme === 'dark' ? 'bg-[#0D0E10] border-white/5' : 'bg-white border-gray-200 shadow-xl shadow-gray-200/50'} rounded-[40px] border overflow-hidden flex flex-col shadow-2xl`}>
                      <div className={`px-10 py-6 border-b ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'} flex items-center justify-between`}>
                        <div className="flex items-center gap-4">
                          <h2 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'} tracking-tight uppercase`}>{selectedViewerTable}</h2>
                          <span className={`px-3 py-1 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-500' : 'bg-gray-200 border-gray-300 text-gray-600'} rounded-lg border text-[9px] font-black uppercase tracking-widest`}>
                            {viewerData.length} Records Loaded
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                           <button className={`p-2.5 ${theme === 'dark' ? 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'} rounded-xl border transition-all shadow-sm`}>
                             <Filter size={16} />
                           </button>
                           <button className={`p-2.5 ${theme === 'dark' ? 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'} rounded-xl border transition-all shadow-sm`}>
                             <Download size={16} />
                           </button>
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-auto custom-scrollbar">
                        {viewerData.length > 0 ? (
                          <table className="w-full text-left border-collapse table-auto min-w-full">
                            <thead className={`${theme === 'dark' ? 'bg-[#161922]' : 'bg-gray-50'} sticky top-0 z-10`}>
                              <tr>
                                {Object.keys(viewerData[0]).map(key => (
                                  <th key={key} className={`px-8 py-5 text-[10px] font-black ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} uppercase tracking-[0.2em] border-b ${theme === 'dark' ? 'border-white/5 bg-[#161922]' : 'border-gray-100 bg-gray-50'} whitespace-nowrap`}>
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-gray-100'}`}>
                              {viewerData.map((row, i) => (
                                <tr key={i} className={`transition-colors group ${theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-emerald-50/50'}`}>
                                  {Object.values(row).map((val: any, j) => (
                                    <td key={j} className={`px-8 py-4 text-xs font-medium ${theme === 'dark' ? 'text-gray-400 group-hover:text-white' : 'text-gray-600 group-hover:text-emerald-600'} border-none whitespace-nowrap`}>
                                      {val === null ? <span className="opacity-30 italic">null</span> : val?.toString()}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className={`h-full flex flex-col items-center justify-center ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'} gap-4`}>
                            <Layers size={64} className="stroke-1 opacity-20" />
                            <p className="text-sm font-black uppercase tracking-widest opacity-20">Select an entity to initialize view</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'schema' && (
                <motion.div 
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20"
                >
                  {schema.map((table, i) => (
                    <motion.div 
                      key={table.tableName}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`${theme === 'dark' ? 'bg-[#161922] border-white/5' : 'bg-white border-gray-100 shadow-xl'} rounded-[40px] border hover:border-emerald-500/30 transition-all p-8 group`}
                    >
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl transition-all ${theme === 'dark' ? 'bg-white/5 text-emerald-400 group-hover:bg-emerald-500/10' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'} group-hover:scale-110 shadow-sm`}>
                            <TableIcon size={20} />
                          </div>
                          <h3 className={`font-black text-lg transition-colors uppercase tracking-tight ${theme === 'dark' ? 'text-white group-hover:text-emerald-400' : 'text-gray-900 group-hover:text-emerald-600'}`}>{table.tableName}</h3>
                        </div>
                        <button 
                          onClick={() => { setSelectedViewerTable(table.tableName); fetchTableData(table.tableName); setActiveTab('viewer'); }}
                          className={`p-2.5 rounded-xl transition-all opacity-0 group-hover:opacity-100 ${theme === 'dark' ? 'bg-white/5 text-gray-500 hover:text-white hover:bg-emerald-500/20' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 shadow-sm'}`}
                          title="View Data"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {table.columns.map((col) => (
                          <div key={col.name} className={`flex items-center justify-between py-3 text-[11px] group/item border-b last:border-0 rounded-[14px] px-3 -mx-3 transition-all ${theme === 'dark' ? 'border-white/5 hover:bg-white/[0.03]' : 'border-gray-50 hover:bg-emerald-50'}`}>
                            <span className={`font-bold transition-colors ${theme === 'dark' ? 'text-gray-400 group-hover/item:text-white' : 'text-gray-700 group-hover/item:text-emerald-600'}`}>{col.name}</span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border shadow-sm ${theme === 'dark' ? 'text-emerald-400 bg-emerald-500/10 border-indigo-500/20' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>{col.type}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                  {schema.length === 0 && (
                    <div className="col-span-full h-[400px] flex flex-col items-center justify-center opacity-30 space-y-6">
                      <Layers size={64} className="text-gray-400" />
                      <div className="text-center space-y-4">
                        <p className={`font-black uppercase tracking-widest text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>No imported assets syncronized</p>
                        <button 
                          onClick={() => setActiveTab('data')}
                          className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-500/20"
                        >
                          Import Data to Initialize Schema
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'data' && (
                <motion.div 
                   initial={{ opacity: 0, y: 50 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="space-y-10 pb-20"
                >
                  <section className={`rounded-[50px] p-12 border shadow-3xl text-center relative overflow-hidden ${theme === 'dark' ? 'bg-[#161922] border-white/10' : 'bg-white border-gray-200'}`}>
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-emerald-500 via-lime-500 to-transparent" />
                    <div className={`inline-flex p-6 rounded-[32px] mb-8 border shadow-[0_0_50px_rgba(16,185,129,0.1)] ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                      <Upload size={48} className="animate-bounce" />
                    </div>
                    <h2 className={`text-4xl font-black mb-4 tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Intelligence Importer</h2>
                    <p className={`text-lg font-medium max-w-xl mx-auto mb-10 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Upload any CSV or Excel entity to instantly reconfigure the engine schema and generate neural insights.</p>
                    
                    <div className="flex justify-center gap-4 mb-8">
                       <button 
                         onClick={() => {
                           const csvContent = "Transaction_ID,Date,Sales_Rep,Region,Product_Category,Revenue,Units_Sold,Rating\n" + 
                             Array.from({ length: 70 }, (_, i) => {
                               const reps = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George'];
                               const regions = ['North', 'South', 'East', 'West', 'Central'];
                               const categories = ['Electronics', 'Furniture', 'Apparel', 'Accessories', 'Appliances'];
                               const date = new Date(2024, 0, 1 + i).toISOString().split('T')[0];
                               return `${1000 + i},${date},${reps[i % reps.length]},${regions[i % regions.length]},${categories[i % categories.length]},${(Math.random() * 2000 + 100).toFixed(2)},${Math.floor(Math.random() * 50 + 1)},${(Math.random() * 2 + 3).toFixed(1)}`;
                             }).join('\n');
                           
                           const blob = new Blob([csvContent], { type: 'text/csv' });
                           const url = window.URL.createObjectURL(blob);
                           const a = document.createElement('a');
                           a.setAttribute('hidden', '');
                           a.setAttribute('href', url);
                           a.setAttribute('download', 'global_sales_sample.csv');
                           document.body.appendChild(a);
                           a.click();
                           document.body.removeChild(a);
                         }}
                         className={`px-6 py-3 rounded-2xl border transition-all flex items-center gap-2.5 text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-white/5 text-gray-400 border-white/5 hover:text-white hover:bg-white/10' : 'bg-white text-emerald-600 border-gray-200 hover:bg-emerald-50 shadow-sm'}`}
                       >
                         <Download size={14} /> Download Business Logic CSV
                       </button>

                       <button 
                         onClick={handleLoadDemo}
                         className={`px-6 py-3 rounded-2xl border transition-all flex items-center gap-2.5 text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20'}`}
                       >
                         <Database size={14} /> Load Relational Demo Pack
                       </button>
                    </div>

                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`max-w-2xl mx-auto border-3 border-dashed rounded-[40px] p-12 transition-all cursor-pointer group ${theme === 'dark' ? 'border-white/10 hover:border-emerald-500/50 hover:bg-white/[0.02]' : 'border-gray-200 hover:border-emerald-600 hover:bg-emerald-50/50'}`}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        accept=".csv, .xlsx, .xls"
                        onChange={handleFileUpload} 
                      />
                      <FileText size={40} className={`mx-auto mb-4 transition-colors ${theme === 'dark' ? 'text-gray-700 group-hover:text-emerald-500' : 'text-gray-300 group-hover:text-emerald-600'}`} />
                      <p className={`font-black uppercase tracking-widest text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}>Drop Strategic Asset or Browse Files</p>
                      {uploadFileName && (
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 text-xs font-black">
                           <CheckCircle2 size={14} /> {uploadFileName}
                        </div>
                      )}
                    </div>
                  </section>

                  <AnimatePresence>
                    {uploadedData.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="grid grid-cols-1 lg:grid-cols-2 gap-10"
                      >
                         <section className={`rounded-[40px] p-10 border space-y-8 ${theme === 'dark' ? 'bg-[#161922] border-white/5' : 'bg-white border-gray-200 shadow-xl'}`}>
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                <Lightbulb size={24} />
                              </div>
                              <div>
                                <h3 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Neural Pulse</h3>
                                <p className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Discovered insights based on uploaded entity schema</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              {uploadInsights.length > 0 ? uploadInsights.map((insight, i) => (
                                <motion.div 
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: i * 0.1 }}
                                  key={i}
                                  onClick={() => { handleProcess(insight); setActiveTab('query'); }}
                                  className={`p-5 rounded-2xl border transition-all cursor-pointer group ${theme === 'dark' ? 'bg-white/[0.03] border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30' : 'bg-gray-50 border-gray-100 hover:bg-emerald-50 hover:border-emerald-200'}`}
                                >
                                  <p className={`text-sm font-bold transition-colors ${theme === 'dark' ? 'text-gray-300 group-hover:text-white' : 'text-gray-600 group-hover:text-emerald-600'}`}>{insight}</p>
                                </motion.div>
                              )) : (
                                <div className="py-20 text-center opacity-30 italic text-gray-500">Generating strategic queries...</div>
                              )}
                            </div>
                         </section>

                         <section className={`rounded-[40px] p-10 border overflow-hidden flex flex-col max-h-[500px] ${theme === 'dark' ? 'bg-[#0D0E10] border-white/5' : 'bg-white border-gray-200 shadow-xl'}`}>
                            <div className="flex items-center justify-between mb-8">
                               <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                 <TableIcon size={16} /> Asset Preview ({uploadedData.length} entities)
                               </h3>
                               <button 
                                 onClick={() => { setUploadedData([]); setUploadInsights([]); setUploadFileName(''); }}
                                 className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-2 text-[10px] font-black uppercase"
                               >
                                 <Trash2 size={12} /> Wipe Buffer
                               </button>
                            </div>
                            <div className="flex-1 overflow-auto custom-scrollbar">
                              <table className="w-full text-left border-collapse">
                                <thead className={`sticky top-0 backdrop-blur-md ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                                  <tr>
                                    {Object.keys(uploadedData[0] || {}).map(key => (
                                      <th key={key} className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">{key}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {uploadedData.slice(0, 20).map((row, i) => (
                                    <tr key={i} className={`transition-colors group ${theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-emerald-50/50'}`}>
                                      {Object.values(row).map((val: any, j) => (
                                        <td key={j} className={`px-6 py-4 text-xs font-medium border-none ${theme === 'dark' ? 'text-gray-400 group-hover:text-white' : 'text-gray-600 group-hover:text-emerald-600'}`}>{val?.toString()}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {uploadedData.length > 20 && (
                                <div className="p-4 text-center text-[10px] font-black text-gray-700 uppercase tracking-widest">
                                  + {uploadedData.length - 20} more rows in neural buffer
                                </div>
                              )}
                            </div>
                         </section>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {activeTab === 'evaluation' && (
                <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="space-y-10 pb-20"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className={`text-3xl font-black tracking-tight leading-none mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Neural Synthesis Report</h2>
                      <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Query Archive & Strategic Notes</p>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          const userMsg: ChatMessage = {
                            id: 'manifesto-' + Date.now(),
                            role: 'assistant',
                            content: "TECHNICAL MANIFESTO: This system is a high-frequency NL-to-SQL conduit. It bridges Natural Language with Relational Data using LLM-driven synthesis. \n\nCONNECTION TO ML: \n1. NLP-to-DML: Translates intent into valid SQL logic (Gemini 3 Flash). \n2. Cognitive Analysis: Post-processing query results for structural insights. \n3. Autonomous Prediction: Pre-computing strategic questions (Neural Pulse).",
                            sql: "-- System Genesis Protocol --",
                            timestamp: Date.now()
                          };
                          setMessages(prev => [...prev, userMsg]);
                          setActiveTab('query');
                        }}
                        className={`flex items-center gap-2 px-6 py-3 border rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl ${theme === 'dark' ? 'bg-white/[0.05] text-gray-400 border-white/5 hover:text-white' : 'bg-white text-emerald-600 border-gray-200 hover:bg-emerald-50'}`}
                      >
                        <Info size={14} /> Project Specs
                      </button>
                      <button 
                        onClick={() => {
                          const reportContent = messages
                            .filter(m => m.role === 'assistant' && m.results)
                            .map(m => {
                              const userQ = messages.find(um => um.role === 'user' && um.timestamp < m.timestamp)?.content || 'N/A';
                              return `## Query: ${userQ}\n\n**Analysis:** ${m.content}\n\n**SQL:**\n\`\`\`sql\n${m.sql}\n\`\`\`\n\n**Notes:** ${queryNotes[m.id] || 'None'}\n\n---\n`;
                            }).join('\n');
                          const blob = new Blob([reportContent], { type: 'text/markdown' });
                          const link = document.createElement('a');
                          link.href = URL.createObjectURL(blob);
                          link.download = `neural_synthesis_report_${Date.now()}.md`;
                          link.click();
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-500/30"
                      >
                        <Download size={14} /> Download MD Report
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8">
                    {messages.filter(m => m.role === 'assistant' && m.sql).length === 0 ? (
                      <div className={`border rounded-[40px] p-20 flex flex-col items-center justify-center text-center space-y-4 ${theme === 'dark' ? 'bg-[#161922] border-white/5' : 'bg-white border-gray-100 shadow-xl'}`}>
                        <FileStack size={48} className={`${theme === 'dark' ? 'text-gray-700' : 'text-gray-300'} opacity-50`} />
                        <p className={`font-black uppercase tracking-widest text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>No strategic queries synchronized yet.</p>
                      </div>
                    ) : (
                      messages.filter(m => m.role === 'assistant' && m.sql).map((msg, i) => {
                        const userQuery = messages.find(um => um.role === 'user' && um.id.substring(0, 5) === msg.id.substring(0, 5) || (um.timestamp < msg.timestamp && um.role === 'user'))?.content;
                        return (
                          <motion.div 
                            key={msg.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`${theme === 'dark' ? 'bg-[#161922] border-white/5' : 'bg-white border-gray-200 shadow-2xl'} rounded-[40px] border p-10 space-y-6 relative group overflow-hidden`}
                          >
                            <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none transition-opacity group-hover:opacity-[0.05]">
                               <FileCode2 size={120} />
                            </div>
                            
                            <div className="flex items-start justify-between">
                              <div className="space-y-4 flex-1">
                                <div className="flex items-center gap-3">
                                  <span className={`w-10 h-10 rounded-2xl flex items-center justify-center border font-black text-xs ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                    {i + 1}
                                  </span>
                                  <h3 className={`text-xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{userQuery}</h3>
                                </div>
                                <p className={`text-xs leading-relaxed font-medium p-4 rounded-2xl border italic ${theme === 'dark' ? 'text-gray-400 bg-white/[0.02] border-white/5' : 'text-gray-600 bg-gray-50 border-gray-100'}`}>
                                  {msg.content}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-lime-400' : 'text-lime-600'}`}>
                                  <Code size={14} /> Logic Kernel
                                </div>
                                <div className={`p-6 rounded-3xl border shadow-inner ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-900 border-gray-800'}`}>
                                  <code className={`text-[11px] font-mono break-all leading-loose ${theme === 'dark' ? 'text-lime-300' : 'text-lime-900/80'}`}>
                                    {msg.sql}
                                  </code>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    <Edit size={14} /> Strategic Notes
                                  </div>
                                  <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Draft Mode</span>
                                </div>
                                <textarea 
                                  value={queryNotes[msg.id] || ''}
                                  onChange={(e) => setQueryNotes(prev => ({ ...prev, [msg.id]: e.target.value }))}
                                  placeholder="Annotate findings, pivot points, or executive summaries..."
                                  className={`w-full h-32 border rounded-3xl p-6 text-xs font-medium transition-all resize-none outline-none focus:ring-2 focus:ring-emerald-500/20 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5 text-gray-300 placeholder:text-gray-700' : 'bg-white border-gray-200 text-gray-700 placeholder:text-gray-300'}`}
                                />
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* Floating Suggestion Help Tooltip (Visual flair) */}
        <div className="fixed bottom-10 right-10 z-50">
           <motion.div 
             whileHover={{ scale: 1.1, rotate: 10 }}
             className="bg-white p-4 rounded-[22px] shadow-[0_20px_50px_rgba(255,255,255,0.2)] text-indigo-600 cursor-pointer border border-white/20"
             title="Need system assistance?"
           >
             <Sparkles size={28} className="animate-pulse" />
           </motion.div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}} />
    </div>
  );
}