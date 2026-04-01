import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useDesignSettings() {
  useEffect(() => {
    loadAndApplyDesignSettings();
  }, []);

  const loadAndApplyDesignSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('design_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        applyDesignSettings(data);
      }
    } catch (error) {
      console.error('Error loading design settings:', error);
    }
  };

  const applyDesignSettings = (data: any) => {
    const root = document.documentElement;
    
    // Apply fonts — force Instrument Sans over any DB value (e.g. Poppins)
    const headingFont = 'Instrument Sans';
    const bodyFont = 'Instrument Sans';
    root.style.setProperty('--font-heading', headingFont);
    root.style.setProperty('--font-heading-weight', data.heading_font_weight || '700');
    root.style.setProperty('--font-heading-size', data.heading_font_size || '2.5rem');
    root.style.setProperty('--font-body', bodyFont);
    root.style.setProperty('--font-body-weight', data.body_font_weight || '400');
    root.style.setProperty('--font-body-size', data.body_font_size || '1rem');
    
    // Apply colors while preserving the global black primary for buttons and active states
    root.style.setProperty('--primary', '0 0% 9%');
    root.style.setProperty('--primary-light', '0 0% 96%');
    root.style.setProperty('--ring', '0 0% 9%');
    root.style.setProperty('--secondary', data.light_secondary);
    root.style.setProperty('--background', '0 0% 100%');
    
    // Apply dark mode colors while preserving the same primary override
    const style = document.getElementById('dynamic-theme-style') || document.createElement('style');
    style.id = 'dynamic-theme-style';
    style.innerHTML = `
      .dark {
        --primary: 0 0% 9% !important;
        --primary-light: 0 0% 96% !important;
        --ring: 0 0% 9% !important;
        --secondary: ${data.dark_secondary} !important;
        --background: ${data.dark_background} !important;
      }
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
    loadGoogleFonts(data.heading_font, data.body_font);
  };

  const loadGoogleFonts = (headingFont: string, bodyFont: string) => {
    const existingLink = document.getElementById('google-fonts-link');
    if (existingLink) {
      existingLink.remove();
    }
    
    const fonts = [headingFont, bodyFont].filter((f, i, arr) => arr.indexOf(f) === i);
    const fontQuery = fonts.map(f => f.replace(/ /g, '+')).join('&family=');
    
    const link = document.createElement('link');
    link.id = 'google-fonts-link';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}:wght@300;400;500;600;700;800&display=swap`;
    document.head.appendChild(link);
  };
}
