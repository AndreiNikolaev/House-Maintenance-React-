import { AppSettings, Equipment } from '../types';
import { logger } from './logger';
import { API_ENDPOINTS } from '../config';
import { apiRequest } from './api';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

const YANDEX_ENDPOINTS = {
  SEARCH: 'https://searchapi.api.cloud.yandex.net/v2/web/searchAsync',
  GPT: 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion'
};

function parseYandexXml(xmlString: string): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = [];
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const groupNodes = xmlDoc.getElementsByTagName("group");
    
    for (let i = 0; i < groupNodes.length; i++) {
      const docNode = groupNodes[i].getElementsByTagName("doc")[0];
      if (docNode) {
        const url = docNode.getElementsByTagName("url")[0]?.textContent;
        const titleNode = docNode.getElementsByTagName("title")[0];
        // Очистка заголовка от XML тегов (hlword)
        const title = titleNode?.textContent || 'Без названия';
        
        if (url) {
          results.push({ title, url });
        }
      }
    }
  } catch (e) {
    console.error('Error parsing Yandex XML', e);
  }
  return results;
}

export const yandexApi = {
  async searchV2(query: string, settings: AppSettings): Promise<{ title: string; url: string }[]> {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      logger.add('request', 'YandexSearch', 'searchV2_native', { query });
      const url = `${YANDEX_ENDPOINTS.SEARCH}?folderid=${settings.yandexFolderId}&apikey=${settings.yandexSearchApiKey}&query=${encodeURIComponent(query + ' инструкция по обслуживанию pdf')}`;
      
      try {
        const response = await CapacitorHttp.get({ url });
        const results = parseYandexXml(response.data);
        logger.add('response', 'YandexSearch', 'searchV2_native', { count: results.length });
        return results;
      } catch (err: any) {
        logger.add('error', 'YandexSearch', 'searchV2_native', { error: err.message });
        throw err;
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
