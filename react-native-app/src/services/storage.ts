import AsyncStorage from '@react-native-async-storage/async-storage';
import { Equipment, AppSettings } from '../types';

const STORAGE_KEYS = {
  EQUIPMENT: 'service_assistant_equipment',
  SETTINGS: 'service_assistant_settings',
};

export const storage = {
  async getEquipment(): Promise<Equipment[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EQUIPMENT);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading equipment', e);
      return [];
    }
  },

  async saveEquipment(equipment: Equipment[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(equipment));
    } catch (e) {
      console.error('Error saving equipment', e);
    }
  },

  async getSettings(): Promise<AppSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {
        yandexApiKey: '',
        yandexFolderId: '',
        yandexSearchApiKey: '',
      };
    } catch (e) {
      console.error('Error loading settings', e);
      return {
        yandexApiKey: '',
        yandexFolderId: '',
        yandexSearchApiKey: '',
      };
    }
  },

  async saveSettings(settings: AppSettings) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings', e);
    }
  },
};
