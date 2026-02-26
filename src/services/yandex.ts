import { AppSettings, Equipment } from '../types';

export const yandexApi = {
  async searchInstructions(model: string, settings: AppSettings): Promise<string[]> {
    if (!settings.yandexSearchApiKey) throw new Error('Search API Key missing');
    
    const query = encodeURIComponent(`${model} инструкция по эксплуатации filetype:pdf`);
    // Note: In a real app, you'd use a proxy. Here we simulate the structure.
    console.log(`Searching for: ${query}`);
    
    // Mocking search results for demo if no key
    return [
      `https://example.com/manuals/${model.replace(/\s+/g, '_')}.pdf`,
    ];
  },

  async extractData(text: string, settings: AppSettings): Promise<Partial<Equipment>> {
    if (!settings.yandexApiKey || !settings.yandexFolderId) throw new Error('YandexGPT credentials missing');

    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${settings.yandexApiKey}`,
        'x-folder-id': settings.yandexFolderId
      },
      body: JSON.stringify({
        modelUri: `gpt://${settings.yandexFolderId}/yandexgpt/latest`,
        completionOptions: {
          temperature: 0.3,
          maxTokens: 2000
        },
        messages: [
          {
            role: 'system',
            text: 'Ты — технический эксперт. Извлеки график регулярного ТО из текста. Игнорируй монтаж. Формат ответа: строго JSON с полями name, type, maintenance_schedule (task_name, periodicity, instructions), important_rules.'
          },
          {
            role: 'user',
            text: text
          }
        ]
      })
    });

    const data = await response.json();
    const resultText = data.result.alternatives[0].message.text;
    
    // Clean JSON from markdown if present
    const jsonStr = resultText.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  }
};
