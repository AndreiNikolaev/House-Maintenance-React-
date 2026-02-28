
export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'request' | 'response' | 'error';
  service: string;
  method: string;
  url: string;
  data: any;
}

class ApiLogger {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  logRequest(service: string, method: string, url: string, data: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      type: 'request',
      service,
      method,
      url,
      data,
    };
    this.addLog(entry);
    console.log(`[${service}] REQUEST:`, method, url, data);
  }

  logResponse(service: string, method: string, url: string, data: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      type: 'response',
      service,
      method,
      url,
      data,
    };
    this.addLog(entry);
    console.log(`[${service}] RESPONSE:`, method, url, data);
  }

  logError(service: string, method: string, url: string, error: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      type: 'error',
      service,
      method,
      url,
      data: error,
    };
    this.addLog(entry);
    console.error(`[${service}] ERROR:`, method, url, error);
  }

  private addLog(entry: LogEntry) {
    this.logs = [entry, ...this.logs].slice(0, 50); // Keep last 50
    this.notify();
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    listener(this.logs);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.logs));
  }

  getLogs() {
    return this.logs;
  }
}

export const apiLogger = new ApiLogger();
