import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maintenance.app',
  appName: 'Maintenance Assistant',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
