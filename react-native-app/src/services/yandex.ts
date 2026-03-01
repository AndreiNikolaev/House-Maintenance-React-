import { AppSettings, Equipment } from '../types';
import { API_ENDPOINTS } from '../config';

const YANDEX_ENDPOINTS = {
  SEARCH: 'https://searchapi.api.cloud.yandex.net/v2/web/search',
  GPT: 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion'
};

function parseYandexResponse(data: any): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = [];
  try {
    if (data?.results?.items) {
      return data.results.items.map((item: any) => ({
        title: item.title || 'Без названия',
        url: item.url
      })).filter((i: any) => i.url);
    }
    if (Array.isArray(data)) return data;
  } catch (e) {
    console.error('[Yandex Parser] Error:', e);
  }
  return results;
}

export const yandexApi = {
  async searchV2(query: string, settings: AppSettings): Promise<{ title: string; url: string }[]> {
    if (!settings.yandexSearchApiKey || !settings.yandexFolderId) {
      throw new Error('Search API Key or Folder ID missing');
    }

    try {
      console.log('[Yandex Search] Direct POST to v2');
      const response = await fetch(YANDEX_ENDPOINTS.SEARCH, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${settings.yandexSearchApiKey}`
        },
        body: JSON.stringify({ 
          folderId: settings.yandexFolderId,
          query: query + ' инструкция по обслуживанию pdf',
          lr: 225,
          l10n: 'ru'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return parseYandexResponse(data);
      }

      console.warn('[Yandex Search] Direct failed, trying proxy...');
      const proxyResponse = await fetch(API_ENDPOINTS.SEARCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query, 
          apiKey: settings.yandexSearchApiKey,
          folderId: settings.yandexFolderId
        })
      });
      
      if (!proxyResponse.ok) throw new Error(`Search failed: ${proxyResponse.status}`);
      const proxyData = await proxyResponse.json();
      return parseYandexResponse(proxyData);
    } catch (err: any) {
      console.error('YandexSearch Error:', err);
      throw err;
    }
  },

  async processChunk(text: string, settings: AppSettings): Promise<any[]> {
    const body = {
      modelUri: `gpt://${settings.yandexFolderId}/yandexgpt/latest`,
      completionOptions: { temperature: 0.1, maxTokens: 2000 },
      messages: [
        {
          role: 'system',
          text: 'Ты — технический ассистент. Извлеки список регламентных работ по техническому обслуживанию из предоставленного фрагмента текста. Если работ нет, верни пустой массив []. Формат: строго JSON массив объектов { "task_name": string, "periodicity": string, "instructions": string[] }.'
        },
        { role: 'user', text }
      ]
    };

    try {
      // Прямой вызов YandexGPT
      const response = await fetch(YANDEX_ENDPOINTS.GPT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${settings.yandexApiKey}`,
          'x-folder-id': settings.yandexFolderId
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        console.warn('Direct YandexGPT failed, trying proxy...');
        const proxyResponse = await fetch(API_ENDPOINTS.GPT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: settings.yandexApiKey,
            folderId: settings.yandexFolderId,
            body
          })
        });
        if (!proxyResponse.ok) throw new Error(`GPT failed: ${proxyResponse.status}`);
        const data = await proxyResponse.json();
        const resultText = data.result.alternatives[0].message.text;
        const jsonStr = resultText.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
      }

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
    const body = {
      modelUri: `gpt://${settings.yandexFolderId}/yandexgpt/latest`,
      completionOptions: { temperature: 0.2, maxTokens: 2000 },
      messages: [
        {
          role: 'system',
          text: 'Ты — технический эксперт. Тебе дан список задач по ТО и правил, извлеченных из разных частей инструкции. Твоя задача: 1. Удалить дубликаты. 2. Слить похожие задачи, выбрав наиболее безопасный (частый) интервал. 3. Выделить 3-5 самых важных правил безопасности. Формат: строго JSON { "name": string, "type": string, "maintenance_schedule": [...], "important_rules": [...] }.'
        },
        { role: 'user', text: JSON.stringify({ tasks, rules }) }
      ]
    };

    try {
      const response = await fetch(YANDEX_ENDPOINTS.GPT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${settings.yandexApiKey}`,
          'x-folder-id': settings.yandexFolderId
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        console.warn('Direct YandexGPT Merge failed, trying proxy...');
        const proxyResponse = await fetch(API_ENDPOINTS.GPT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: settings.yandexApiKey,
            folderId: settings.yandexFolderId,
            body
          })
        });
        if (!proxyResponse.ok) throw new Error(`GPT failed: ${proxyResponse.status}`);
        const data = await proxyResponse.json();
        const resultText = data.result.alternatives[0].message.text;
        const jsonStr = resultText.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
      }

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
