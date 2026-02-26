import { Equipment, AppSettings } from '../types';

const STORAGE_KEY = 'service_assistant_data';
const SETTINGS_KEY = 'service_assistant_settings';

export const storage = {
  getEquipment: (): Equipment[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveEquipment: (equipment: Equipment[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(equipment));
  },
  getSettings: (): AppSettings => {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : { yandexApiKey: '', yandexFolderId: '', yandexSearchApiKey: '' };
  },
  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
};
