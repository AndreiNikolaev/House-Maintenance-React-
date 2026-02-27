export const CONFIG = {
  // Use relative paths in browser to ensure cookies are sent automatically by the browser.
  // This avoids AI Studio session issues with absolute URLs.
  API_BASE_URL: (typeof window !== 'undefined') 
    ? '' 
    : 'https://ais-dev-k2c2igcw5ci2gj2crw2z3x-140003515535.us-east1.run.app',
  VERSION: 'V8'
};
