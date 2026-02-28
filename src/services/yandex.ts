import { AppSettings, Equipment } from '../types';
import { logger } from './logger';
import { API_ENDPOINTS } from '../config';
import { apiRequest } from './api';

export const yandexApi = {
  async searchV2(query: string, settings: AppSettings): Promise<{ title: string; url: string }[]> {
    const url = API_ENDPOINTS.SEARCH;
    logger.add('request', 'YandexSearch', 'searchV2', { query, to: url });
    
    if (!settings.yandexSearchApiKey || !settings.yandexFolderId) {
      throw new Error('Search API Key or Folder ID missing');
    }

    try {
      const results = await apiRequest({
        url,
        method: 'POST',
        body: { 
          query, 
          apiKey: settings.yandexSearchApiKey,
          folderId: settings.yandexFolderId
        }
      });
      
      logger.add('response', 'YandexSearch', 'searchV2', { results });
      return Array.isArray(results) ? results : [];
    } catch (err: any) {
      logger.add('error', 'YandexSearch', 'searchV2', { error: err.message });
      throw err;
    }
  },

  async processChunk(text: string, settings: AppSettings): Promise<any[]> {
    logger.add('request', 'YandexGPT', 'processChunk', { textLength: text.length });

    try {
      const data = await apiRequest({
        url: API_ENDPOINTS.GPT,
        method: 'POST',
        body: {
          apiKey: settings.yandexApiKey,
          folderId: settings.yandexFolderId,
          body: {
            modelUri: `gpt://${settings.yandexFolderId}/yandexgpt/latest`,
            completionOptions: { temperature: 0.1, maxTokens: 2000 },
            messages: [
              {
                role: 'system',
                text: 'Ты — технический ассистент. Извлеки список регламентных работ по техническому обслуживанию из предоставленного фрагмента текста. Если работ нет, верни пустой массив []. Формат: строго JSON массив объектов { "task_name": string, "periodicity": string, "instructions": string[] }.'
              },
              { role: 'user', text }
            ]
          }
        }
      });

      const resultText = data.result.alternatives[0].message.text;
      const jsonStr = resultText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      
      logger.add('response', 'YandexGPT', 'processChunk', { foundTasks: parsed.length });
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      logger.add('error', 'YandexGPT', 'processChunk', { error: err.message });
      return [];
    }
  },

  async mergeResults(tasks: any[], rules: string[], settings: AppSettings): Promise<Partial<Equipment>> {
    logger.add('request', 'YandexGPT', 'mergeResults', { tasksCount: tasks.length });

    try {
      const data = await apiRequest({
        url: API_ENDPOINTS.GPT,
        method: 'POST',
        body: {
          apiKey: settings.yandexApiKey,
          folderId: settings.yandexFolderId,
          body: {
            modelUri: `gpt://${settings.yandexFolderId}/yandexgpt/latest`,
            completionOptions: { temperature: 0.2, maxTokens: 2000 },
            messages: [
              {
                role: 'system',
                text: 'Ты — технический эксперт. Тебе дан список задач по ТО и правил, извлеченных из разных частей инструкции. Твоя задача: 1. Удалить дубликаты. 2. Слить похожие задачи, выбрав наиболее безопасный (частый) интервал. 3. Выделить 3-5 самых важных правил безопасности. Формат: строго JSON { "name": string, "type": string, "maintenance_schedule": [...], "important_rules": [...] }.'
              },
              { role: 'user', text: JSON.stringify({ tasks, rules }) }
            ]
          }
        }
      });

      const resultText = data.result.alternatives[0].message.text;
      const jsonStr = resultText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      
      const result = {
        name: parsed.name || '',
        type: parsed.type || '',
        maintenance_schedule: Array.isArray(parsed.maintenance_schedule) ? parsed.maintenance_schedule : [],
        important_rules: Array.isArray(parsed.important_rules) ? parsed.important_rules : []
      };
      
      logger.add('response', 'YandexGPT', 'mergeResults', { finalTasks: result.maintenance_schedule.length });
      return result;
    } catch (err: any) {
      logger.add('error', 'YandexGPT', 'mergeResults', { error: err.message });
      throw err;
    }
  }
};
