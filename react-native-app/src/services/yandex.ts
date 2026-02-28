import { AppSettings, Equipment } from '../types';
import { API_ENDPOINTS } from '../config';

export const yandexApi = {
  async searchV2(query: string, settings: AppSettings): Promise<{ title: string; url: string }[]> {
    if (!settings.yandexSearchApiKey || !settings.yandexFolderId) {
      throw new Error('Search API Key or Folder ID missing');
    }

    try {
      const response = await fetch(API_ENDPOINTS.SEARCH, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          query, 
          apiKey: settings.yandexSearchApiKey,
          folderId: settings.yandexFolderId
        })
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Search failed: ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error('YandexSearch Error:', err);
      throw err;
    }
  },

  async processChunk(text: string, settings: AppSettings): Promise<any[]> {
    try {
      const response = await fetch(API_ENDPOINTS.GPT, {
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
      
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      console.error('YandexGPT Error:', err);
      return [];
    }
  },

  async mergeResults(tasks: any[], rules: string[], settings: AppSettings): Promise<Partial<Equipment>> {
    try {
      const response = await fetch(API_ENDPOINTS.GPT, {
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
      return JSON.parse(jsonStr);
    } catch (err: any) {
      console.error('YandexGPT Merge Error:', err);
      throw err;
    }
  }
};
