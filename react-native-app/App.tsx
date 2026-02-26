import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  SafeAreaView, 
  Alert,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { 
  Plus, 
  Settings as SettingsIcon, 
  Wrench, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Search, 
  ArrowLeft,
  Trash2,
  Info
} from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Equipment, Task, AppSettings } from './src/types';
import { storage } from './src/services/storage';
import { maintenanceLogic } from './src/services/maintenance';
import { yandexApi } from './src/services/yandex';
import { pdfService } from './src/services/pdf';

const COLORS = {
  bg: '#F5F5F4',
  white: '#FFFFFF',
  ink: '#1C1917',
  muted: '#A8A29E',
  border: '#E7E5E4',
  accent: '#1C1917',
  success: '#059669',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  stone100: '#F5F5F4',
  stone50: '#FAFAF9'
};

export default function App() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ yandexApiKey: '', yandexFolderId: '', yandexSearchApiKey: '' });
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'settings' | 'detail'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [storedEquip, storedSettings] = await Promise.all([
      storage.getEquipment(),
      storage.getSettings()
    ]);
    setEquipment(storedEquip);
    setSettings(storedSettings);
    setLoading(false);
  };

  const saveEquipment = async (newEquipment: Equipment[]) => {
    setEquipment(newEquipment);
    await storage.saveEquipment(newEquipment);
  };

  const handleCompleteTask = async (equipId: string, taskId: string) => {
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
    await saveEquipment(updated);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Удаление', 'Удалить это оборудование?', [
      { text: 'Отмена', style: 'cancel' },
      { 
        text: 'Удалить', 
        style: 'destructive', 
        onPress: async () => {
          const updated = equipment.filter(e => e.id !== id);
          await saveEquipment(updated);
          setActiveTab('list');
        } 
      }
    ]);
  };

  const selectedEquipment = useMemo(() => 
    equipment.find(e => e.id === selectedId), 
    [equipment, selectedId]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {activeTab !== 'list' && (
            <TouchableOpacity onPress={() => setActiveTab('list')} style={styles.backButton}>
              <ArrowLeft size={24} color={COLORS.ink} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>
            {activeTab === 'list' && 'Service Assistant'}
            {activeTab === 'add' && 'Новое устройство'}
            {activeTab === 'settings' && 'Настройки'}
            {activeTab === 'detail' && 'Обслуживание'}
          </Text>
        </View>
        {activeTab === 'list' && (
          <TouchableOpacity onPress={() => setActiveTab('settings')}>
            <SettingsIcon size={24} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {activeTab === 'list' && (
          <View style={styles.listContainer}>
            {equipment.length === 0 ? (
              <View style={styles.emptyState}>
                <Wrench size={48} color={COLORS.muted} />
                <Text style={styles.emptyText}>Нет оборудования.{"\n"}Нажмите +, чтобы добавить.</Text>
              </View>
            ) : (
              equipment.map(item => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.card}
                  onPress={() => {
                    setSelectedId(item.id);
                    setActiveTab('detail');
                  }}
                >
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.cardType}>{item.type.toUpperCase()}</Text>
                      <Text style={styles.cardName}>{item.name}</Text>
                      <View style={styles.locationRow}>
                        <MapPin size={12} color={COLORS.muted} />
                        <Text style={styles.locationText}>{item.location}</Text>
                      </View>
                    </View>
                    <StatusBadge item={item} />
                  </View>
                  <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>Задач: {item.maintenance_schedule.length}</Text>
                    <ChevronRight size={16} color={COLORS.muted} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'detail' && selectedEquipment && (
          <View style={styles.detailContainer}>
            <View style={styles.detailHeaderCard}>
              <View style={styles.detailHeaderTop}>
                <View>
                  <Text style={styles.cardType}>{selectedEquipment.type.toUpperCase()}</Text>
                  <Text style={styles.detailName}>{selectedEquipment.name}</Text>
                  <View style={styles.locationRow}>
                    <MapPin size={14} color={COLORS.muted} />
                    <Text style={styles.detailLocation}>{selectedEquipment.location}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(selectedEquipment.id)}>
                  <Trash2 size={24} color={COLORS.muted} />
                </TouchableOpacity>
              </View>

              {selectedEquipment.important_rules.length > 0 && (
                <View style={styles.rulesCard}>
                  <View style={styles.rulesHeader}>
                    <AlertCircle size={16} color={COLORS.error} />
                    <Text style={styles.rulesTitle}>ВАЖНЫЕ ПРАВИЛА</Text>
                  </View>
                  {selectedEquipment.important_rules.map((rule, i) => (
                    <Text key={i} style={styles.ruleText}>• {rule}</Text>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>ГРАФИК РАБОТ</Text>
            {selectedEquipment.maintenance_schedule.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onComplete={() => handleCompleteTask(selectedEquipment.id, task.id)} 
              />
            ))}
          </View>
        )}

        {activeTab === 'add' && (
          <AddView 
            settings={settings} 
            onAdd={async (e) => {
              const updated = [...equipment, e];
              await saveEquipment(updated);
              setActiveTab('list');
            }} 
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView 
            settings={settings} 
            onSave={async (s) => {
              setSettings(s);
              await storage.saveSettings(s);
              setActiveTab('list');
            }} 
          />
        )}
      </ScrollView>

      {activeTab === 'list' && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => setActiveTab('add')}
        >
          <Plus size={32} color={COLORS.white} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

function StatusBadge({ item }: { item: Equipment }) {
  const overdueCount = item.maintenance_schedule.filter(t => 
    maintenanceLogic.isOverdue(t.lastCompletedDate, t.periodicity)
  ).length;

  if (overdueCount > 0) {
    return (
      <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
        <Text style={[styles.badgeText, { color: COLORS.error }]}>{overdueCount} НУЖНО ТО</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: '#D1FAE5' }]}>
      <Text style={[styles.badgeText, { color: COLORS.success }]}>ОК</Text>
    </View>
  );
}

function TaskCard({ task, onComplete }: { task: Task, onComplete: () => void }) {
  const isOverdue = maintenanceLogic.isOverdue(task.lastCompletedDate, task.periodicity);
  const nextDate = maintenanceLogic.getNextDate(task.lastCompletedDate, task.periodicity);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View style={[styles.taskCard, isOverdue && styles.taskCardOverdue]}>
      <View style={styles.taskRow}>
        <View style={styles.taskInfo}>
          <Text style={styles.taskName}>{task.task_name}</Text>
          <View style={styles.taskMeta}>
            <Text style={styles.taskPeriod}>{task.periodicity.toUpperCase()}</Text>
            <Text style={[styles.taskNext, isOverdue && { color: COLORS.error }]}>
              След: {format(nextDate, 'd MMM yyyy', { locale: ru })}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.checkBtn, isOverdue ? styles.checkBtnOverdue : styles.checkBtnNormal]}
          onPress={onComplete}
        >
          <CheckCircle2 size={24} color={isOverdue ? COLORS.white : COLORS.muted} />
        </TouchableOpacity>
      </View>
      
      {task.instructions.length > 0 && (
        <View style={styles.instructionContainer}>
          <TouchableOpacity onPress={() => setShowInfo(!showInfo)} style={styles.infoToggle}>
            <Info size={14} color={COLORS.muted} />
            <Text style={styles.infoToggleText}>{showInfo ? 'СКРЫТЬ' : 'КАК ВЫПОЛНИТЬ?'}</Text>
          </TouchableOpacity>
          {showInfo && (
            <View style={styles.instructionList}>
              {task.instructions.map((step, i) => (
                <Text key={i} style={styles.instructionStep}>{i+1}. {step}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function AddView({ settings, onAdd }: { settings: AppSettings, onAdd: (e: Equipment) => void }) {
  const [model, setModel] = useState('');
  const [location, setLocation] = useState('');
  const [loadingStep, setLoadingStep] = useState<'idle' | 'searching' | 'extracting' | 'analyzing' | 'merging'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'search' | 'pdf' | 'url'>('search');
  const [url, setUrl] = useState('');
  const [searchResults, setSearchResults] = useState<{ title: string; url: string }[]>([]);

  const handleFileSelect = async () => {
    // In a real Expo app, we would use expo-document-picker
    setPdfUri('file://manual.pdf');
    setPdfName('manual_vaillant.pdf');
    setError(null);
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

  const handleImport = async (targetUrl?: string) => {
    const source = targetUrl || url || (importMode === 'pdf' ? pdfUri : null);
    if (!source) return;

    setError(null);
    setProgress(0);

    try {
      let extracted: { text: string; rules: string[] };

      // 1. Extraction
      setLoadingStep('extracting');
      if (importMode === 'url' || targetUrl) {
        extracted = await pdfService.extractFromUrl(source, (p) => setProgress(p));
      } else {
        extracted = await pdfService.extractRelevantText(source, (p) => setProgress(p));
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
        name: finalData.name || model || (importMode === 'pdf' ? pdfName?.replace('.pdf', '') : 'Устройство из сети') || 'Новое устройство',
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
    <View style={styles.addView}>
      {/* Mode Switcher */}
      <View style={styles.modeSwitcher}>
        {['search', 'pdf', 'url'].map((mode) => (
          <TouchableOpacity 
            key={mode}
            onPress={() => setImportMode(mode as any)}
            disabled={isLoading}
            style={[
              styles.modeBtn,
              importMode === mode && styles.modeBtnActive
            ]}
          >
            <Text style={[
              styles.modeBtnText,
              importMode === mode && styles.modeBtnTextActive
            ]}>
              {mode === 'search' ? 'ПОИСК' : mode === 'pdf' ? 'ФАЙЛ' : 'URL'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {importMode === 'search' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>МОДЕЛЬ УСТРОЙСТВА</Text>
          <View style={styles.searchRow}>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <Search size={20} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Напр: Vaillant ecoTEC plus"
                value={model}
                editable={!isLoading}
                onChangeText={setModel}
              />
            </View>
            <TouchableOpacity 
              onPress={performSearch}
              disabled={isLoading || !model}
              style={styles.searchBtn}
            >
              {loadingStep === 'searching' ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.searchBtnText}>НАЙТИ</Text>}
            </TouchableOpacity>
          </View>

          {searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.label}>РЕЗУЛЬТАТЫ ПОИСКА</Text>
              <ScrollView style={styles.resultsScroll} nestedScrollEnabled>
                {searchResults.map((res, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleImport(res.url)}
                    disabled={isLoading}
                    style={styles.resultItem}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle} numberOfLines={1}>{res.title}</Text>
                      <Text style={styles.resultUrl} numberOfLines={1}>{res.url}</Text>
                    </View>
                    <ChevronRight size={16} color={COLORS.muted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {importMode === 'url' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>ССЫЛКА НА ИНСТРУКЦИЮ</Text>
          <View style={styles.inputWrapper}>
            <Info size={20} color={COLORS.muted} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="https://example.com/manual.pdf"
              value={url}
              editable={!isLoading}
              onChangeText={setUrl}
              autoCapitalize="none"
            />
          </View>
        </View>
      )}

      {importMode === 'pdf' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>ИНСТРУКЦИЯ (PDF)</Text>
          {!pdfUri ? (
            <TouchableOpacity 
              style={styles.uploadArea}
              onPress={handleFileSelect}
              disabled={isLoading}
            >
              <Plus size={32} color={COLORS.muted} />
              <Text style={styles.uploadText}>Выбрать PDF файл</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.fileCard}>
              <View style={styles.fileInfo}>
                <Wrench size={24} color={COLORS.ink} />
                <View>
                  <Text style={styles.fileName} numberOfLines={1}>{pdfName}</Text>
                  <Text style={styles.fileSize}>PDF Document</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setPdfUri(null)} disabled={isLoading}>
                <Trash2 size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>МЕСТО УСТАНОВКИ</Text>
        <TextInput 
          style={[styles.input, { paddingLeft: 16 }]} 
          placeholder="Напр: Кухня, Гараж"
          value={location}
          editable={!isLoading}
          onChangeText={setLocation}
        />
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLoading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressStatus}>
              {loadingStep === 'extracting' && 'Извлечение текста...'}
              {loadingStep === 'analyzing' && 'Анализ чанков...'}
              {loadingStep === 'merging' && 'Слияние данных...'}
            </Text>
            <Text style={styles.progressPercent}>{progress}%</Text>
          </View>
          <View style={styles.progressBar}>
            <MotiView 
              from={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              style={styles.progressFill}
            />
          </View>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.primaryBtn, (isLoading || (importMode === 'search' ? !searchResults.length : importMode === 'url' ? !url : !pdfUri)) && { opacity: 0.5 }]}
        onPress={() => handleImport()}
        disabled={isLoading || (importMode === 'search' ? !searchResults.length : importMode === 'url' ? !url : !pdfUri)}
      >
        {isLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>ЗАПУСТИТЬ ИМПОРТ</Text>}
      </TouchableOpacity>
      
      <Text style={styles.hintText}>
        Алгоритм Map-Reduce проанализирует даже большие инструкции, разбивая их на части
      </Text>
    </View>
  );
}

function SettingsView({ settings, onSave }: { settings: AppSettings, onSave: (s: AppSettings) => void }) {
  const [local, setLocal] = useState(settings);

  return (
    <View style={styles.addView}>
      <Text style={styles.sectionTitle}>YANDEX CLOUD API</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>API KEY (GPT)</Text>
        <TextInput 
          style={[styles.input, { paddingLeft: 16 }]} 
          secureTextEntry
          value={local.yandexApiKey}
          onChangeText={v => setLocal({...local, yandexApiKey: v})}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>FOLDER ID</Text>
        <TextInput 
          style={[styles.input, { paddingLeft: 16 }]} 
          value={local.yandexFolderId}
          onChangeText={v => setLocal({...local, yandexFolderId: v})}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>SEARCH API KEY</Text>
        <TextInput 
          style={[styles.input, { paddingLeft: 16 }]} 
          secureTextEntry
          value={local.yandexSearchApiKey}
          onChangeText={v => setLocal({...local, yandexSearchApiKey: v})}
        />
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => onSave(local)}>
        <Text style={styles.primaryBtnText}>СОХРАНИТЬ НАСТРОЙКИ</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.5 },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 100 },
  listContainer: { gap: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 100, gap: 16 },
  emptyText: { textAlign: 'center', color: COLORS.muted, lineHeight: 20 },
  card: { 
    backgroundColor: COLORS.white, 
    borderRadius: 24, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardType: { fontSize: 10, fontWeight: '800', color: COLORS.muted, letterSpacing: 1, marginBottom: 4 },
  cardName: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 12, color: COLORS.muted },
  cardFooter: { 
    marginTop: 16, 
    paddingTop: 16, 
    borderTopWidth: 1, 
    borderTopColor: '#F5F5F4',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  footerText: { fontSize: 12, color: COLORS.muted },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  fab: { 
    position: 'absolute', 
    bottom: 30, 
    right: 30, 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: COLORS.accent, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10
  },
  detailContainer: { gap: 20 },
  detailHeaderCard: { backgroundColor: COLORS.white, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  detailHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  detailName: { fontSize: 24, fontWeight: '800', color: COLORS.ink, marginBottom: 4 },
  detailLocation: { fontSize: 14, color: COLORS.muted },
  rulesCard: { backgroundColor: COLORS.errorBg, borderRadius: 20, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#FEE2E2' },
  rulesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rulesTitle: { fontSize: 10, fontWeight: '800', color: COLORS.error },
  ruleText: { fontSize: 12, color: COLORS.error, marginBottom: 4, lineHeight: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.muted, letterSpacing: 1.5, marginLeft: 8 },
  taskCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  taskCardOverdue: { borderColor: '#FECACA', backgroundColor: '#FFFBFB' },
  taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskInfo: { flex: 1 },
  taskName: { fontSize: 15, fontWeight: '800', color: COLORS.ink, marginBottom: 6 },
  taskMeta: { flexDirection: 'row', gap: 12 },
  taskPeriod: { fontSize: 10, fontWeight: '800', color: COLORS.muted },
  taskNext: { fontSize: 10, fontWeight: '600', color: COLORS.muted },
  checkBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  checkBtnNormal: { backgroundColor: '#F5F5F4' },
  checkBtnOverdue: { backgroundColor: COLORS.error },
  instructionContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F5F5F4' },
  infoToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoToggleText: { fontSize: 10, fontWeight: '800', color: COLORS.muted },
  instructionList: { marginTop: 12, gap: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#F5F5F4' },
  instructionStep: { fontSize: 12, color: '#57534E', lineHeight: 18 },
  addView: { backgroundColor: COLORS.white, borderRadius: 32, padding: 24, gap: 20, borderWidth: 1, borderColor: COLORS.border },
  inputGroup: { gap: 8 },
  label: { fontSize: 10, fontWeight: '800', color: COLORS.muted, marginLeft: 4 },
  inputWrapper: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 16, top: 16, zIndex: 1 },
  input: { backgroundColor: '#F5F5F4', borderRadius: 16, paddingVertical: 16, paddingRight: 16, paddingLeft: 48, fontSize: 15, color: COLORS.ink },
  primaryBtn: { backgroundColor: COLORS.accent, borderRadius: 20, paddingVertical: 18, alignItems: 'center', shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  modeSwitcher: { flexDirection: 'row', backgroundColor: COLORS.stone100, padding: 4, borderRadius: 12, marginBottom: 8 },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  modeBtnActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: 10, fontWeight: '800', color: COLORS.muted },
  modeBtnTextActive: { color: COLORS.ink },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchBtn: { backgroundColor: COLORS.accent, borderRadius: 16, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 12 },
  resultsContainer: { marginTop: 12, gap: 8 },
  resultsScroll: { maxHeight: 200 },
  resultItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: COLORS.stone50, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  resultInfo: { flex: 1, marginRight: 12 },
  resultTitle: { fontSize: 12, fontWeight: '800', color: COLORS.ink },
  resultUrl: { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  uploadArea: { height: 120, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 24, justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: COLORS.stone50 },
  uploadText: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  fileCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: COLORS.stone50, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileName: { fontSize: 14, fontWeight: '800', color: COLORS.ink, maxWidth: 200 },
  fileSize: { fontSize: 10, color: COLORS.muted },
  errorBox: { padding: 12, backgroundColor: COLORS.errorBg, borderRadius: 16, borderWidth: 1, borderColor: '#FEE2E2' },
  errorText: { fontSize: 12, color: COLORS.error, textAlign: 'center' },
  progressContainer: { gap: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressStatus: { fontSize: 10, fontWeight: '800', color: COLORS.muted },
  progressPercent: { fontSize: 10, fontWeight: '800', color: COLORS.ink },
  progressBar: { height: 6, backgroundColor: COLORS.stone100, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.accent },
  hintText: { fontSize: 10, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 14 }
});
