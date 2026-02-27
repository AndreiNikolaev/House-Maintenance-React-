export const CONFIG = {
  // Use full origin in browser, fallback to hardcoded URL for native
  API_BASE_URL: (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null') 
    ? window.location.origin 
    : 'https://ais-dev-k2c2igcw5ci2gj2crw2z3x-140003515535.us-east1.run.app'
};
