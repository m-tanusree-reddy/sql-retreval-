import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Download, Table, BarChart2, LineChart as LineChartIcon, PieChart as PieChartIcon, LayoutDashboard, Star } from 'lucide-react';

interface VisualizerProps {
  data: any[];
  config?: { xAxis: string; yAxis: string };
  defaultMode?: 'bar' | 'line' | 'pie' | 'table' | 'dashboard';
}

const COLORS = ['#10b981', '#84cc16', '#22c55e', '#a855f7', '#06b6d4', '#f59e0b', '#4ade80'];

export function Visualizer({ data, config, defaultMode = 'table' }: VisualizerProps) {
  const [mode, setMode] = React.useState<string>(defaultMode);
  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  if (!data || data.length === 0) return null;

  const xAxis = config?.xAxis || Object.keys(data[0])[0];
  const yAxis = config?.yAxis || Object.keys(data[0])[1];
  
  // Basic stats for dashboard
  const numericValues = data.map(d => Number(d[yAxis])).filter(v => !isNaN(v));
  const avg = numericValues.length ? (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2) : 'N/A';
  const sum = numericValues.reduce((a, b) => a + b, 0).toFixed(0);
  const max = numericValues.length ? Math.max(...numericValues).toFixed(0) : 'N/A';

  const exportToCSV = () => {
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => 
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(',')
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "neural_data_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4">
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
          <button 
            onClick={() => setMode('table')}
            className={`p-2 rounded-lg transition-all ${mode === 'table' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
          >
            <Table size={16} />
          </button>
          <button 
            onClick={() => setMode('bar')}
            className={`p-2 rounded-lg transition-all ${mode === 'bar' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
          >
            <BarChart2 size={16} />
          </button>
          <button 
            onClick={() => setMode('line')}
            className={`p-2 rounded-lg transition-all ${mode === 'line' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
          >
            <LineChartIcon size={16} />
          </button>
          <button 
            onClick={() => setMode('pie')}
            className={`p-2 rounded-lg transition-all ${mode === 'pie' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
          >
            <PieChartIcon size={16} />
          </button>
          <button 
            onClick={() => setMode('dashboard')}
            className={`p-2 rounded-lg transition-all ${mode === 'dashboard' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
          >
            <LayoutDashboard size={16} />
          </button>
        </div>
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all active:scale-95 shadow-sm"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {mode === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-emerald-500/5 to-lime-500/5 dark:from-white/5 dark:to-white/5 border border-emerald-500/10 dark:border-white/5 rounded-3xl p-6 relative overflow-hidden group shadow-sm">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Star size={48} />
                </div>
                <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Total Volume</p>
                <div className="text-3xl font-black text-emerald-600 dark:text-white tracking-tighter">{sum}</div>
              </div>
              <div className="bg-gradient-to-br from-lime-500/5 to-emerald-500/5 dark:from-white/5 dark:to-white/5 border border-lime-500/10 dark:border-white/5 rounded-3xl p-6 relative overflow-hidden group shadow-sm">
                <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Arithmetic Mean</p>
                <div className="text-3xl font-black text-lime-600 dark:text-indigo-400 tracking-tighter">{avg}</div>
              </div>
              <div className="bg-gradient-to-br from-teal-500/5 to-emerald-500/5 dark:from-white/5 dark:to-white/5 border border-emerald-500/10 dark:border-white/5 rounded-3xl p-6 relative overflow-hidden group shadow-sm">
                <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Peak Threshold</p>
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{max}</div>
              </div>
            </div>

            <div className="bg-white/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-[32px] p-8 h-[350px] shadow-inner">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#00000005" />
                    <XAxis dataKey={xAxis} stroke="#9ca3af" fontSize={10} tick={{ fill: '#9ca3af' }} />
                    <YAxis stroke="#9ca3af" fontSize={10} tick={{ fill: '#9ca3af' }} />
                    <Tooltip cursor={{ fill: '#00000005' }} contentStyle={{ backgroundColor: theme === 'dark' ? '#161922' : '#fff', border: `1px solid ${theme === 'dark' ? '#ffffff10' : '#e5e7eb'}`, borderRadius: '12px', fontSize: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey={yAxis} fill="url(#emeraldGradient)" radius={[6, 6, 0, 0]} />
                    <defs>
                      <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#84cc16" />
                      </linearGradient>
                    </defs>
                  </BarChart>
               </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-[#1B1E26]/50 rounded-[32px] border border-gray-100 dark:border-white/5 overflow-hidden shadow-xl">
               <div className="px-8 py-4 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Relational Grid</span>
               </div>
               <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      {Object.keys(data[0]).map((key) => (
                        <th key={key} className="px-8 py-4 text-[9px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest border-b border-gray-100 dark:border-white/5 whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                    {data.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-emerald-500/5 transition-all group">
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-8 py-3 text-[10px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {val?.toString() || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
               </div>
            </div>
          </div>
        )}

        {mode === 'table' && (
          <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl">
            <table className="w-full text-left border-collapse min-w-full">
              <thead className="bg-gray-50 dark:bg-[#1B1E26] sticky top-0 z-10">
                <tr>
                  {Object.keys(data[0]).map((key) => (
                    <th key={key} className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-white/5">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-emerald-500/5 transition-all group">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className={`px-8 py-4 text-xs font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {val?.toString() || <span className="opacity-20 italic">null</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mode === 'bar' && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#ffffff10' : '#00000005'} />
              <XAxis dataKey={xAxis} stroke="#6b7280" fontSize={10} tick={{ fill: '#6b7280' }} />
              <YAxis stroke="#6b7280" fontSize={10} tick={{ fill: '#6b7280' }} />
              <Tooltip cursor={{ fill: theme === 'dark' ? '#ffffff05' : '#00000005' }} contentStyle={{ backgroundColor: theme === 'dark' ? '#161922' : '#fff', border: `1px solid ${theme === 'dark' ? '#ffffff10' : '#e5e7eb'}`, borderRadius: '12px' }} />
              <Bar dataKey={yAxis} fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {mode === 'line' && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#ffffff10' : '#00000005'} />
              <XAxis dataKey={xAxis} stroke="#6b7280" fontSize={10} tick={{ fill: '#6b7280' }} />
              <YAxis stroke="#6b7280" fontSize={10} tick={{ fill: '#6b7280' }} />
              <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#161922' : '#fff', border: `1px solid ${theme === 'dark' ? '#ffffff10' : '#e5e7eb'}`, borderRadius: '12px' }} />
              <Line type="monotone" dataKey={yAxis} stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {mode === 'pie' && (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                dataKey={yAxis}
                nameKey={xAxis}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={{ fill: '#9ca3af', fontSize: 10 }}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#161922' : '#fff', border: `1px solid ${theme === 'dark' ? '#ffffff10' : '#e5e7eb'}`, borderRadius: '12px' }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
