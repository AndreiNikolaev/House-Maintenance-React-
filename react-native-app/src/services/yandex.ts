import { AppSettings, Equipment } from '../types';
import { CONFIG } from '../config';

export const yandexApi = {
  async checkConnection(): Promise<boolean> {
    try {
      console.log(`[CONNECTIVITY] Checking connection to: ${CONFIG.API_BASE_URL}/api/health`);
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`);
      const data = await response.json();
      console.log(`[CONNECTIVITY] Success:`, data);
      return response.ok;
    } catch (err: any) {
      console.error(`[CONNECTIVITY] Failed:`, err.message);
      return false;
    }
  },

  async searchV2(query: string, settings: AppSettings): Promise<{ title: string; url: string }[]> {
    console.log(`[REQUEST] YandexSearch.searchV2: ${query}`);
    
    if (!settings.yandexSearchApiKey || !settings.yandexFolderId) 
      throw new Error('Search API Key or Folder ID missing in settings');

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/yandex/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          apiKey: settings.yandexSearchApiKey,
          folderId: settings.yandexFolderId
        })
      });

      const responseText = await response.text();
      if (!response.ok) {
        try {
          const err = JSON.parse(responseText);
          throw new Error(err.error || 'Search failed');
        } catch {
          throw new Error(`Search failed (${response.status}): ${responseText.slice(0, 100)}`);
        }
      }

      const results = JSON.parse(responseText);
      console.log(`[RESPONSE] YandexSearch.searchV2: found ${results.length} results`);
      return results;
    } catch (err: any) {
      console.error(`[ERROR] YandexSearch.searchV2:`, err.message);
      throw err;
    }
  },

  async processChunk(text: string, settings: AppSettings): Promise<any[]> {
    console.log(`[REQUEST] YandexGPT.processChunk: textLength=${text.length}`);

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/yandex/gpt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`GPT API failed (${response.status}): ${responseText.slice(0, 100)}`);
      }

      const data = JSON.parse(responseText);
      const resultText = data.result.alternatives[0].message.text;
      const jsonStr = resultText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      
      console.log(`[RESPONSE] YandexGPT.processChunk: foundTasks=${parsed.length}`);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      console.error(`[ERROR] YandexGPT.processChunk:`, err.message);
      return [];
    }
  },

  async mergeResults(tasks: any[], rules: string[], settings: AppSettings): Promise<Partial<Equipment>> {
    console.log(`[REQUEST] YandexGPT.mergeResults: tasksCount=${tasks.length}`);

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/yandex/gpt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`GPT Merge failed (${response.status}): ${responseText.slice(0, 100)}`);
      }

      const data = JSON.parse(responseText);
      const resultText = data.result.alternatives[0].message.text;
      const jsonStr = resultText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      
      console.log(`[RESPONSE] YandexGPT.mergeResults: finalTasks=${parsed.maintenance_schedule?.length}`);
      return parsed;
    } catch (err: any) {
      console.error(`[ERROR] YandexGPT.mergeResults:`, err.message);
      throw err;
    }
  }
};
