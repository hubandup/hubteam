import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Register service worker (push notifications) — skip in Lovable preview/dev to avoid stale caches
const host = typeof window !== 'undefined' ? window.location.hostname : '';
const isLovablePreview =
  host.startsWith('id-preview--') ||
  host.startsWith('preview--') ||
  host.endsWith('.lovableproject.com') ||
  host.endsWith('.lovableproject-dev.com') ||
  host.endsWith('.beta.lovable.dev');
const inIframe = typeof window !== 'undefined' && window.self !== window.top;
const swDisabled = typeof window !== 'undefined' && window.location.search.includes('sw=off');

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD && !isLovablePreview && !inIframe && !swDisabled) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .catch(error => console.error('SW registration failed:', error));
    });
  } else {
    // Unregister any previously installed SW in dev/preview to evict stale caches
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    }).catch(() => {});
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
    }
  }
}

createRoot(document.getElementById("root")!).render(<App />);
