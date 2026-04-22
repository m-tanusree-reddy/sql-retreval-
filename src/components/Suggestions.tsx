import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, BarChart2, Database, Table } from 'lucide-react';

interface Schema {
  tableName: string;
  columns: { name: string; type: string }[];
}

interface SuggestionsProps {
  onSelect: (text: string) => void;
  schema: Schema[];
}

export function Suggestions({ onSelect, schema }: SuggestionsProps) {
  const getDynamicSuggestions = () => {
    if (!schema || schema.length === 0) return [
      { text: "List all available tables", icon: <Database size={14} /> },
      { text: "Show schema of entire database", icon: <Table size={14} /> },
    ];

    const firstTable = schema[0];
    const suggestions = [
      { text: `Show first 10 records from ${firstTable.tableName}`, icon: <Table size={14} /> },
      { text: `Count total records in ${firstTable.tableName}`, icon: <Sparkles size={14} /> },
    ];

    if (firstTable.columns.length > 1) {
      const col1 = firstTable.columns[0].name;
      const col2 = firstTable.columns[1].name;
      suggestions.push({ text: `Group ${firstTable.tableName} by ${col1}`, icon: <BarChart2 size={14} /> });
    }

    // Add some common ones
    suggestions.push({ text: "Find outliers in recent transactions", icon: <Sparkles size={14} /> });
    
    return suggestions;
  };

  const currentSuggestions = getDynamicSuggestions();

  return (
    <div className="flex flex-wrap gap-3">
      {currentSuggestions.map((s, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
          onClick={() => onSelect(s.text)}
          className="flex items-center gap-2.5 px-4 py-2 bg-white/[0.03] text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-white transition-all cursor-pointer whitespace-nowrap group"
        >
          <span className="text-gray-600 group-hover:text-indigo-400 transition-colors">{s.icon}</span>
          {s.text}
        </motion.button>
      ))}
    </div>
  );
}
