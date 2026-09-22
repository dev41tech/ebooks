import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'cloud.tech41.sambu',
  appName: 'Sambu',
  webDir: 'dist-native',
  backgroundColor: '#101015',
  // Bundle the shared UI locally. Do not point server.url at the private beta.
  android: { allowMixedContent: false },
};
export default config;
