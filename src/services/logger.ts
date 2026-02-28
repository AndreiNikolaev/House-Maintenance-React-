export type LogType = 'request' | 'response' | 'error';

export const logger = {
  add: (type: LogType, service: string, method: string, data: any) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${type.toUpperCase()} ${service}.${method}:`;
    
    if (type === 'error') {
      console.error(prefix, data);
    } else if (type === 'request') {
      console.info(prefix, data);
    } else {
      console.log(prefix, data);
    }
  },
  
  clear: () => {
    console.clear();
  }
};
