export const CONFIG = {
  // Use relative paths in browser to avoid CORS/Auth issues in AI Studio preview
  API_BASE_URL: (typeof window !== 'undefined') ? '' : 'https://ais-dev-k2c2igcw5ci2gj2crw2z3x-140003515535.us-east1.run.app'
};
