import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History as HistoryIcon, Trash2, ArrowRight } from 'lucide-react';

interface HistoryItem {
  query: string;
  sql: string;
  id: string;
  timestamp: number;
}

interface HistorySidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

export function HistorySidebar({ history, onSelect, onClear }: HistorySidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <HistoryIcon size={14} className="text-indigo-400" /> Neural Logs
        </h3>
        {history.length > 0 && (
          <button 
            onClick={onClear}
            className="text-gray-500 hover:text-red-400 transition-colors p-1"
            title="Clear Neural History"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        <AnimatePresence>
          {history.length === 0 ? (
            <div className="text-center py-20 text-gray-600 text-[10px] font-black uppercase tracking-widest opacity-30 italic">
              Awaiting Inferences
            </div>
          ) : (
            history.map((item) => (
              <motion.div
                key={item.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="group relative p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all cursor-pointer overflow-hidden"
                onClick={() => onSelect(item)}
              >
                <p className="text-[11px] font-bold text-gray-400 group-hover:text-white line-clamp-2 pr-6 transition-colors leading-relaxed">{item.query}</p>
                <div className="mt-3 flex items-center justify-between text-[9px] text-gray-500 font-mono uppercase tracking-widest">
                  <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-all text-indigo-400 transform translate-x-[-4px] group-hover:translate-x-0" />
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
