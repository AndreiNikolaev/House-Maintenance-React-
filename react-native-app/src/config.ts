export const CONFIG = {
  // Version for tracking
  VERSION: 'V10',
  
  // Base URL logic
  get API_BASE_URL() {
    if (typeof window !== 'undefined') {
      // In browser (preview), MUST use relative paths starting with /
      // to ensure the browser handles cookies and origin correctly.
      return ''; 
    }
    // Fallback for native environment
    return 'https://ais-dev-k2c2igcw5ci2gj2crw2z3x-140003515535.us-east1.run.app';
  }
};
