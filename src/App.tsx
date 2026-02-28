
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Terminal, 
  Settings, 
  Languages, 
  ArrowRightLeft, 
  Send, 
  Copy, 
  Trash2, 
  Activity,
  ChevronRight,
  Info,
  AlertCircle
} from 'lucide-react';
import { yandexService } from './services/yandexService';
import { apiLogger, LogEntry } from './services/logger';
import { Logger } from './components/Logger';

type Tab = 'translate' | 'logs' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('translate');
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = apiLogger.subscribe(setLogs);
    return () => unsubscribe();
  }, []);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const result = await yandexService.translate(inputText, 'en-ru');
      setTranslatedText(result.text?.[0] || '');
    } catch (err: any) {
      setError(err.message || 'Translation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const clearAll = () => {
    setInputText('');
    setTranslatedText('');
    setError(null);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans max-w-md mx-auto border-x border-zinc-800 relative overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Globe size={18} className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Yandex Connect</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 rounded-full border border-zinc-700">
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              {isLoading ? 'Active' : 'Standby'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {activeTab === 'translate' && (
            <motion.div
              key="translate"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 space-y-6"
            >
              {/* Language Selector */}
              <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-2xl border border-zinc-800 shadow-sm">
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[10px] uppercase font-bold opacity-40 mb-1">Source</span>
                  <span className="font-semibold text-sm">English</span>
                </div>
                <div className="p-2 bg-zinc-800 rounded-full border border-zinc-700">
                  <ArrowRightLeft size={16} className="text-emerald-500" />
                </div>
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[10px] uppercase font-bold opacity-40 mb-1">Target</span>
                  <span className="font-semibold text-sm">Russian</span>
                </div>
              </div>

              {/* Input Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">Input Text</label>
                  {inputText && (
                    <button onClick={clearAll} className="text-xs text-red-500 font-bold hover:opacity-80 transition-opacity">
                      Clear
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type something to translate..."
                    className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all resize-none"
                  />
                  <button
                    onClick={handleTranslate}
                    disabled={isLoading || !inputText.trim()}
                    className="absolute bottom-3 right-3 p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                  >
                    {isLoading ? <Activity size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3"
                >
                  <AlertCircle size={18} className="text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">API Error</p>
                    <p className="text-sm text-red-200/80 leading-relaxed">{error}</p>
                    <p className="text-[10px] text-red-500/50 mt-2 italic font-mono">Check the logs for full response details.</p>
                  </div>
                </motion.div>
              )}

              {/* Result Area */}
              <AnimatePresence>
                {translatedText && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">Translation</label>
                      <button 
                        onClick={() => navigator.clipboard.writeText(translatedText)}
                        className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <Copy size={14} className="text-zinc-400" />
                      </button>
                    </div>
                    <div className="w-full min-h-[100px] bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 text-emerald-100 text-lg font-medium leading-relaxed">
                      {translatedText}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Info Card */}
              <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                  <Info size={18} className="text-zinc-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    This app uses the Yandex Translate API. All requests are logged in the <span className="text-emerald-500 font-bold">Traffic Monitor</span>.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <Logger logs={logs} />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">Configuration</h2>
              
              <div className="space-y-2">
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                      <Languages size={20} className="text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">API Key Status</p>
                      <p className="text-xs text-zinc-500">
                        {import.meta.env.VITE_YANDEX_API_KEY ? 'Configured' : 'Missing API Key'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-600" />
                </div>

                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                      <Trash2 size={20} className="text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Clear Cache</p>
                      <p className="text-xs text-zinc-500">Remove local translation history</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-600" />
                </div>
              </div>

              <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <Globe size={24} className="text-white" />
                </div>
                <h3 className="font-bold">Yandex Connect v1.0</h3>
                <p className="text-xs text-emerald-200/60 leading-relaxed">
                  A high-performance bridge to Yandex Cloud services with real-time traffic monitoring.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-zinc-900 border-t border-zinc-800 p-2 pb-8 sticky bottom-0 z-10">
        <div className="flex items-center justify-around max-w-sm mx-auto">
          <button
            onClick={() => setActiveTab('translate')}
            className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'translate' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <div className={`p-2 rounded-xl transition-all ${activeTab === 'translate' ? 'bg-emerald-500/10' : ''}`}>
              <Languages size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Translate</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'logs' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <div className={`p-2 rounded-xl transition-all ${activeTab === 'logs' ? 'bg-emerald-500/10' : ''}`}>
              <Terminal size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Monitor</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'settings' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <div className={`p-2 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-emerald-500/10' : ''}`}>
              <Settings size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
