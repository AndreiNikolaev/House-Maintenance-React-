import { CapacitorHttp, Capacitor } from '@capacitor/core';

export async function apiRequest(options: {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
}) {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  if (isNative || platform === 'android' || platform === 'ios') {
    try {
      const response = await CapacitorHttp.request({
        url: options.url,
        method: options.method,
        headers,
        data: options.body,
      });

      let data = response.data;
      
      // Если мы получили HTML от нашего домена - это Cookie Check
      if (typeof data === 'string' && data.includes('<html') && (options.url.includes('ais-dev') || options.url.includes('ais-pre'))) {
        console.error('[API Native] Cookie Check detected. Data:', data.substring(0, 100));
        throw new Error('Infrastructure Error: Cookie Check blocked the request. Please open the app URL in your mobile browser once to authorize.');
      }

      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) {}
      }

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`API Error (${response.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`);
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
