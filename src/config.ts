export const CONFIG = {
  // Version for tracking
  VERSION: 'V10-CAP',
  
  // Base URL logic
  get API_BASE_URL() {
    // Check if running in Capacitor
    const isCapacitor = (window as any).Capacitor !== undefined;
    
    if (isCapacitor) {
      // In Capacitor, we MUST use the absolute URL of the server
      return 'https://ais-dev-k2c2igcw5ci2gj2crw2z3x-140003515535.us-east1.run.app';
    }
    
    // In browser, relative paths are fine and better for AI Studio session
    return '';
  }
};
