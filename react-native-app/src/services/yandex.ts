import { AppSettings, Equipment } from '../types';

export const yandexApi = {
  async searchV2(query: string, settings: AppSettings): Promise<{ title: string; url: string }[]> {
    console.log(`[REQUEST] YandexSearch.searchV2: ${query}`);
    
    if (!settings.yandexSearchApiKey) throw new Error('Search API Key missing');

    try {
      // In a real app, this would be a direct call to Yandex Search API v2
      // For this demo, we simulate the structure of Yandex Search API v2 response
      const mockResults = [
        { title: `Инструкция ${query} (Официальный PDF)`, url: `https://example.com/manuals/${query.replace(/\s+/g, '_')}_manual.pdf` },
        { title: `Руководство пользователя ${query}`, url: `https://manuals-lib.ru/data/${query.replace(/\s+/g, '_')}.pdf` },
        { title: `Технический регламент ${query}`, url: `https://service-center.pro/docs/service_${query.replace(/\s+/g, '_')}.pdf` }
      ];

      console.log(`[RESPONSE] YandexSearch.searchV2:`, mockResults);
      return mockResults;
    } catch (err: any) {
      console.error(`[ERROR] YandexSearch.searchV2:`, err.message);
      throw err;
    }
  },

  async processChunk(text: string, settings: AppSettings): Promise<any[]> {
    console.log(`[REQUEST] YandexGPT.processChunk: textLength=${text.length}`);

    try {
      const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${settings.yandexApiKey}`,
          'x-folder-id': settings.yandexFolderId
        },
        body: JSON.stringify({
          modelUri: `gpt://${settings.yandexFolderId}/yandexgpt/latest`,
          completionOptions: { temperature: 0.1, maxTokens: 2000 },
          messages: [
            {
              role: 'system',
              text: 'Ты — технический ассистент. Извлеки список регламентных работ по техническому обслуживанию из предоставленного фрагмента текста. Если работ нет, верни пустой массив []. Формат: строго JSON массив объектов { "task_name": string, "periodicity": string, "instructions": string[] }.'
            },
            { role: 'user', text }
          ]
        })
      });

      const data = await response.json();
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
      const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${settings.yandexApiKey}`,
          'x-folder-id': settings.yandexFolderId
        },
        body: JSON.stringify({
          modelUri: `gpt://${settings.yandexFolderId}/yandexgpt/latest`,
          completionOptions: { temperature: 0.2, maxTokens: 2000 },
          messages: [
            {
              role: 'system',
              text: 'Ты — технический эксперт. Тебе дан список задач по ТО и правил, извлеченных из разных частей инструкции. Твоя задача: 1. Удалить дубликаты. 2. Слить похожие задачи, выбрав наиболее безопасный (частый) интервал. 3. Выделить 3-5 самых важных правил безопасности. Формат: строго JSON { "name": string, "type": string, "maintenance_schedule": [...], "important_rules": [...] }.'
            },
            { role: 'user', text: JSON.stringify({ tasks, rules }) }
          ]
        })
      });

      const data = await response.json();
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
