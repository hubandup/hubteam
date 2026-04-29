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

        // Configure status bar — match sidebar (Layout uses bg-sidebar in mobile)
        // Capacitor StatusBar API requires a hex color, not a CSS variable
        const isDark = document.documentElement.classList.contains('dark');
        await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
        await StatusBar.setBackgroundColor({ color: isDark ? '#0a0e1a' : '#0f1422' });

        // Configure keyboard
        Keyboard.setAccessoryBarVisible({ isVisible: true });

        // Listen for app state changes
        App.addListener('appStateChange', ({ isActive }) => {
          // App state changed
        });

        // Listen for back button on Android
        App.addListener('backButton', ({ canGoBack }) => {
          if (!canGoBack) {
            App.exitApp();
          } else {
            window.history.back();
          }
        });
      } catch (error) {
        console.error('Error initializing Capacitor:', error);
      }
    };

    initCapacitor();
  }, [isNative]);

  return { isNative };
}
