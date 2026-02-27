export const CONFIG = {
  // Version for tracking
  VERSION: 'V9',
  
  // Base URL logic
  get API_BASE_URL() {
    if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
      // In browser (preview), use the current origin
      return window.location.origin.replace(/\/$/, '');
    }
    // Fallback for native environment
    return 'https://ais-dev-k2c2igcw5ci2gj2crw2z3x-140003515535.us-east1.run.app'.replace(/\/$/, '');
  }
};
