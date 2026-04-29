import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function fetchDesignSettings() {
  const { data, error } = await supabase
    .from('design_settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function useDesignSettings() {
  const applied = useRef(false);

  const { data } = useQuery({
    queryKey: ['design-settings'],
    queryFn: fetchDesignSettings,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (!data) return;
    if (applied.current) return;
    applied.current = true;
    applyDesignSettings(data);
  }, [data]);
}

function applyDesignSettings(data: any) {
  const root = document.documentElement;

  // Apply fonts — force Instrument Sans
  const headingFont = 'Instrument Sans';
  const bodyFont = 'Instrument Sans';
  root.style.setProperty('--font-heading', headingFont);
  root.style.setProperty('--font-heading-weight', data.heading_font_weight || '700');
  root.style.setProperty('--font-heading-size', data.heading_font_size || '2.5rem');
  root.style.setProperty('--font-body', bodyFont);
  root.style.setProperty('--font-body-weight', data.body_font_weight || '400');
  root.style.setProperty('--font-body-size', data.body_font_size || '1rem');

  // NOTE: Color tokens (--primary, --background, --secondary, --ring) are
  // intentionally NOT overridden here — index.css owns the light/dark palette
  // so dark mode works consistently across the app. Only radius is enforced.
  const style = document.getElementById('dynamic-theme-style') || document.createElement('style');
  style.id = 'dynamic-theme-style';
  style.innerHTML = `
    button, [role="tab"], .btn,
    [data-radix-collection-item],
    [class*="rounded"] {
      border-radius: 0 !important;
    }
  `;
  if (!document.getElementById('dynamic-theme-style')) {
    document.head.appendChild(style);
  }

  // Load Google Fonts
  loadGoogleFonts(headingFont, bodyFont);
}

function loadGoogleFonts(headingFont: string, bodyFont: string) {
  const existingLink = document.getElementById('google-fonts-link');
  if (existingLink) return; // Already loaded — skip

  const fonts = [headingFont, bodyFont].filter((f, i, arr) => arr.indexOf(f) === i);
  const fontQuery = fonts.map(f => f.replace(/ /g, '+')).join('&family=');

  const link = document.createElement('link');
  link.id = 'google-fonts-link';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}
