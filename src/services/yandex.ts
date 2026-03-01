import { AppSettings, Equipment } from '../types';
import { logger } from './logger';
import { API_ENDPOINTS } from '../config';
import { apiRequest } from './api';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

const YANDEX_ENDPOINTS = {
  SEARCH: 'https://searchapi.api.cloud.yandex.net/v2/web/search',
  GPT: 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion'
};

function parseYandexResponse(data: any): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = [];
  try {
    // 1. Проверка на формат JSON (Yandex Cloud API v2)
    if (data?.results?.items) {
      return data.results.items.map((item: any) => ({
        title: item.title || 'Без названия',
        url: item.url
      })).filter((i: any) => i.url);
    }
    
    // 2. Проверка на массив (уже распарсенный прокси-сервером)
    if (Array.isArray(data)) {
      return data;
    }

    // 3. Если пришла строка (возможно XML), но мы в нативном режиме ожидаем JSON
    console.warn('[Yandex Parser] Unexpected data format:', typeof data);
  } catch (e) {
    console.error('[Yandex Parser] Error:', e);
  }
  return results;
}

export const yandexApi = {
  async searchV2(query: string, settings: AppSettings): Promise<{ title: string; url: string }[]> {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      logger.add('request', 'YandexSearch', 'searchV2_native', { query });
      try {
        console.log('[Yandex Search] Sending direct POST request to v2 API');
        const response = await CapacitorHttp.post({
          url: YANDEX_ENDPOINTS.SEARCH,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Api-Key ${settings.yandexSearchApiKey}`
          },
          data: {
            folderId: settings.yandexFolderId,
            query: {
              searchType: "SEARCH_TYPE_RU",
              queryText: query + ' инструкция по обслуживанию pdf'
            },
            responseFormat: "FORMAT_JSON"
          }
        });
        
        if (response.status !== 200) {
          const errData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
          console.error(`[Yandex Search] API Error ${response.status}:`, errData);
          throw new Error(`Yandex API Error ${response.status}: ${errData}`);
        }

        const results = parseYandexResponse(response.data);
        logger.add('response', 'YandexSearch', 'searchV2_native', { count: results.length });
        return results;
      } catch (err: any) {
        logger.add('error', 'YandexSearch', 'searchV2_native', { error: err.message });
        console.warn('[Yandex Search] Direct call failed, falling back to proxy...', err.message);
        // If direct fails, we try the proxy (which might hit the Cookie Check)
      }
    }

    // Web fallback via proxy
    logger.add('request', 'YandexSearch', 'searchV2_proxy', { query });
    try {
      const results = await apiRequest({
        url: API_ENDPOINTS.SEARCH,
        method: 'POST',
        body: { 
          query, 
          apiKey: settings.yandexSearchApiKey,
          folderId: settings.yandexFolderId
        }
      });
      return Array.isArray(results) ? results : [];
    } catch (err: any) {
      throw err;
    }
  },

  async processChunk(text: string, settings: AppSettings): Promise<any[]> {
    const isNative = Capacitor.isNativePlatform();
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
      let data;
      if (isNative) {
        const response = await CapacitorHttp.post({
          url: YANDEX_ENDPOINTS.GPT,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Api-Key ${settings.yandexApiKey}`,
            'x-folder-id': settings.yandexFolderId
          },
          data: body
        });
        data = response.data;
      } else {
        data = await apiRequest({
          url: API_ENDPOINTS.GPT,
          method: 'POST',
          body: {
            apiKey: settings.yandexApiKey,
            folderId: settings.yandexFolderId,
            body
          }
        });
      }

      const resultText = data.result.alternatives[0].message.text;
      const jsonStr = resultText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      return [];
    }
  },

  async mergeResults(tasks: any[], rules: string[], settings: AppSettings): Promise<Partial<Equipment>> {
    const isNative = Capacitor.isNativePlatform();
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
      let data;
      if (isNative) {
        const response = await CapacitorHttp.post({
          url: YANDEX_ENDPOINTS.GPT,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Api-Key ${settings.yandexApiKey}`,
            'x-folder-id': settings.yandexFolderId
          },
          data: body
        });
        data = response.data;
      } else {
        data = await apiRequest({
          url: API_ENDPOINTS.GPT,
          method: 'POST',
          body: {
            apiKey: settings.yandexApiKey,
            folderId: settings.yandexFolderId,
            body
          }
        });
      }

      const resultText = data.result.alternatives[0].message.text;
      const jsonStr = resultText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      
      return {
        name: parsed.name || '',
        type: parsed.type || '',
        maintenance_schedule: Array.isArray(parsed.maintenance_schedule) ? parsed.maintenance_schedule : [],
        important_rules: Array.isArray(parsed.important_rules) ? parsed.important_rules : []
      };
    } catch (err: any) {
      throw err;
    }
  }
};
