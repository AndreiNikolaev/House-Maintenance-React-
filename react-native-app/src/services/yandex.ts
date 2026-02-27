import { AppSettings, Equipment } from '../types';
import { CONFIG } from '../config';

export const yandexApi = {
  async checkConnection(): Promise<boolean> {
    try {
      const url = `${CONFIG.API_BASE_URL}/api/health`;
      console.log(`[CONNECTIVITY ${CONFIG.VERSION}] Checking connection to: ${url}`);
      const response = await fetch(url, { credentials: 'include' });
      const data = await response.json();
      console.log(`[CONNECTIVITY] Success:`, data);
      return response.ok;
    } catch (err: any) {
      console.error(`[CONNECTIVITY] Failed:`, err.message);
      return false;
    }
  },

  async searchV2(query: string, settings: AppSettings): Promise<{ title: string; url: string }[]> {
    const url = `${CONFIG.API_BASE_URL}/api/yandex/search`;
    console.log(`[REQUEST ${CONFIG.VERSION}] YandexSearch.searchV2: ${query} to ${url}`);
    
    if (!settings.yandexSearchApiKey || !settings.yandexFolderId) 
      throw new Error('Search API Key or Folder ID missing in settings');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          query,
          apiKey: settings.yandexSearchApiKey,
          folderId: settings.yandexFolderId
        })
      });

      const responseText = await response.text();
      console.log(`[DEBUG] YandexSearch.searchV2 response status: ${response.status}`);
      
      if (!response.ok) {
        console.error(`[DEBUG] YandexSearch.searchV2 error body: ${responseText}`);
        try {
          const err = JSON.parse(responseText);
          throw new Error(err.error || `Search failed: ${response.status}`);
        } catch {
          // If we got HTML, it's likely a redirect or 404 falling through to Vite
          if (responseText.includes('<!doctype html>')) {
            throw new Error(`Server returned HTML instead of JSON. This usually means the API route was not found or you were redirected to login. URL: ${url}`);
          }
          throw new Error(`Search failed (${response.status}): ${responseText.slice(0, 200)}`);
        }
      }

      let results;
      try {
        results = JSON.parse(responseText);
      } catch (e) {
        console.error(`[ERROR] YandexSearch: Failed to parse JSON. Response starts with: ${responseText.slice(0, 200)}`);
        throw new Error(`Invalid JSON response from server. Expected JSON but received: ${responseText.slice(0, 50)}...`);
      }
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
        credentials: 'include',
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
        throw new Error(`GPT API failed (${response.status}): ${responseText.slice(0, 200)}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error(`[ERROR] YandexGPT: Failed to parse JSON. Response starts with: ${responseText.slice(0, 200)}`);
        throw new Error(`Invalid JSON response from server: ${responseText.slice(0, 100)}`);
      }
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
        credentials: 'include',
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
        throw new Error(`GPT Merge failed (${response.status}): ${responseText.slice(0, 200)}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error(`[ERROR] YandexGPT Merge: Failed to parse JSON. Response starts with: ${responseText.slice(0, 200)}`);
        throw new Error(`Invalid JSON response from server: ${responseText.slice(0, 100)}`);
      }
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
