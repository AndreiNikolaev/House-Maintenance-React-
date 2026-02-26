import { AppSettings, Equipment } from '../types';
import { logger } from './logger';

export const yandexApi = {
  async searchV2(query: string, settings: AppSettings): Promise<{ title: string; url: string }[]> {
    logger.add('request', 'YandexSearch', 'searchV2', { query });
    
    if (!settings.yandexSearchApiKey) {
      throw new Error('Search API Key missing');
    }

    try {
      const response = await fetch('/api/yandex/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, apiKey: settings.yandexSearchApiKey })
      });
      
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      const results = await response.json();

      logger.add('response', 'YandexSearch', 'searchV2', { results });
      return results;
    } catch (err: any) {
      logger.add('error', 'YandexSearch', 'searchV2', { error: err.message });
      throw err;
    }
  },

  async processChunk(text: string, settings: AppSettings): Promise<any[]> {
    logger.add('request', 'YandexGPT', 'processChunk', { textLength: text.length });

    try {
      const response = await fetch('/api/yandex/gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        })
      });

      if (!response.ok) throw new Error(`GPT failed: ${response.status}`);
      const data = await response.json();
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
      const response = await fetch('/api/yandex/gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        })
      });

      if (!response.ok) throw new Error(`GPT failed: ${response.status}`);
      const data = await response.json();
      const resultText = data.result.alternatives[0].message.text;
      const jsonStr = resultText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      
      logger.add('response', 'YandexGPT', 'mergeResults', { finalTasks: parsed.maintenance_schedule?.length });
      return parsed;
    } catch (err: any) {
      logger.add('error', 'YandexGPT', 'mergeResults', { error: err.message });
      throw err;
    }
  }
};
