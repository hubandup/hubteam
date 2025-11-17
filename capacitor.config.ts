import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.39a910bf2d1848979fc5f0c02f976fb1',
  appName: 'HubTeam',
  webDir: 'dist',
  server: {
    url: 'https://39a910bf-2d18-4897-9fc5-f0c02f976fb1.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
