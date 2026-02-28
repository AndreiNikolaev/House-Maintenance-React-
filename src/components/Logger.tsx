
import React from 'react';
import { LogEntry } from '../services/logger';
import { Terminal, ChevronDown, ChevronUp, Clock, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoggerProps {
  logs: LogEntry[];
}

export const Logger: React.FC<LoggerProps> = ({ logs }) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-300 font-mono text-xs overflow-hidden border-t border-zinc-800">
      <div className="flex items-center justify-between p-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-500" />
          <span className="font-bold uppercase tracking-wider">API Traffic Monitor</span>
        </div>
        <span className="text-[10px] opacity-50">{logs.length} entries</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 py-10">
            <Globe size={32} className="mb-2" />
            <p>Waiting for API requests...</p>
          </div>
        )}
        
        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border rounded-lg overflow-hidden ${
                log.type === 'request' ? 'border-blue-900/50 bg-blue-950/20' :
                log.type === 'response' ? 'border-emerald-900/50 bg-emerald-950/20' :
                'border-red-900/50 bg-red-950/20'
              }`}
            >
              <button
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="w-full flex items-center justify-between p-2 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    log.type === 'request' ? 'bg-blue-500 text-white' :
                    log.type === 'response' ? 'bg-emerald-500 text-white' :
                    'bg-red-500 text-white'
                  }`}>
                    {log.type}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-bold text-zinc-100">{log.service}</span>
                    <span className="opacity-50 text-[10px] truncate max-w-[200px]">{log.url}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-50">
                  <Clock size={10} />
                  <span>{log.timestamp.toLocaleTimeString()}</span>
                  {expandedId === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>

              {expandedId === log.id && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="p-3 bg-black/40 border-t border-white/5 overflow-x-auto"
                >
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
