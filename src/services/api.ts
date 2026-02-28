import { CapacitorHttp, Capacitor } from '@capacitor/core';

export async function apiRequest(options: {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
}) {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  console.log(`[API] Platform: ${platform}, isNative: ${isNative}, Method: ${options.method}, URL: ${options.url}`);
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
    ...options.headers,
  };

  if (isNative || platform === 'android' || platform === 'ios') {
    try {
      console.log(`[API Native] Requesting...`);
      const response = await CapacitorHttp.request({
        url: options.url,
        method: options.method,
        headers,
        data: options.body,
        connectTimeout: 10000,
        readTimeout: 10000,
      });
      
      console.log(`[API Native] Status: ${response.status}, Type: ${response.headers['content-type'] || response.headers['Content-Type']}`);
      
      let data = response.data;
      
      // Проверка на перехват инфраструктурой (Cookie Check / Login Page)
      const contentType = (response.headers['content-type'] || response.headers['Content-Type'] || '').toLowerCase();
      if (contentType.includes('text/html') && typeof data === 'string' && data.includes('<html')) {
        console.warn(`[API Native] Detected HTML response (infrastructure challenge).`);
        console.log(`[API Native] HTML Preview: ${data.substring(0, 200)}`);
        
        // Если мы получили страницу проверки кук, попробуем "прогреть" сессию
        if (data.includes('Cookie check') || data.includes('__cookie_check')) {
          console.log(`[API Native] Attempting session warmup...`);
          await CapacitorHttp.get({ url: options.url.split('/api')[0] + '/' });
          // Повторяем запрос один раз
          console.log(`[API Native] Retrying original request after warmup...`);
          const retryResponse = await CapacitorHttp.request({
            url: options.url,
            method: options.method,
            headers,
            data: options.body,
          });
          data = retryResponse.data;
          if (retryResponse.status >= 200 && retryResponse.status < 300 && !(typeof data === 'string' && data.includes('<html'))) {
             // Success on retry
             if (typeof data === 'string') {
               try { data = JSON.parse(data); } catch (e) {}
             }
             return data;
          }
        }
        throw new Error('Сервер вернул HTML вместо данных. Возможно, требуется авторизация в браузере или сессия истекла.');
      }

      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          // Not JSON
        }
      }

      if (response.status < 200 || response.status >= 300) {
        const errorMsg = typeof data === 'string' ? data : JSON.stringify(data);
        throw new Error(`API Error (${response.status}): ${errorMsg}`);
      }
      
      return data;
    } catch (err: any) {
      console.error(`[API Native Error]`, err);
      throw err;
    }
  } else {
    // Web fallback
    const response = await fetch(options.url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API Error (${response.status}): ${text}`);
    }
    
    return await response.json();
  }
}
