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

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#ef4444', '#f59e0b', '#10b981'];

export function Visualizer({ data, config, defaultMode = 'table' }: VisualizerProps) {
  const [mode, setMode] = React.useState<string>(defaultMode);

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
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
          <button 
            onClick={() => setMode('table')}
            className={`p-2 rounded-lg transition-all ${mode === 'table' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Table size={16} />
          </button>
          <button 
            onClick={() => setMode('bar')}
            className={`p-2 rounded-lg transition-all ${mode === 'bar' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <BarChart2 size={16} />
          </button>
          <button 
            onClick={() => setMode('line')}
            className={`p-2 rounded-lg transition-all ${mode === 'line' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <LineChartIcon size={16} />
          </button>
          <button 
            onClick={() => setMode('pie')}
            className={`p-2 rounded-lg transition-all ${mode === 'pie' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <PieChartIcon size={16} />
          </button>
          <button 
            onClick={() => setMode('dashboard')}
            className={`p-2 rounded-lg transition-all ${mode === 'dashboard' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <LayoutDashboard size={16} />
          </button>
        </div>
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all active:scale-95"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {mode === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Star size={48} />
                </div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Total Volume</p>
                <div className="text-3xl font-black text-white tracking-tighter">{sum}</div>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Arithmetic Mean</p>
                <div className="text-3xl font-black text-indigo-400 tracking-tighter">{avg}</div>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Peak Threshold</p>
                <div className="text-3xl font-black text-emerald-400 tracking-tighter">{max}</div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-8 h-[350px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                    <XAxis dataKey={xAxis} stroke="#4b5563" fontSize={10} tick={{ fill: '#4b5563' }} />
                    <YAxis stroke="#4b5563" fontSize={10} tick={{ fill: '#4b5563' }} />
                    <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#161922', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey={yAxis} fill="url(#indigoGradient)" radius={[6, 6, 0, 0]} />
                    <defs>
                      <linearGradient id="indigoGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#4338ca" />
                      </linearGradient>
                    </defs>
                  </BarChart>
               </ResponsiveContainer>
            </div>

            <div className="bg-[#1B1E26]/50 rounded-[32px] border border-white/5 overflow-hidden">
               <div className="px-8 py-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Relational Grid</span>
               </div>
               <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      {Object.keys(data[0]).map((key) => (
                        <th key={key} className="px-8 py-4 text-[9px] font-black text-gray-600 uppercase tracking-widest border-b border-white/5 whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-indigo-500/5 transition-all">
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-8 py-3 text-[10px] font-medium text-gray-400">
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
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#1B1E26] sticky top-0">
                <tr>
                  {Object.keys(data[0]).map((key) => (
                    <th key={key} className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-indigo-500/5 transition-all">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="px-8 py-4 text-xs font-medium text-gray-400">
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
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey={xAxis} stroke="#6b7280" fontSize={10} tick={{ fill: '#6b7280' }} />
              <YAxis stroke="#6b7280" fontSize={10} tick={{ fill: '#6b7280' }} />
              <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#161922', border: '1px solid #ffffff10', borderRadius: '12px' }} />
              <Bar dataKey={yAxis} fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {mode === 'line' && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey={xAxis} stroke="#6b7280" fontSize={10} tick={{ fill: '#6b7280' }} />
              <YAxis stroke="#6b7280" fontSize={10} tick={{ fill: '#6b7280' }} />
              <Tooltip contentStyle={{ backgroundColor: '#161922', border: '1px solid #ffffff10', borderRadius: '12px' }} />
              <Line type="monotone" dataKey={yAxis} stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
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
              <Tooltip contentStyle={{ backgroundColor: '#161922', border: '1px solid #ffffff10', borderRadius: '12px' }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
