
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yandex.connect',
  appName: 'Yandex Connect',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
