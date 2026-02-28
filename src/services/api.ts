import { CapacitorHttp, Capacitor } from '@capacitor/core';

export async function apiRequest(options: {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
}) {
  const platform = Capacitor.getPlatform();
  console.log(`[API] Platform: ${platform}, Method: ${options.method}, URL: ${options.url}`);
  
  // В Capacitor на Android/iOS используем нативный HTTP для обхода CORS
  if (platform === 'android' || platform === 'ios') {
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
      
      if (response.status < 200 || response.status >= 300) {
        const errorMsg = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        throw new Error(`API Error (${response.status}): ${errorMsg}`);
      }
      
      return response.data;
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
