import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Palette } from 'lucide-react';

// Conversion functions
function hslToHex(hsl: string): string {
  const [h, s, l] = hsl.split(' ').map(v => parseFloat(v));
  const sDecimal = s / 100;
  const lDecimal = l / 100;
  
  const c = (1 - Math.abs(2 * lDecimal - 1)) * sDecimal;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lDecimal - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }
  
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return `${h} ${s}% ${l}%`;
}

interface DesignSettings {
  id?: string;
  heading_font: string;
  body_font: string;
  light_primary: string;
  light_secondary: string;
  light_background: string;
  dark_primary: string;
  dark_secondary: string;
  dark_background: string;
}

export function DesignTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<DesignSettings>({
    heading_font: 'Instrument Sans',
    body_font: 'Roboto',
    light_primary: '210 100% 30%',
    light_secondary: '210 60% 50%',
    light_background: '0 0% 100%',
    dark_primary: '60 100% 70%',
    dark_secondary: '210 60% 60%',
    dark_background: '220 15% 15%',
  });

  useEffect(() => {
    loadDesignSettings();
  }, []);

  const loadDesignSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('design_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings(data);
        applyDesignSettings(data);
      }
    } catch (error) {
      console.error('Error loading design settings:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les paramètres de design.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const applyDesignSettings = (data: DesignSettings) => {
    const root = document.documentElement;
    
    // Apply fonts
    root.style.setProperty('--font-heading', data.heading_font);
    root.style.setProperty('--font-body', data.body_font);
    
    // Apply light mode colors
    root.style.setProperty('--primary', data.light_primary);
    root.style.setProperty('--secondary', data.light_secondary);
    root.style.setProperty('--background', data.light_background);
    
    // Apply dark mode colors
    const style = document.getElementById('dynamic-theme-style') || document.createElement('style');
    style.id = 'dynamic-theme-style';
    style.innerHTML = `
      .dark {
        --primary: ${data.dark_primary};
        --secondary: ${data.dark_secondary};
        --background: ${data.dark_background};
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
    link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}:wght@300;400;600;700&display=swap`;
    document.head.appendChild(link);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings.id) {
        const { error } = await supabase
          .from('design_settings')
          .update(settings)
          .eq('id', settings.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('design_settings')
          .insert(settings);
        
        if (error) throw error;
      }

      applyDesignSettings(settings);
      
      toast({
        title: 'Succès',
        description: 'Les paramètres de design ont été sauvegardés.',
      });
    } catch (error) {
      console.error('Error saving design settings:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Palette className="h-6 w-6" />
          Personnalisation du design
        </h2>
        <p className="text-muted-foreground mt-1">
          Personnalisez les polices et les couleurs de l'application
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Polices Google Fonts</CardTitle>
          <CardDescription>
            Entrez les noms exacts des polices depuis Google Fonts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="heading-font">Police des titres</Label>
            <Input
              id="heading-font"
              value={settings.heading_font}
              onChange={(e) => setSettings({ ...settings, heading_font: e.target.value })}
              placeholder="Instrument Sans"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body-font">Police du texte</Label>
            <Input
              id="body-font"
              value={settings.body_font}
              onChange={(e) => setSettings({ ...settings, body_font: e.target.value })}
              placeholder="Roboto"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Couleurs - Mode clair</CardTitle>
          <CardDescription>
            Sélectionnez vos couleurs avec le color picker
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="light-primary">Couleur primaire</Label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={hslToHex(settings.light_primary)}
                onChange={(e) => setSettings({ ...settings, light_primary: hexToHsl(e.target.value) })}
                className="h-10 w-20 rounded border border-input cursor-pointer"
              />
              <Input
                value={hslToHex(settings.light_primary)}
                onChange={(e) => setSettings({ ...settings, light_primary: hexToHsl(e.target.value) })}
                placeholder="#014a94"
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="light-secondary">Couleur secondaire</Label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={hslToHex(settings.light_secondary)}
                onChange={(e) => setSettings({ ...settings, light_secondary: hexToHsl(e.target.value) })}
                className="h-10 w-20 rounded border border-input cursor-pointer"
              />
              <Input
                value={hslToHex(settings.light_secondary)}
                onChange={(e) => setSettings({ ...settings, light_secondary: hexToHsl(e.target.value) })}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="light-background">Fond</Label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={hslToHex(settings.light_background)}
                onChange={(e) => setSettings({ ...settings, light_background: hexToHsl(e.target.value) })}
                className="h-10 w-20 rounded border border-input cursor-pointer"
              />
              <Input
                value={hslToHex(settings.light_background)}
                onChange={(e) => setSettings({ ...settings, light_background: hexToHsl(e.target.value) })}
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Couleurs - Mode sombre</CardTitle>
          <CardDescription>
            Sélectionnez vos couleurs avec le color picker
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dark-primary">Couleur primaire</Label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={hslToHex(settings.dark_primary)}
                onChange={(e) => setSettings({ ...settings, dark_primary: hexToHsl(e.target.value) })}
                className="h-10 w-20 rounded border border-input cursor-pointer"
              />
              <Input
                value={hslToHex(settings.dark_primary)}
                onChange={(e) => setSettings({ ...settings, dark_primary: hexToHsl(e.target.value) })}
                placeholder="#ecfe6d"
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dark-secondary">Couleur secondaire</Label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={hslToHex(settings.dark_secondary)}
                onChange={(e) => setSettings({ ...settings, dark_secondary: hexToHsl(e.target.value) })}
                className="h-10 w-20 rounded border border-input cursor-pointer"
              />
              <Input
                value={hslToHex(settings.dark_secondary)}
                onChange={(e) => setSettings({ ...settings, dark_secondary: hexToHsl(e.target.value) })}
                placeholder="#60a5fa"
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dark-background">Fond</Label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={hslToHex(settings.dark_background)}
                onChange={(e) => setSettings({ ...settings, dark_background: hexToHsl(e.target.value) })}
                className="h-10 w-20 rounded border border-input cursor-pointer"
              />
              <Input
                value={hslToHex(settings.dark_background)}
                onChange={(e) => setSettings({ ...settings, dark_background: hexToHsl(e.target.value) })}
                placeholder="#1f2937"
                className="flex-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sauvegarder les modifications
        </Button>
      </div>
    </div>
  );
}
