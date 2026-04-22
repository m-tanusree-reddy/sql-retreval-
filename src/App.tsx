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
  Key
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

  const fetchSchema = async (newTableName?: string) => {
    try {
      const res = await fetch('/api/schema');
      const data = await res.json();
      setSchema(data);
      
      // If a new table was uploaded, prioritize it in the viewer
      if (newTableName) {
        setSelectedViewerTable(newTableName);
        fetchTableData(newTableName);
      } else if (data.length > 0 && !selectedViewerTable) {
        // Default to first table if nothing selected
        setSelectedViewerTable(data[0].tableName);
        fetchTableData(data[0].tableName);
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

  const handleInsert = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/data/${insertTargetTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insertFormData)
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully inserted! New ID: ${data.id}`);
        setInsertFormData({});
        fetchSchema();
      } else {
        alert('Insertion failed: ' + data.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
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
          fetchSchema(resJson.tableName); // Refresh and select the new table
          setActiveTab('viewer'); // Switch to viewer immediately as requested
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
    <div className="min-h-screen bg-[#0F1115] text-white font-sans flex text-sm overflow-hidden selection:bg-indigo-500/30">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse delay-1000" />
      </div>

      {/* Sidebar - History & Config */}
      <aside className="w-80 bg-[#161922] border-r border-white/5 flex flex-col p-6 hidden xl:flex z-50">
        <div className="flex items-center gap-3 mb-10 group">
          <div className="bg-gradient-to-tr from-indigo-500 to-fuchsia-500 p-2.5 rounded-2xl text-white shadow-2xl shadow-indigo-500/20 group-hover:scale-110 transition-transform cursor-pointer">
            <Zap size={24} fill="white" className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">SQL Genie</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Enterprise Intelligence</p>
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
            <div className="flex items-center gap-2 text-indigo-400">
               <Cpu size={12} />
               <span>MODEL</span>
            </div>
            <span className="text-gray-300">G-PRO 3.1</span>
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
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-indigo-300 placeholder:text-gray-700 outline-none focus:border-indigo-500/50 transition-all font-mono"
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
        <header className="h-20 bg-[#161922]/50 backdrop-blur-3xl border-b border-white/5 flex items-center justify-between px-10 z-10 sticky top-0">
          <nav className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5">
            {(['query', 'viewer', 'schema', 'data', 'evaluation'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-xl text-[11px] font-black tracking-[0.1em] uppercase transition-all flex items-center gap-2.5 ${
                  activeTab === tab 
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] ring-2 ring-white/10' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
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
            <div className="flex items-center gap-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
              <span className="flex items-center gap-2 bg-indigo-500/5 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/20 shadow-inner"><TableIcon size={12} /> {schema.length} Entities</span>
              <span className="flex items-center gap-2 bg-emerald-500/5 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-inner"><Clock size={12} /> {executionTime || '0.00'}ms</span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-fuchsia-600 p-0.5 shadow-2xl shadow-indigo-500/20 cursor-pointer hover:scale-110 active:scale-95 transition-all">
              <div className="w-full h-full rounded-[14px] bg-[#0F1115] flex items-center justify-center font-bold text-xs text-white">
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
                    <section className="bg-[#161922] rounded-[32px] border border-white/5 p-8 flex-1 shadow-2xl overflow-hidden flex flex-col">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                          <Lightbulb size={20} />
                        </div>
                        <div>
                          <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Neural Pulse</h3>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Autonomous Insights</p>
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
                            className="w-full text-left p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all group"
                          >
                            <p className="text-[11px] font-bold text-gray-400 group-hover:text-white leading-relaxed">{insight}</p>
                          </motion.button>
                        )) : (
                           <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4 px-4">
                              <Cpu size={32} />
                              <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Awaiting Data Upload<br/>for Pulse Sync</p>
                           </div>
                        )}
                      </div>
                    </section>
                    
                    <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[32px] p-6 text-white shadow-2xl relative overflow-hidden group flex-shrink-0">
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
                  <div className="flex-1 flex flex-col bg-[#161922] rounded-[40px] shadow-3xl border border-white/5 overflow-hidden">
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-40 space-y-6">
                          <Bot size={64} className="text-indigo-400 animate-pulse" />
                          <div className="text-center space-y-2">
                             <h3 className="text-xl font-black text-white uppercase tracking-tight">Neural Sync Ready</h3>
                             <p className="text-xs text-gray-500 font-medium uppercase tracking-[0.2em]">Awaiting high-dimensional instructions...</p>
                          </div>
                          
                          <div className="w-full max-w-md space-y-4 pt-10">
                             <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-center">Suggested Starting Protocols</p>
                             <div className="grid grid-cols-1 gap-2">
                                <Suggestions onSelect={(text) => handleProcess(text)} schema={schema} />
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
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/20'}`}>
                                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                </div>
                                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                  {msg.role === 'user' ? 'Authorized Client' : 'Neural System'}
                                </span>
                              </div>
                              
                              <div className={`max-w-[85%] p-6 rounded-[28px] ${
                                msg.role === 'user' 
                                  ? 'bg-indigo-500 text-white rounded-tr-none shadow-xl shadow-indigo-500/10' 
                                  : 'bg-[#0D0E10] text-gray-300 border border-white/5 rounded-tl-none shadow-2xl'
                              }`}>
                                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                
                                {msg.results && (
                                  <div className="mt-8 space-y-6">
                                    <div className="p-1 bg-black/40 rounded-3xl border border-white/5">
                                       <Visualizer 
                                          data={msg.results} 
                                          config={msg.analysis?.chartConfig} 
                                          defaultMode={msg.analysis?.visualization} 
                                       />
                                    </div>
                                    
                                    {msg.sql && (
                                      <div className="p-4 bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-2xl">
                                         <div className="flex items-center gap-2 mb-2 text-[9px] font-black text-fuchsia-400 uppercase tracking-widest">
                                            <FileCode2 size={12} /> Execution Logic
                                         </div>
                                         <code className="text-[11px] font-mono text-fuchsia-300/80 break-all">{msg.sql}</code>
                                      </div>
                                    )}

                                    {msg.analysis?.suggestedQuestions && (
                                      <div className="space-y-4 pt-4 border-t border-white/5">
                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                          <Sparkles size={12} /> Discovered Follow-ups
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {msg.analysis.suggestedQuestions.map((q: string, i: number) => (
                                            <button 
                                              key={i} 
                                              onClick={() => handleProcess(q)}
                                              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[10px] font-bold text-gray-400 hover:text-white transition-all text-left"
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

                    {/* Chat Input */}
                    <div className="p-8 bg-[#1B1E26] border-t border-white/5 flex gap-4">
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
                            className="w-full bg-[#0D0E10] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white placeholder:text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner"
                         />
                         <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Sparkles size={16} className="text-gray-700" />
                         </div>
                       </div>
                       <button 
                          onClick={() => handleProcess()}
                          disabled={loading || !query.trim()}
                          className="w-14 h-14 rounded-2xl bg-white hover:bg-gray-100 disabled:bg-gray-800 disabled:text-gray-600 flex items-center justify-center transition-all shadow-xl active:scale-95"
                       >
                          {loading ? <RefreshCw className="animate-spin text-[#0F1115]" size={20} /> : <Send size={20} className="text-[#0F1115]" />}
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
                    <div className="w-72 bg-[#161922] rounded-[32px] border border-white/5 p-6 space-y-6 overflow-y-auto custom-scrollbar">
                      <div className="flex items-center gap-3 px-2">
                        <Database size={18} className="text-indigo-400" />
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Semantic Model</h3>
                      </div>
                      <div className="space-y-1">
                        {schema.map(table => (
                          <button
                            key={table.tableName}
                            onClick={() => { setSelectedViewerTable(table.tableName); fetchTableData(table.tableName); }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${
                              selectedViewerTable === table.tableName 
                                ? 'bg-indigo-500/10 text-white border border-indigo-500/30 ring-1 ring-indigo-500/10' 
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <span className="truncate">{table.tableName}</span>
                            <ChevronRight size={14} className={`${selectedViewerTable === table.tableName ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'} transition-opacity`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Data Canvas */}
                    <div className="flex-1 bg-[#0D0E10] rounded-[40px] border border-white/5 overflow-hidden flex flex-col shadow-2xl">
                      <div className="px-10 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <div className="flex items-center gap-4">
                          <h2 className="text-xl font-black text-white tracking-tight uppercase">{selectedViewerTable}</h2>
                          <span className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                            {viewerData.length} Records Loaded
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                           <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 border border-white/5 transition-all">
                             <Filter size={16} />
                           </button>
                           <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 border border-white/5 transition-all">
                             <Download size={16} />
                           </button>
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-auto custom-scrollbar">
                        {viewerData.length > 0 ? (
                          <table className="w-full text-left border-collapse table-auto min-w-full">
                            <thead className="bg-[#161922] sticky top-0 z-10">
                              <tr>
                                {Object.keys(viewerData[0]).map(key => (
                                  <th key={key} className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/5 whitespace-nowrap bg-[#161922]">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {viewerData.map((row, i) => (
                                <tr key={i} className="hover:bg-white/[0.03] transition-colors group">
                                  {Object.values(row).map((val: any, j) => (
                                    <td key={j} className="px-8 py-4 text-xs font-medium text-gray-400 group-hover:text-white border-none whitespace-nowrap">
                                      {val === null ? <span className="text-gray-800 italic">null</span> : val?.toString()}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-4 opacity-50">
                            <Layers size={64} className="stroke-1" />
                            <p className="text-sm font-black uppercase tracking-widest">Select an entity to initialize view</p>
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
                   className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                  {schema.map((table, i) => (
                    <motion.div 
                      key={table.tableName}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-[#161922] rounded-[40px] border border-white/5 shadow-2xl hover:border-indigo-500/30 transition-all p-8 group"
                    >
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/5 rounded-2xl text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/10 transition-all">
                            <TableIcon size={20} />
                          </div>
                          <h3 className="font-black text-lg text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{table.tableName}</h3>
                        </div>
                        <button 
                          onClick={() => { setSelectedViewerTable(table.tableName); fetchTableData(table.tableName); setActiveTab('viewer'); }}
                          className="p-2.5 bg-white/5 rounded-xl text-gray-500 hover:text-white hover:bg-indigo-500/20 transition-all opacity-0 group-hover:opacity-100"
                          title="View Data"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {table.columns.map((col) => (
                          <div key={col.name} className="flex items-center justify-between py-3 text-[11px] group/item border-b border-white/5 last:border-0 hover:bg-white/[0.03] rounded-[14px] px-3 -mx-3 transition-all">
                            <span className="font-bold text-gray-400 group-hover/item:text-white">{col.name}</span>
                            <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">{col.type}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'data' && (
                <motion.div 
                   initial={{ opacity: 0, y: 50 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="space-y-10"
                >
                  <section className="bg-gradient-to-br from-[#161922] to-[#0F1115] rounded-[50px] p-12 border border-white/10 shadow-3xl text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
                    <div className="inline-flex p-6 bg-indigo-500/10 rounded-[32px] text-indigo-400 mb-8 border border-indigo-500/20 shadow-[0_0_50px_rgba(79,70,229,0.1)]">
                      <Upload size={48} className="animate-bounce" />
                    </div>
                    <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Intelligence Importer</h2>
                    <p className="text-lg text-gray-500 font-medium max-w-xl mx-auto mb-10">Upload any CSV or Excel entity to instantly reconfigure the engine schema and generate neural insights.</p>
                    
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
                         className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl border border-white/5 transition-all flex items-center gap-2.5 text-xs font-black uppercase tracking-widest"
                       >
                         <Download size={14} /> Download 70-Record Sample
                       </button>
                    </div>

                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="max-w-2xl mx-auto border-3 border-dashed border-white/10 rounded-[40px] p-12 hover:border-indigo-500/50 hover:bg-white/[0.02] transition-all cursor-pointer group"
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        accept=".csv, .xlsx, .xls"
                        onChange={handleFileUpload} 
                      />
                      <FileText size={40} className="mx-auto text-gray-700 mb-4 group-hover:text-indigo-500 transition-colors" />
                      <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Drop Strategic Asset or Browse Files</p>
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
                         <section className="bg-[#161922] rounded-[40px] p-10 border border-white/5 space-y-8">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                                <Lightbulb size={24} />
                              </div>
                              <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">Neural Pulse</h3>
                                <p className="text-xs text-gray-500 font-medium">Discovered insights based on uploaded entity schema</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              {uploadInsights.length > 0 ? uploadInsights.map((insight, i) => (
                                <motion.div 
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.1 }}
                                  key={i}
                                  onClick={() => { handleProcess(insight); setActiveTab('query'); }}
                                  className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all cursor-pointer group"
                                >
                                  <p className="text-sm font-bold text-gray-300 group-hover:text-white">{insight}</p>
                                </motion.div>
                              )) : (
                                <div className="py-20 text-center opacity-30 italic text-gray-500">Generating strategic queries...</div>
                              )}
                            </div>
                         </section>

                         <section className="bg-[#0D0E10] rounded-[40px] p-10 border border-white/5 overflow-hidden flex flex-col max-h-[500px]">
                            <div className="flex items-center justify-between mb-8">
                               <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-3">
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
                                <thead className="bg-white/5 sticky top-0 backdrop-blur-md">
                                  <tr>
                                    {Object.keys(uploadedData[0] || {}).map(key => (
                                      <th key={key} className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">{key}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {uploadedData.slice(0, 20).map((row, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                      {Object.values(row).map((val: any, j) => (
                                        <td key={j} className="px-6 py-4 text-xs font-medium text-gray-400 group-hover:text-white border-none">{val?.toString()}</td>
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
                   className="space-y-10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-2">Neural Synthesis Report</h2>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Query Archive & Strategic Notes</p>
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
                        className="flex items-center gap-2 px-6 py-3 bg-white/[0.05] text-gray-400 border border-white/5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-white transition-all shadow-xl"
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
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20"
                      >
                        <Download size={14} /> Download MD Report
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8">
                    {messages.filter(m => m.role === 'assistant' && m.sql).length === 0 ? (
                      <div className="bg-[#161922] border border-white/5 rounded-[40px] p-20 flex flex-col items-center justify-center text-center space-y-4">
                        <FileStack size={48} className="text-gray-700 opacity-50" />
                        <p className="text-gray-600 font-black uppercase tracking-widest text-xs">No strategic queries synchronized yet.</p>
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
                            className="bg-[#161922] rounded-[40px] border border-white/5 p-10 space-y-6 relative group overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
                               <FileCode2 size={120} />
                            </div>
                            
                            <div className="flex items-start justify-between">
                              <div className="space-y-4 flex-1">
                                <div className="flex items-center gap-3">
                                  <span className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 font-black text-xs">
                                    {i + 1}
                                  </span>
                                  <h3 className="text-xl font-black text-white tracking-tight">{userQuery}</h3>
                                </div>
                                <p className="text-xs text-gray-400 leading-relaxed font-medium bg-white/[0.02] p-4 rounded-2xl border border-white/5 italic">
                                  {msg.content}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">
                                  <Code size={14} /> Logic Kernel
                                </div>
                                <div className="p-6 bg-black/40 rounded-3xl border border-white/5">
                                  <code className="text-[11px] font-mono text-fuchsia-200/70 break-all leading-loose">
                                    {msg.sql}
                                  </code>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                    <Edit size={14} /> Strategic Notes
                                  </div>
                                  <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Draft Mode</span>
                                </div>
                                <textarea 
                                  value={queryNotes[msg.id] || ''}
                                  onChange={(e) => setQueryNotes(prev => ({ ...prev, [msg.id]: e.target.value }))}
                                  placeholder="Annotate findings, pivot points, or executive summaries..."
                                  className="w-full h-32 bg-white/[0.02] border border-white/5 rounded-3xl p-6 text-xs text-gray-300 font-medium placeholder:text-gray-700 focus:border-indigo-500 transition-all resize-none outline-none"
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