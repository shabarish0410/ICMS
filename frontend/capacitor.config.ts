import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.innovationcenter.spark',
  appName: 'Spark Innovation Center',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*']
  }
};

export default config;
