import AsyncStorage from '@react-native-async-storage/async-storage';
import { Equipment, AppSettings } from '../types';

const STORAGE_KEY = '@service_assistant_equipment';
const SETTINGS_KEY = '@service_assistant_settings';

export const storage = {
  getEquipment: async (): Promise<Equipment[]> => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      return [];
    }
  },
  saveEquipment: async (value: Equipment[]) => {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
    } catch (e) {
      console.error('Error saving equipment', e);
    }
  },
  getSettings: async (): Promise<AppSettings> => {
    try {
      const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : { yandexApiKey: '', yandexFolderId: '', yandexSearchApiKey: '' };
    } catch (e) {
      return { yandexApiKey: '', yandexFolderId: '', yandexSearchApiKey: '' };
    }
  },
  saveSettings: async (value: AppSettings) => {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
    } catch (e) {
      console.error('Error saving settings', e);
    }
  }
};
