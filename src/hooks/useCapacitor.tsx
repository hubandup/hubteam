import { useEffect } from 'react';
import { useIsNative } from './use-mobile';

export function useCapacitor() {
  const isNative = useIsNative();

  useEffect(() => {
    if (!isNative) return;

    const initCapacitor = async () => {
      try {
        // Import Capacitor plugins dynamically
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const { Keyboard } = await import('@capacitor/keyboard');
        const { App } = await import('@capacitor/app');

        // Configure status bar
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#ffffff' });

        // Configure keyboard
        Keyboard.setAccessoryBarVisible({ isVisible: true });

        // Listen for app state changes
        App.addListener('appStateChange', ({ isActive }) => {
          console.log('App state changed. Is active?', isActive);
        });

        // Listen for back button on Android
        App.addListener('backButton', ({ canGoBack }) => {
          if (!canGoBack) {
            App.exitApp();
          } else {
            window.history.back();
          }
        });

        console.log('Capacitor initialized successfully');
      } catch (error) {
        console.error('Error initializing Capacitor:', error);
      }
    };

    initCapacitor();
  }, [isNative]);

  return { isNative };
}
