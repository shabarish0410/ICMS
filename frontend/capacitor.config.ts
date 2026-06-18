import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.innovationcenter.icms',
  appName: 'ICMS',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*']
  }
};

export default config;
