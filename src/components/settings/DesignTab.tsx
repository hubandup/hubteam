import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Palette } from 'lucide-react';

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
            Couleurs au format HSL (ex: 210 100% 30%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="light-primary">Couleur primaire</Label>
            <Input
              id="light-primary"
              value={settings.light_primary}
              onChange={(e) => setSettings({ ...settings, light_primary: e.target.value })}
              placeholder="210 100% 30%"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="light-secondary">Couleur secondaire</Label>
            <Input
              id="light-secondary"
              value={settings.light_secondary}
              onChange={(e) => setSettings({ ...settings, light_secondary: e.target.value })}
              placeholder="210 60% 50%"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="light-background">Fond</Label>
            <Input
              id="light-background"
              value={settings.light_background}
              onChange={(e) => setSettings({ ...settings, light_background: e.target.value })}
              placeholder="0 0% 100%"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Couleurs - Mode sombre</CardTitle>
          <CardDescription>
            Couleurs au format HSL (ex: 60 100% 70%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dark-primary">Couleur primaire</Label>
            <Input
              id="dark-primary"
              value={settings.dark_primary}
              onChange={(e) => setSettings({ ...settings, dark_primary: e.target.value })}
              placeholder="60 100% 70%"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dark-secondary">Couleur secondaire</Label>
            <Input
              id="dark-secondary"
              value={settings.dark_secondary}
              onChange={(e) => setSettings({ ...settings, dark_secondary: e.target.value })}
              placeholder="210 60% 60%"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dark-background">Fond</Label>
            <Input
              id="dark-background"
              value={settings.dark_background}
              onChange={(e) => setSettings({ ...settings, dark_background: e.target.value })}
              placeholder="220 15% 15%"
            />
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
