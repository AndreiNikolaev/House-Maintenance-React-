import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { 
  Plus, 
  Settings as SettingsIcon, 
  Wrench, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Search, 
  Loader2,
  ArrowLeft,
  Trash2,
  Info,
  FileText,
  Upload,
  X,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Equipment, Task, AppSettings } from './types';
import { storage } from './services/storage';
import { maintenanceLogic } from './services/maintenance';
import { yandexApi } from './services/yandex';
import { pdfService } from './services/pdf';
import { logger } from './services/logger';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [settings, setSettings] = useState<AppSettings>(storage.getSettings());
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'settings' | 'detail'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setEquipment(storage.getEquipment());
    
    // Warmup session for Capacitor
    const warmup = async () => {
      try {
        console.log('[APP] Initializing session...');
        await apiRequest({ url: API_ENDPOINTS.INIT_SESSION, method: 'GET' });
        console.log('[APP] Session initialized');
      } catch (e) {
        console.error('[APP] Session initialization failed', e);
      }
    };
    warmup();
  }, []);

  const saveEquipment = (newEquipment: Equipment[]) => {
    setEquipment(newEquipment);
    storage.saveEquipment(newEquipment);
  };

  const selectedEquipment = useMemo(() => 
    equipment.find(e => e.id === selectedId), 
    [equipment, selectedId]
  );

  const handleCompleteTask = (equipId: string, taskId: string) => {
    const updated = equipment.map(e => {
      if (e.id === equipId) {
        return {
          ...e,
          maintenance_schedule: e.maintenance_schedule.map(t => 
            t.id === taskId ? { ...t, lastCompletedDate: new Date().toISOString() } : t
          )
        };
      }
      return e;
    });
    saveEquipment(updated);
  };

  const handleDeleteEquipment = (id: string) => {
    if (confirm('Удалить это оборудование?')) {
      saveEquipment(equipment.filter(e => e.id !== id));
      setActiveTab('list');
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-stone-100 flex flex-col shadow-xl relative overflow-hidden">
      {/* Header */}
      <header className="p-6 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-stone-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeTab !== 'list' && (
              <button 
                onClick={() => setActiveTab('list')}
                className="p-2 -ml-2 hover:bg-stone-100 rounded-full transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-xl font-bold tracking-tight text-stone-900">
              {activeTab === 'list' && 'Service Assistant'}
              {activeTab === 'add' && 'Новое устройство'}
              {activeTab === 'settings' && 'Настройки'}
              {activeTab === 'detail' && 'Обслуживание'}
            </h1>
          </div>
          {activeTab === 'list' && (
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('settings')}
                className="p-2 hover:bg-stone-100 rounded-full transition-colors"
              >
                <SettingsIcon size={20} className="text-stone-500" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'list' && (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {equipment.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <div className="w-16 h-16 bg-stone-200 rounded-full flex items-center justify-center mx-auto">
                    <Wrench className="text-stone-400" size={32} />
                  </div>
                  <p className="text-stone-500">У вас пока нет оборудования.<br/>Добавьте первое устройство!</p>
                </div>
              ) : (
                equipment.map((item: Equipment) => (
                  <EquipmentCard 
                    key={item.id} 
                    item={item} 
                    onClick={() => {
                      setSelectedId(item.id);
                      setActiveTab('detail');
                    }} 
                  />
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'detail' && selectedEquipment && (
            <motion.div 
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-400">{selectedEquipment.type}</span>
                    <h2 className="text-2xl font-bold text-stone-900">{selectedEquipment.name}</h2>
                    <div className="flex items-center gap-1 text-stone-500 mt-1">
                      <MapPin size={14} />
                      <span className="text-sm">{selectedEquipment.location}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteEquipment(selectedEquipment.id)}
                    className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                {selectedEquipment.important_rules.length > 0 && (
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mt-4">
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                      <AlertCircle size={16} />
                      <span className="text-xs font-bold uppercase">Важные правила</span>
                    </div>
                    <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                      {selectedEquipment.important_rules.map((rule, i) => (
                        <li key={i}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 px-2">График работ</h3>
                {selectedEquipment.maintenance_schedule.map((task: Task) => (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    onComplete={() => handleCompleteTask(selectedEquipment.id, task.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'add' && (
            <AddEquipmentView 
              settings={settings}
              onAdd={(newEquip) => {
                saveEquipment([...equipment, newEquip]);
                setActiveTab('list');
              }}
              onCancel={() => setActiveTab('list')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView 
              settings={settings}
              onSave={(newSettings) => {
                setSettings(newSettings);
                storage.saveSettings(newSettings);
                setActiveTab('list');
              }}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Floating Action Button */}
      {activeTab === 'list' && (
        <button 
          onClick={() => setActiveTab('add')}
          className="fixed bottom-8 right-8 w-14 h-14 bg-stone-900 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-30"
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
}

function EquipmentCard({ item, onClick }: { item: Equipment, onClick: () => void, key?: string }) {
  const overdueCount = item.maintenance_schedule.filter(t => 
    maintenanceLogic.isOverdue(t.lastCompletedDate, t.periodicity)
  ).length;

  return (
    <button 
      onClick={onClick}
      className="w-full text-left bg-white p-5 rounded-3xl shadow-sm border border-stone-200 hover:border-stone-300 transition-all active:scale-[0.98]"
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{item.type}</span>
          <h3 className="text-lg font-bold text-stone-900 leading-tight">{item.name}</h3>
          <div className="flex items-center gap-1 text-stone-500">
            <MapPin size={12} />
            <span className="text-xs">{item.location}</span>
          </div>
        </div>
        {overdueCount > 0 ? (
          <div className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
            <AlertCircle size={10} />
            {overdueCount} НУЖНО ТО
          </div>
        ) : (
          <div className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
            <CheckCircle2 size={10} />
            ОК
          </div>
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-stone-50 flex justify-between items-center">
        <span className="text-xs text-stone-400">Задач: {item.maintenance_schedule.length}</span>
        <ChevronRight size={16} className="text-stone-300" />
      </div>
    </button>
  );
}

function TaskItem({ task, onComplete }: { task: Task, onComplete: () => void, key?: string }) {
  const isOverdue = maintenanceLogic.isOverdue(task.lastCompletedDate, task.periodicity);
  const nextDate = maintenanceLogic.getNextDate(task.lastCompletedDate, task.periodicity);
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <div className={cn(
      "bg-white p-4 rounded-2xl border transition-all",
      isOverdue ? "border-red-200 bg-red-50/30" : "border-stone-100"
    )}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <h4 className="font-bold text-stone-900 text-sm leading-snug">{task.task_name}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-bold text-stone-400 uppercase">{task.periodicity}</span>
            <span className={cn(
              "text-[10px] font-medium",
              isOverdue ? "text-red-500" : "text-stone-400"
            )}>
              След: {format(nextDate, 'd MMM yyyy', { locale: ru })}
            </span>
          </div>
        </div>
        <button 
          onClick={onComplete}
          className={cn(
            "p-2 rounded-xl transition-all active:scale-90",
            isOverdue ? "bg-red-500 text-white shadow-lg shadow-red-200" : "bg-stone-100 text-stone-400"
          )}
        >
          <CheckCircle2 size={20} />
        </button>
      </div>

      {task.instructions.length > 0 && (
        <div className="mt-3">
          <button 
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-[10px] font-bold text-stone-400 uppercase flex items-center gap-1 hover:text-stone-600"
          >
            <Info size={12} />
            {showInstructions ? 'Скрыть инструкцию' : 'Как выполнить?'}
          </button>
          
          <AnimatePresence>
            {showInstructions && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <ul className="mt-2 space-y-2 pl-4 border-l-2 border-stone-100">
                  {task.instructions.map((step, i) => (
                    <li key={i} className="text-xs text-stone-600 leading-relaxed">
                      <span className="font-bold text-stone-400 mr-2">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function AddEquipmentView({ settings, onAdd, onCancel }: { settings: AppSettings, onAdd: (e: Equipment) => void, onCancel: () => void }) {
  const [model, setModel] = useState('');
  const [location, setLocation] = useState('');
  const [loadingStep, setLoadingStep] = useState<'idle' | 'searching' | 'extracting' | 'analyzing' | 'merging'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'search' | 'pdf' | 'url'>('search');
  const [url, setUrl] = useState('');
  const [searchResults, setSearchResults] = useState<{ title: string; url: string }[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setError(null);
    } else if (file) {
      setError('Пожалуйста, выберите PDF файл');
    }
  };

  const performSearch = async () => {
    if (!model) return;
    setLoadingStep('searching');
    setError(null);
    try {
      const results = await yandexApi.searchV2(model, settings);
      setSearchResults(results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingStep('idle');
    }
  };

  const handleImport = async (targetUrl?: string, targetFile?: File) => {
    const source = targetUrl || selectedUrl || url || (importMode === 'pdf' ? pdfFile : null);
    if (!source) return;

    setError(null);
    setProgress(0);

    try {
      let extracted: { text: string; rules: string[] };

      // 1. Extraction
      setLoadingStep('extracting');
      if (typeof source === 'string') {
        extracted = await pdfService.extractFromUrl(source, (p) => setProgress(p));
      } else {
        extracted = await pdfService.extractRelevantText(source as File, (p) => setProgress(p));
      }

      // 2. Chunking
      const chunks = pdfService.chunkText(extracted.text);
      
      // 3. Parallel Analysis (Map)
      setLoadingStep('analyzing');
      const allTasks: any[] = [];
      for (let i = 0; i < chunks.length; i++) {
        setProgress(Math.round(((i + 1) / chunks.length) * 100));
        const chunkTasks = await yandexApi.processChunk(chunks[i], settings);
        allTasks.push(...chunkTasks);
      }

      // 4. Merging (Reduce)
      setLoadingStep('merging');
      const finalData = await yandexApi.mergeResults(allTasks, extracted.rules, settings);

      const newEquip: Equipment = {
        id: Math.random().toString(36).substr(2, 9),
        name: finalData.name || model || (typeof source === 'string' ? 'Устройство из сети' : (source as File).name.replace('.pdf', '')),
        type: finalData.type || 'Оборудование',
        location: location || 'Дом',
        maintenance_schedule: (finalData.maintenance_schedule || []).map((t: any) => ({
          ...t,
          id: Math.random().toString(36).substr(2, 9),
          lastCompletedDate: null
        })),
        important_rules: finalData.important_rules || []
      };

      onAdd(newEquip);
    } catch (err: any) {
      setError(err.message || 'Ошибка обработки. Проверьте API ключи.');
    } finally {
      setLoadingStep('idle');
      setProgress(0);
    }
  };

  const isLoading = loadingStep !== 'idle';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-6">
        {/* Mode Switcher */}
        <div className="flex bg-stone-100 p-1 rounded-xl">
          {['search', 'pdf', 'url'].map((mode) => (
            <button 
              key={mode}
              onClick={() => setImportMode(mode as any)}
              disabled={isLoading}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                importMode === mode ? "bg-white text-stone-900 shadow-sm" : "text-stone-400"
              )}
            >
              {mode === 'search' ? 'Поиск' : mode === 'pdf' ? 'Файл' : 'URL'}
            </button>
          ))}
        </div>

        {importMode === 'search' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Модель устройства</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Напр: Vaillant ecoTEC plus"
                    value={model}
                    disabled={isLoading}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-stone-200 transition-all outline-none text-stone-900 disabled:opacity-50"
                  />
                </div>
                <button 
                  onClick={performSearch}
                  disabled={isLoading || !model}
                  className="px-6 bg-stone-900 text-white rounded-2xl font-bold disabled:opacity-50"
                >
                  {loadingStep === 'searching' ? <Loader2 className="animate-spin" size={20} /> : 'Найти'}
                </button>
              </div>
            </div>

            {Array.isArray(searchResults) && searchResults.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Результаты поиска</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleImport(res.url)}
                      disabled={isLoading}
                      className="w-full text-left p-3 bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-stone-900 line-clamp-1">{res.title}</span>
                          <span className="text-[10px] text-stone-400 truncate max-w-[200px]">{res.url}</span>
                        </div>
                        <ChevronRight size={16} className="text-stone-300 group-hover:text-stone-900 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {importMode === 'url' && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Ссылка на инструкцию</label>
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="url" 
                placeholder="https://example.com/manual.pdf"
                value={url}
                disabled={isLoading}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-stone-200 transition-all outline-none text-stone-900 disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {importMode === 'pdf' && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Инструкция (PDF)</label>
            <div className="relative">
              {!pdfFile ? (
                <label className={cn(
                  "flex flex-col items-center justify-center w-full h-32 bg-stone-50 border-2 border-dashed border-stone-200 rounded-2xl cursor-pointer hover:bg-stone-100 transition-all",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}>
                  <Upload className="text-stone-400 mb-2" size={24} />
                  <span className="text-xs text-stone-500">Выберите или перетащите файл</span>
                  <input 
                    type="file" 
                    accept="application/pdf"
                    disabled={isLoading}
                    onChange={handleFileChange}
                    className="hidden" 
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                      <FileText size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-stone-900 truncate max-w-[180px]">{pdfFile.name}</span>
                      <span className="text-[10px] text-stone-400">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPdfFile(null)}
                    disabled={isLoading}
                    className="p-1 hover:bg-stone-200 rounded-full transition-colors disabled:opacity-50"
                  >
                    <X size={16} className="text-stone-400" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Место установки</label>
          <input 
            type="text" 
            placeholder="Напр: Кухня, Подвал"
            value={location}
            disabled={isLoading}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-4 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-stone-200 transition-all outline-none text-stone-900 disabled:opacity-50"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-100 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="leading-relaxed">{error}</p>
            </div>
            {error.includes('Cookie Check') && (
              <button 
                onClick={() => window.open(API_ENDPOINTS.INIT_SESSION, '_blank')}
                className="w-full py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                Авторизовать в браузере
              </button>
            )}
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-stone-400">
              <span>
                {loadingStep === 'extracting' && 'Извлечение текста...'}
                {loadingStep === 'analyzing' && 'Анализ чанков...'}
                {loadingStep === 'merging' && 'Слияние данных...'}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-stone-900"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <button 
          onClick={() => handleImport()}
          disabled={isLoading || (importMode === 'search' ? !selectedUrl : importMode === 'url' ? !url : !pdfFile)}
          className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 active:scale-95 transition-all shadow-xl shadow-stone-200"
        >
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Wrench size={20} />}
          {isLoading ? 'Обработка...' : 'Запустить импорт'}
        </button>
        
        <p className="text-[10px] text-stone-400 text-center px-4">
          Алгоритм Map-Reduce проанализирует даже большие инструкции, разбивая их на части
        </p>
      </div>

      <button 
        onClick={onCancel}
        disabled={isLoading}
        className="w-full py-4 text-stone-400 font-bold text-sm disabled:opacity-50"
      >
        Отмена
      </button>
    </motion.div>
  );
}

import { API_ENDPOINTS } from './config';
import { apiRequest } from './services/api';

function SettingsView({ settings, onSave }: { settings: AppSettings, onSave: (s: AppSettings) => void }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');

  const testConnection = async () => {
    setTestStatus('testing');
    try {
      const data = await apiRequest({
        url: API_ENDPOINTS.HEALTH,
        method: 'GET'
      });
      setTestStatus('ok');
      alert(`Успешно! Сервер доступен. Версия: ${data.version || 'неизвестна'}`);
    } catch (err: any) {
      setTestStatus('error');
      alert(`Ошибка соединения: ${err.message}`);
    }
  };

  const openInBrowser = () => {
    window.open(API_ENDPOINTS.INIT_SESSION, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-6">
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Yandex Cloud API</h3>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 ml-1">API Key (Foundation Models)</label>
            <input 
              type="password" 
              value={localSettings.yandexApiKey}
              onChange={(e) => setLocalSettings({...localSettings, yandexApiKey: e.target.value})}
              className="w-full px-4 py-3 bg-stone-50 border-none rounded-xl focus:ring-2 focus:ring-stone-200 outline-none text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 ml-1">Folder ID</label>
            <input 
              type="text" 
              value={localSettings.yandexFolderId}
              onChange={(e) => setLocalSettings({...localSettings, yandexFolderId: e.target.value})}
              className="w-full px-4 py-3 bg-stone-50 border-none rounded-xl focus:ring-2 focus:ring-stone-200 outline-none text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 ml-1">Search API Key</label>
            <input 
              type="password" 
              value={localSettings.yandexSearchApiKey}
              onChange={(e) => setLocalSettings({...localSettings, yandexSearchApiKey: e.target.value})}
              className="w-full px-4 py-3 bg-stone-50 border-none rounded-xl focus:ring-2 focus:ring-stone-200 outline-none text-sm"
            />
          </div>
        </div>

        <div className="space-y-3">
          <button 
            onClick={testConnection}
            disabled={testStatus === 'testing'}
            className="w-full py-3 bg-stone-100 text-stone-900 rounded-xl text-xs font-bold active:scale-95 transition-all disabled:opacity-50"
          >
            {testStatus === 'testing' ? 'Проверка...' : 'Проверить соединение'}
          </button>

          <button 
            onClick={openInBrowser}
            className="w-full py-3 bg-stone-100 text-stone-900 rounded-xl text-xs font-bold active:scale-95 transition-all"
          >
            Авторизовать устройство (браузер)
          </button>

          <button 
            onClick={() => onSave(localSettings)}
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-stone-200"
          >
            Сохранить настройки
          </button>
        </div>
      </div>
      
      <div className="p-4 text-center">
        <p className="text-[10px] text-stone-400 leading-relaxed">
          Ваши ключи хранятся только локально на устройстве.<br/>
          Получить ключи можно в консоли Yandex Cloud.
        </p>
      </div>
    </motion.div>
  );
}
