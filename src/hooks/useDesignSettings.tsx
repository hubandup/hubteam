import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DesignSettings {
  id: string;
  heading_font: string;
  body_font: string;
  light_primary: string;
  light_secondary: string;
  light_background: string;
  dark_primary: string;
  dark_secondary: string;
  dark_background: string;
}

export function useDesignSettings() {
  const [settings, setSettings] = useState<DesignSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('design_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching design settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<DesignSettings>) => {
    if (!settings) return;

    try {
      const { error } = await supabase
        .from('design_settings')
        .update(updates)
        .eq('id', settings.id);

      if (error) throw error;
      
      await fetchSettings();
      return { success: true };
    } catch (error) {
      console.error('Error updating design settings:', error);
      return { success: false, error };
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    refetch: fetchSettings,
  };
}
