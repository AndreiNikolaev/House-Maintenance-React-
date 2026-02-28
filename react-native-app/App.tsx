import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  SafeAreaView,
  StatusBar,
  Modal,
  Platform
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
  Info,
  FileText,
  Upload,
  X,
  Link as LinkIcon
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Equipment, Task, AppSettings } from './src/types';
import { storage } from './src/services/storage';
import { maintenanceLogic } from './src/services/maintenance';
import { yandexApi } from './src/services/yandex';
import { pdfService } from './src/services/pdf';

export default function App() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    yandexApiKey: '',
    yandexFolderId: '',
    yandexSearchApiKey: '',
  });
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'settings' | 'detail'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const equip = await storage.getEquipment();
      const sett = await storage.getSettings();
      setEquipment(equip);
      setSettings(sett);
      setIsLoading(false);
    };
    init();
  }, []);

  const saveEquipment = async (newEquipment: Equipment[]) => {
    setEquipment(newEquipment);
    await storage.saveEquipment(newEquipment);
  };

  const selectedEquipment = useMemo(() => 
    equipment.find(e => e.id === selectedId), 
    [equipment, selectedId]
  );

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

  const handleDeleteEquipment = (id: string) => {
    Alert.alert(
      'Удалить оборудование?',
      'Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        { 
          text: 'Удалить', 
          style: 'destructive',
          onPress: async () => {
            await saveEquipment(equipment.filter(e => e.id !== id));
            setActiveTab('list');
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1c1917" />
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
            <TouchableOpacity 
              onPress={() => setActiveTab('list')}
              style={styles.backButton}
            >
              <ArrowLeft size={24} color="#1c1917" />
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
          <TouchableOpacity 
            onPress={() => setActiveTab('settings')}
            style={styles.settingsButton}
          >
            <SettingsIcon size={24} color="#78716c" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'list' && (
          <View style={styles.listContainer}>
            {equipment.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Wrench size={40} color="#a8a29e" />
                </View>
                <Text style={styles.emptyText}>У вас пока нет оборудования.{'\n'}Добавьте первое устройство!</Text>
              </View>
            ) : (
              equipment.map((item) => (
                <EquipmentCard 
                  key={item.id} 
                  item={item} 
                  onPress={() => {
                    setSelectedId(item.id);
                    setActiveTab('detail');
                  }} 
                />
              ))
            )}
          </View>
        )}

        {activeTab === 'detail' && selectedEquipment && (
          <View style={styles.detailContainer}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeLabel}>{selectedEquipment.type}</Text>
                  <Text style={styles.nameLabel}>{selectedEquipment.name}</Text>
                  <View style={styles.locationRow}>
                    <MapPin size={14} color="#78716c" />
                    <Text style={styles.locationText}>{selectedEquipment.location}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => handleDeleteEquipment(selectedEquipment.id)}
                  style={styles.deleteButton}
                >
                  <Trash2 size={20} color="#d6d3d1" />
                </TouchableOpacity>
              </View>

              {selectedEquipment.important_rules.length > 0 && (
                <View style={styles.rulesBox}>
                  <View style={styles.rulesHeader}>
                    <AlertCircle size={16} color="#dc2626" />
                    <Text style={styles.rulesTitle}>Важные правила</Text>
                  </View>
                  {selectedEquipment.important_rules.map((rule, i) => (
                    <Text key={i} style={styles.ruleText}>• {rule}</Text>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>График работ</Text>
            {selectedEquipment.maintenance_schedule.map((task) => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onComplete={() => handleCompleteTask(selectedEquipment.id, task.id)}
              />
            ))}
          </View>
        )}

        {activeTab === 'add' && (
          <AddEquipmentView 
            settings={settings}
            onAdd={async (newEquip) => {
              await saveEquipment([...equipment, newEquip]);
              setActiveTab('list');
            }}
            onCancel={() => setActiveTab('list')}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView 
            settings={settings}
            onSave={async (newSettings) => {
              setSettings(newSettings);
              await storage.saveSettings(newSettings);
              setActiveTab('list');
            }}
          />
        )}
      </ScrollView>

      {activeTab === 'list' && (
        <TouchableOpacity 
          onPress={() => setActiveTab('add')}
          style={styles.fab}
        >
          <Plus size={32} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

function EquipmentCard({ item, onPress }: { item: Equipment, onPress: () => void }) {
  const overdueCount = item.maintenance_schedule.filter(t => 
    maintenanceLogic.isOverdue(t.lastCompletedDate, t.periodicity)
  ).length;

  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.typeLabel}>{item.type}</Text>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.locationRow}>
            <MapPin size={12} color="#78716c" />
            <Text style={styles.locationTextSmall}>{item.location}</Text>
          </View>
        </View>
        {overdueCount > 0 ? (
          <View style={[styles.badge, styles.badgeRed]}>
            <AlertCircle size={10} color="#dc2626" />
            <Text style={styles.badgeTextRed}>{overdueCount} НУЖНО ТО</Text>
          </View>
        ) : (
          <View style={[styles.badge, styles.badgeGreen]}>
            <CheckCircle2 size={10} color="#059669" />
            <Text style={styles.badgeTextGreen}>ОК</Text>
          </View>
        )}
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>Задач: {item.maintenance_schedule.length}</Text>
        <ChevronRight size={16} color="#d6d3d1" />
      </View>
    </TouchableOpacity>
  );
}

function TaskItem({ task, onComplete }: { task: Task, onComplete: () => void }) {
  const isOverdue = maintenanceLogic.isOverdue(task.lastCompletedDate, task.periodicity);
  const nextDate = maintenanceLogic.getNextDate(task.lastCompletedDate, task.periodicity);
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <View style={[styles.taskItem, isOverdue && styles.taskItemOverdue]}>
      <View style={styles.taskRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.taskName}>{task.task_name}</Text>
          <View style={styles.taskMeta}>
            <Text style={styles.taskPeriod}>{task.periodicity}</Text>
            <Text style={[styles.taskNext, isOverdue && styles.taskNextOverdue]}>
              След: {format(nextDate, 'd MMM yyyy', { locale: ru })}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={onComplete}
          style={[styles.completeButton, isOverdue && styles.completeButtonOverdue]}
        >
          <CheckCircle2 size={24} color={isOverdue ? "#fff" : "#a8a29e"} />
        </TouchableOpacity>
      </View>

      {task.instructions.length > 0 && (
        <View style={styles.instructionsContainer}>
          <TouchableOpacity 
            onPress={() => setShowInstructions(!showInstructions)}
            style={styles.infoToggle}
          >
            <Info size={12} color="#a8a29e" />
            <Text style={styles.infoToggleText}>
              {showInstructions ? 'Скрыть инструкцию' : 'Как выполнить?'}
            </Text>
          </TouchableOpacity>
          
          {showInstructions && (
            <View style={styles.instructionsList}>
              {task.instructions.map((step, i) => (
                <Text key={i} style={styles.instructionStep}>
                  <Text style={styles.stepNumber}>{i + 1}. </Text>
                  {step}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function AddEquipmentView({ settings, onAdd, onCancel }: { settings: AppSettings, onAdd: (e: Equipment) => void, onCancel: () => void }) {
  const [model, setModel] = useState('');
  const [location, setLocation] = useState('');
  const [importMode, setImportMode] = useState<'search' | 'url'>('search');
  const [url, setUrl] = useState('');
  const [loadingStep, setLoadingStep] = useState<'idle' | 'searching' | 'processing'>('idle');
  const [searchResults, setSearchResults] = useState<{ title: string; url: string }[]>([]);
  const [progress, setProgress] = useState(0);

  const performSearch = async () => {
    if (!model) return;
    setLoadingStep('searching');
    try {
      const results = await yandexApi.searchV2(model, settings);
      setSearchResults(results);
    } catch (err: any) {
      Alert.alert('Ошибка', err.message);
    } finally {
      setLoadingStep('idle');
    }
  };

  const handleImport = async (targetUrl?: string) => {
    const source = targetUrl || url;
    if (!source) return;

    setLoadingStep('processing');
    setProgress(0);

    try {
      // 1. Extraction
      setProgress(20);
      const extracted = await pdfService.extractFromUrl(source, (p) => setProgress(20 + p * 0.3));

      // 2. Analysis
      setProgress(50);
      const chunks = pdfService.chunkText(extracted.text);
      const allTasks: any[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkTasks = await yandexApi.processChunk(chunks[i], settings);
        allTasks.push(...chunkTasks);
        setProgress(50 + (i / chunks.length) * 30);
      }

      // 3. Merging
      setProgress(90);
      const finalData = await yandexApi.mergeResults(allTasks, extracted.rules, settings);

      const newEquip: Equipment = {
        id: Math.random().toString(36).substr(2, 9),
        name: finalData.name || model || 'Устройство',
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
      Alert.alert('Ошибка импорта', err.message);
    } finally {
      setLoadingStep('idle');
      setProgress(0);
    }
  };

  const isLoading = loadingStep !== 'idle';

  return (
    <View style={styles.card}>
      <View style={styles.modeSwitcher}>
        <TouchableOpacity 
          onPress={() => setImportMode('search')}
          style={[styles.modeButton, importMode === 'search' && styles.modeButtonActive]}
        >
          <Text style={[styles.modeButtonText, importMode === 'search' && styles.modeButtonTextActive]}>Поиск</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setImportMode('url')}
          style={[styles.modeButton, importMode === 'url' && styles.modeButtonActive]}
        >
          <Text style={[styles.modeButtonText, importMode === 'url' && styles.modeButtonTextActive]}>URL</Text>
        </TouchableOpacity>
      </View>

      {importMode === 'search' && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Модель устройства</Text>
          <View style={styles.searchRow}>
            <TextInput 
              style={styles.searchInput}
              placeholder="Напр: Vaillant ecoTEC"
              value={model}
              onChangeText={setModel}
              editable={!isLoading}
            />
            <TouchableOpacity 
              onPress={performSearch}
              disabled={isLoading || !model}
              style={styles.searchActionButton}
            >
              {loadingStep === 'searching' ? <ActivityIndicator color="#fff" /> : <Search size={20} color="#fff" />}
            </TouchableOpacity>
          </View>

          {searchResults.length > 0 && (
            <View style={styles.resultsList}>
              {searchResults.map((res, idx) => (
                <TouchableOpacity 
                  key={idx}
                  onPress={() => handleImport(res.url)}
                  style={styles.resultItem}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle} numberOfLines={1}>{res.title}</Text>
                    <Text style={styles.resultUrl} numberOfLines={1}>{res.url}</Text>
                  </View>
                  <ChevronRight size={16} color="#d6d3d1" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {importMode === 'url' && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ссылка на PDF</Text>
          <TextInput 
            style={styles.input}
            placeholder="https://example.com/manual.pdf"
            value={url}
            onChangeText={setUrl}
            editable={!isLoading}
          />
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Место установки</Text>
        <TextInput 
          style={styles.input}
          placeholder="Напр: Кухня"
          value={location}
          onChangeText={setLocation}
          editable={!isLoading}
        />
      </View>

      {isLoading && loadingStep === 'processing' && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Обработка... {progress}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      )}

      <TouchableOpacity 
        onPress={() => handleImport()}
        disabled={isLoading || (importMode === 'search' ? false : !url)}
        style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
      >
        <Text style={styles.primaryButtonText}>{isLoading ? 'Обработка...' : 'Запустить импорт'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
        <Text style={styles.cancelButtonText}>Отмена</Text>
      </TouchableOpacity>
    </View>
  );
}

function SettingsView({ settings, onSave }: { settings: AppSettings, onSave: (s: AppSettings) => void }) {
  const [local, setLocal] = useState(settings);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Yandex Cloud API</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>API Key</Text>
        <TextInput 
          style={styles.input}
          secureTextEntry
          value={local.yandexApiKey}
          onChangeText={(v) => setLocal({...local, yandexApiKey: v})}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Folder ID</Text>
        <TextInput 
          style={styles.input}
          value={local.yandexFolderId}
          onChangeText={(v) => setLocal({...local, yandexFolderId: v})}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Search API Key</Text>
        <TextInput 
          style={styles.input}
          secureTextEntry
          value={local.yandexSearchApiKey}
          onChangeText={(v) => setLocal({...local, yandexSearchApiKey: v})}
        />
      </View>

      <TouchableOpacity 
        onPress={() => onSave(local)}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Сохранить</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f4',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 10,
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1c1917',
  },
  settingsButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
    paddingBottom: 100,
  },
  listContainer: {
    gap: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e7e5e4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#78716c',
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#a8a29e',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c1917',
    marginBottom: 4,
  },
  nameLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1917',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#78716c',
  },
  locationTextSmall: {
    fontSize: 12,
    color: '#78716c',
  },
  deleteButton: {
    padding: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeRed: {
    backgroundColor: '#fef2f2',
  },
  badgeGreen: {
    backgroundColor: '#ecfdf5',
  },
  badgeTextRed: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  badgeTextGreen: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#059669',
  },
  cardFooter: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#a8a29e',
  },
  rulesBox: {
    backgroundColor: '#fef2f2',
    padding: 15,
    borderRadius: 16,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rulesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#dc2626',
    textTransform: 'uppercase',
  },
  ruleText: {
    fontSize: 13,
    color: '#991b1b',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#a8a29e',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginVertical: 15,
    paddingHorizontal: 5,
  },
  taskItem: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    marginBottom: 10,
  },
  taskItemOverdue: {
    borderColor: '#fecaca',
    backgroundColor: '#fffafb',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taskName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1c1917',
    marginBottom: 4,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taskPeriod: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#a8a29e',
    textTransform: 'uppercase',
  },
  taskNext: {
    fontSize: 10,
    color: '#a8a29e',
  },
  taskNextOverdue: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  completeButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f5f5f4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeButtonOverdue: {
    backgroundColor: '#ef4444',
  },
  instructionsContainer: {
    marginTop: 10,
  },
  infoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoToggleText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#a8a29e',
    textTransform: 'uppercase',
  },
  instructionsList: {
    marginTop: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#f5f5f4',
  },
  instructionStep: {
    fontSize: 12,
    color: '#57534e',
    lineHeight: 18,
    marginBottom: 8,
  },
  stepNumber: {
    fontWeight: 'bold',
    color: '#a8a29e',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1c1917',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f4',
    padding: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: '#fff',
  },
  modeButtonText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#a8a29e',
    textTransform: 'uppercase',
  },
  modeButtonTextActive: {
    color: '#1c1917',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#a8a29e',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1c1917',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1c1917',
  },
  searchActionButton: {
    width: 50,
    backgroundColor: '#1c1917',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsList: {
    marginTop: 10,
    maxHeight: 200,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1c1917',
  },
  resultUrl: {
    fontSize: 10,
    color: '#a8a29e',
  },
  primaryButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#a8a29e',
    fontWeight: 'bold',
  },
  progressContainer: {
    marginVertical: 15,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#a8a29e',
    textTransform: 'uppercase',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f5f5f4',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1c1917',
  },
});
