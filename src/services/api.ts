import { CapacitorHttp, Capacitor } from '@capacitor/core';

export async function apiRequest(options: {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
}) {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  const baseUrl = options.url.split('/api')[0];
  
  console.log(`[API] Platform: ${platform}, isNative: ${isNative}, Method: ${options.method}, URL: ${options.url}`);
  
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/html, application/xhtml+xml, */*',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Referer': baseUrl + '/',
    'Origin': baseUrl,
    ...options.headers,
  });

  if (isNative || platform === 'android' || platform === 'ios') {
    try {
      const performRequest = async (isRetry = false): Promise<any> => {
        console.log(`[API Native] ${isRetry ? 'Retrying' : 'Requesting'}...`);
        const response = await CapacitorHttp.request({
          url: options.url,
          method: options.method,
          headers: getHeaders(),
          data: options.body,
          connectTimeout: 15000,
          readTimeout: 15000,
        });

        const contentType = (response.headers['content-type'] || response.headers['Content-Type'] || '').toLowerCase();
        const isHtml = contentType.includes('text/html');
        const isOurServer = response.headers['x-app-server'] === 'V6' || response.headers['X-App-Server'] === 'V6';
        
        // Если это HTML и НЕ наш сервер — это проверка кук
        if (isHtml && !isOurServer && !isRetry) {
          console.warn(`[API Native] Infrastructure challenge detected. Starting aggressive warmup...`);
          
          // 1. Загружаем корень
          await CapacitorHttp.get({ url: baseUrl + '/', headers: getHeaders() });
          
          // 2. Загружаем страницу инициализации сессии
          await CapacitorHttp.get({ url: baseUrl + '/api/init-session', headers: getHeaders() });
          
          // 3. Небольшая пауза для записи кук в нативный стор
          await new Promise(r => setTimeout(r, 500));
          
          // 4. Повторяем основной запрос
          return performRequest(true);
        }

        let data = response.data;
        if (typeof data === 'string' && (isHtml || !isOurServer)) {
          if (data.includes('Cookie check') || data.includes('__cookie_check')) {
            if (!isRetry) return performRequest(true);
            throw new Error('Не удалось пройти проверку Cookie инфраструктуры. Попробуйте открыть URL приложения в браузере устройства.');
          }
          try { data = JSON.parse(data); } catch (e) { /* keep as string */ }
        }

        if (response.status < 200 || response.status >= 300) {
          const errorMsg = typeof data === 'string' ? data : JSON.stringify(data);
          throw new Error(`API Error (${response.status}): ${errorMsg}`);
        }
        
        return data;
      };

      return await performRequest();
    } catch (err: any) {
      console.error(`[API Native Error]`, err);
      throw err;
    }
  } else {
    // Web fallback
    const response = await fetch(options.url, {
      method: options.method,
      headers: getHeaders(),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API Error (${response.status}): ${text}`);
    }
    
    return await response.json();
  }
}
