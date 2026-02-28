
import { apiLogger } from './logger';

const YANDEX_API_KEY = import.meta.env.VITE_YANDEX_API_KEY;

export interface YandexResponse<T> {
  code: number;
  message?: string;
  data: T;
}

class YandexService {
  private baseUrl = 'https://translate.yandex.net/api/v1.5/tr.json';

  async translate(text: string, lang: string = 'en-ru'): Promise<any> {
    const url = `${this.baseUrl}/translate?key=${YANDEX_API_KEY}&text=${encodeURIComponent(text)}&lang=${lang}`;
    
    apiLogger.logRequest('Yandex Translate', 'GET', url, { text, lang });

    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        apiLogger.logError('Yandex Translate', 'GET', url, data);
        throw new Error(data.message || 'Yandex API error');
      }

      apiLogger.logResponse('Yandex Translate', 'GET', url, data);
      return data;
    } catch (error: any) {
      apiLogger.logError('Yandex Translate', 'GET', url, error.message);
      throw error;
    }
  }

  // Generic Yandex API call method for other services
  async callYandexApi(service: string, endpoint: string, params: Record<string, string>): Promise<any> {
    const query = new URLSearchParams({ ...params, key: YANDEX_API_KEY }).toString();
    const url = `${endpoint}?${query}`;

    apiLogger.logRequest(service, 'GET', url, params);

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        apiLogger.logError(service, 'GET', url, data);
        throw new Error(data.message || `${service} API error`);
      }

      apiLogger.logResponse(service, 'GET', url, data);
      return data;
    } catch (error: any) {
      apiLogger.logError(service, 'GET', url, error.message);
      throw error;
    }
  }
}

export const yandexService = new YandexService();
