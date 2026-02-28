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
  
  // В Capacitor на Android/iOS используем нативный HTTP для обхода CORS
  // Мы проверяем и платформу, и флаг isNative для максимальной надежности
  if (isNative || platform === 'android' || platform === 'ios') {
    try {
      console.log(`[API Native] Attempting native request...`);
      const response = await CapacitorHttp.request({
        url: options.url,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        data: options.body,
      });
      
      console.log(`[API Native] Success. Status: ${response.status}`);
      
      let data = response.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          // Not JSON, keep as string
        }
      }

      if (response.status < 200 || response.status >= 300) {
        const errorMsg = typeof data === 'string' ? data : JSON.stringify(data);
        throw new Error(`API Error (${response.status}): ${errorMsg}`);
      }
      
      return data;
    } catch (err: any) {
      console.error(`[API Native Error] Critical:`, err);
      // Если нативный запрос упал, пробуем fetch как последний шанс
      console.log(`[API Native] Falling back to fetch...`);
    }
  }

  // Web fallback (или если нативный запрос не удался)
  console.log(`[API Web] Using standard fetch...`);
  const response = await fetch(options.url, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  console.log(`[API Web] Status: ${response.status}`);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error (${response.status}): ${text}`);
  }
  
  return await response.json();
}
