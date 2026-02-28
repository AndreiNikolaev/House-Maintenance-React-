import { CapacitorHttp, Capacitor } from '@capacitor/core';

export async function apiRequest(options: {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
}) {
  console.log(`[API] ${options.method} ${options.url}`);
  
  if (Capacitor.isNativePlatform()) {
    try {
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
      
      console.log(`[API Native] Status: ${response.status}`);
      
      if (response.status < 200 || response.status >= 300) {
        const errorMsg = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        throw new Error(`API Error (${response.status}): ${errorMsg}`);
      }
      
      return response.data;
    } catch (err: any) {
      console.error(`[API Native Error]`, err);
      throw err;
    }
  } else {
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
}
