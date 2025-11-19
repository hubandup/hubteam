import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Palette } from 'lucide-react';

// Popular Google Fonts
const HEADING_FONTS = [
  'Instrument Sans',
  'Poppins',
  'Montserrat',
  'Playfair Display',
  'Oswald',
  'Raleway',
  'Merriweather',
  'Bebas Neue',
  'Archivo Black',
  'DM Serif Display',
];

const BODY_FONTS = [
  'Roboto',
  'Poppins',
  'Open Sans',
  'Lato',
  'Inter',
  'Nunito',
  'Source Sans Pro',
  'PT Sans',
  'Work Sans',
  'Noto Sans',
  'Ubuntu',
  'Montserrat',
  'Raleway',
];

const FONT_WEIGHTS = [
  { value: '300', label: 'Light (300)' },
  { value: '400', label: 'Regular (400)' },
  { value: '500', label: 'Medium (500)' },
  { value: '600', label: 'Semi-Bold (600)' },
  { value: '700', label: 'Bold (700)' },
  { value: '800', label: 'Extra-Bold (800)' },
];

// Predefined color palettes
const COLOR_PALETTES = {
  professional: {
    name: 'Professionnel',
    description: 'Palette corporate classique avec bleu et gris',
    light_primary: '210 99% 29%',      // Deep blue
    light_secondary: '210 40% 96%',    // Light blue-gray
    light_background: '0 0% 100%',     // White
    dark_primary: '210 99% 71%',       // Light blue
    dark_secondary: '0 0% 14%',        // Dark gray
    dark_background: '0 0% 6%',        // Very dark gray
  },
  modern: {
    name: 'Moderne',
    description: 'Palette contemporaine avec violet et orange',
    light_primary: '270 75% 50%',      // Purple
    light_secondary: '30 95% 60%',     // Orange
    light_background: '0 0% 99%',      // Off-white
    dark_primary: '280 70% 65%',       // Light purple
    dark_secondary: '30 95% 65%',      // Light orange
    dark_background: '260 15% 8%',     // Dark purple-gray
  },
  creative: {
    name: 'Créatif',
    description: 'Palette vibrante avec turquoise et rose',
    light_primary: '180 80% 40%',      // Turquoise
    light_secondary: '320 85% 55%',    // Pink
    light_background: '0 0% 100%',     // White
    dark_primary: '180 70% 60%',       // Light turquoise
    dark_secondary: '320 75% 65%',     // Light pink
    dark_background: '200 20% 10%',    // Dark teal-gray
  },
};

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
  heading_font_weight?: string;
  body_font: string;
  body_font_weight?: string;
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
  const [savedSettings, setSavedSettings] = useState<DesignSettings | null>(null);
  const [settings, setSettings] = useState<DesignSettings>({
    heading_font: 'Instrument Sans',
    heading_font_weight: '700',
    body_font: 'Roboto',
    body_font_weight: '400',
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

  // Apply settings in real-time as user changes them
  useEffect(() => {
    if (!loading) {
      applyDesignSettings(settings);
    }
  }, [settings, loading]);

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
        setSavedSettings(data);
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

  const handleReset = () => {
    if (savedSettings) {
      setSettings(savedSettings);
      toast({
        title: 'Réinitialisé',
        description: 'Les modifications non sauvegardées ont été annulées.',
      });
    }
  };

  const applyPalette = (paletteKey: keyof typeof COLOR_PALETTES) => {
    const palette = COLOR_PALETTES[paletteKey];
    setSettings(prev => ({
      ...prev,
      light_primary: palette.light_primary,
      light_secondary: palette.light_secondary,
      light_background: palette.light_background,
      dark_primary: palette.dark_primary,
      dark_secondary: palette.dark_secondary,
      dark_background: palette.dark_background,
    }));
    toast({
      title: 'Palette appliquée',
      description: `La palette "${palette.name}" a été appliquée. N'oubliez pas de sauvegarder.`,
    });
  };

  const applyDesignSettings = (data: DesignSettings) => {
    const root = document.documentElement;
    
    // Apply fonts
    root.style.setProperty('--font-heading', data.heading_font);
    root.style.setProperty('--font-heading-weight', data.heading_font_weight || '700');
    root.style.setProperty('--font-body', data.body_font);
    root.style.setProperty('--font-body-weight', data.body_font_weight || '400');
    
    // Apply light mode colors
    root.style.setProperty('--primary', data.light_primary);
    root.style.setProperty('--secondary', data.light_secondary);
    root.style.setProperty('--background', data.light_background);
    
    // Apply dark mode colors with !important to override static CSS
    const style = document.getElementById('dynamic-theme-style') || document.createElement('style');
    style.id = 'dynamic-theme-style';
    style.innerHTML = `
      .dark {
        --primary: ${data.dark_primary} !important;
        --secondary: ${data.dark_secondary} !important;
        --background: ${data.dark_background} !important;
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
    
    // Include all fonts for preview
    const allFonts = [...new Set([...HEADING_FONTS, ...BODY_FONTS, headingFont, bodyFont])];
    const fontQuery = allFonts.map(f => f.replace(/ /g, '+')).join('&family=');
    
    const link = document.createElement('link');
    link.id = 'google-fonts-link';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}:wght@300;400;600;700&display=swap`;
    document.head.appendChild(link);
  };
  
  // Load all fonts on mount for preview
  useEffect(() => {
    const allFonts = [...new Set([...HEADING_FONTS, ...BODY_FONTS])];
    const fontQuery = allFonts.map(f => f.replace(/ /g, '+')).join('&family=');
    
    const link = document.createElement('link');
    link.id = 'google-fonts-preview-link';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}:wght@300;400;600;700&display=swap`;
    document.head.appendChild(link);
    
    return () => {
      const previewLink = document.getElementById('google-fonts-preview-link');
      if (previewLink) {
        previewLink.remove();
      }
    };
  }, []);

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

      setSavedSettings(settings);
      
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

  const hasUnsavedChanges = savedSettings && JSON.stringify(settings) !== JSON.stringify(savedSettings);

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

      {/* Predefined Palettes Section */}
      <Card>
        <CardHeader>
          <CardTitle>Palettes prédéfinies</CardTitle>
          <CardDescription>
            Sélectionnez une palette de couleurs pour appliquer instantanément un thème cohérent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(COLOR_PALETTES).map(([key, palette]) => (
              <button
                key={key}
                onClick={() => applyPalette(key as keyof typeof COLOR_PALETTES)}
                className="group relative overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-all p-4 text-left bg-card hover:shadow-md"
              >
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">{palette.name}</h3>
                  <p className="text-sm text-muted-foreground">{palette.description}</p>
                  
                  {/* Color Preview */}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="space-y-1">
                      <div 
                        className="h-12 rounded border" 
                        style={{ background: `hsl(${palette.light_primary})` }}
                      />
                      <p className="text-xs text-muted-foreground text-center">Primaire</p>
                    </div>
                    <div className="space-y-1">
                      <div 
                        className="h-12 rounded border" 
                        style={{ background: `hsl(${palette.light_secondary})` }}
                      />
                      <p className="text-xs text-muted-foreground text-center">Secondaire</p>
                    </div>
                    <div className="space-y-1">
                      <div 
                        className="h-12 rounded border" 
                        style={{ background: `hsl(${palette.light_background})` }}
                      />
                      <p className="text-xs text-muted-foreground text-center">Fond</p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Polices Google Fonts</CardTitle>
          <CardDescription>
            Entrez les noms exacts des polices depuis Google Fonts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-3">Police des titres</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="heading-font">Police</Label>
                  <Select 
                    value={settings.heading_font} 
                    onValueChange={(value) => setSettings({ ...settings, heading_font: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionnez une police" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] bg-popover z-50">
                      {HEADING_FONTS.map((font) => (
                        <SelectItem 
                          key={font} 
                          value={font}
                          className="cursor-pointer"
                        >
                          <span style={{ fontFamily: font, fontWeight: 700 }}>
                            {font}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heading-font-weight">Épaisseur</Label>
                  <Select 
                    value={settings.heading_font_weight || '700'} 
                    onValueChange={(value) => setSettings({ ...settings, heading_font_weight: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionnez une épaisseur" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {FONT_WEIGHTS.map((weight) => (
                        <SelectItem 
                          key={weight.value} 
                          value={weight.value}
                          className="cursor-pointer"
                        >
                          {weight.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Police du texte</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="body-font">Police</Label>
                  <Select 
                    value={settings.body_font} 
                    onValueChange={(value) => setSettings({ ...settings, body_font: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionnez une police" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] bg-popover z-50">
                      {BODY_FONTS.map((font) => (
                        <SelectItem 
                          key={font} 
                          value={font}
                          className="cursor-pointer"
                        >
                          <span style={{ fontFamily: font, fontWeight: 300 }}>
                            {font}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body-font-weight">Épaisseur</Label>
                  <Select 
                    value={settings.body_font_weight || '400'} 
                    onValueChange={(value) => setSettings({ ...settings, body_font_weight: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionnez une épaisseur" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {FONT_WEIGHTS.map((weight) => (
                        <SelectItem 
                          key={weight.value} 
                          value={weight.value}
                          className="cursor-pointer"
                        >
                          {weight.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prévisualisation des polices</CardTitle>
          <CardDescription>
            Aperçu en direct des polices sélectionnées
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 p-6 bg-muted/30 rounded-lg border border-border">
            <div style={{ fontFamily: settings.heading_font, fontWeight: settings.heading_font_weight || '700' }}>
              <h1 className="text-4xl mb-2">Titre niveau 1</h1>
              <h2 className="text-3xl mb-2">Titre niveau 2</h2>
              <h3 className="text-2xl mb-2">Titre niveau 3</h3>
              <h4 className="text-xl">Titre niveau 4</h4>
            </div>
          </div>
          <div className="space-y-2 p-6 bg-muted/30 rounded-lg border border-border">
            <p className="text-base" style={{ fontFamily: settings.body_font, fontWeight: settings.body_font_weight || '400' }}>
              Ceci est un exemple de texte de paragraphe avec la police du corps. 
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
              Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: settings.body_font, fontWeight: settings.body_font_weight || '400' }}>
              Texte de taille réduite pour les descriptions et les détails secondaires.
            </p>
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

      {hasUnsavedChanges && (
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-3">
            💡 Les modifications sont appliquées en temps réel. N'oubliez pas de les sauvegarder pour les conserver.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              Annuler les modifications
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sauvegarder les modifications
            </Button>
          </div>
        </div>
      )}

      {!hasUnsavedChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sauvegarder les modifications
          </Button>
        </div>
      )}
    </div>
  );
}
