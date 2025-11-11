import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useDesignSettings } from '@/hooks/useDesignSettings';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// Liste des polices Google Fonts populaires
const GOOGLE_FONTS = [
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Oswald',
  'Raleway',
  'PT Sans',
  'Merriweather',
  'Nunito',
  'Playfair Display',
  'Poppins',
  'Ubuntu',
  'Inter',
  'Work Sans',
  'Instrument Sans',
  'Space Grotesk',
  'Outfit',
  'Manrope',
];

export function DesignTab() {
  const { settings, loading, updateSettings } = useDesignSettings();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Form state
  const [headingFont, setHeadingFont] = useState('');
  const [bodyFont, setBodyFont] = useState('');
  const [lightPrimary, setLightPrimary] = useState('');
  const [lightSecondary, setLightSecondary] = useState('');
  const [lightBackground, setLightBackground] = useState('');
  const [darkPrimary, setDarkPrimary] = useState('');
  const [darkSecondary, setDarkSecondary] = useState('');
  const [darkBackground, setDarkBackground] = useState('');

  useEffect(() => {
    if (settings) {
      setHeadingFont(settings.heading_font);
      setBodyFont(settings.body_font);
      setLightPrimary(settings.light_primary);
      setLightSecondary(settings.light_secondary);
      setLightBackground(settings.light_background);
      setDarkPrimary(settings.dark_primary);
      setDarkSecondary(settings.dark_secondary);
      setDarkBackground(settings.dark_background);
    }
  }, [settings]);

  // Dynamically load Google Font
  useEffect(() => {
    const loadFont = (fontName: string) => {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(' ', '+')}:wght@300;400;500;600;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    };

    if (headingFont && !document.querySelector(`link[href*="${headingFont}"]`)) {
      loadFont(headingFont);
    }
    if (bodyFont && !document.querySelector(`link[href*="${bodyFont}"]`)) {
      loadFont(bodyFont);
    }
  }, [headingFont, bodyFont]);

  // Apply design settings to CSS variables
  useEffect(() => {
    if (!settings) return;

    const root = document.documentElement;
    root.style.setProperty('--font-heading', `'${headingFont}', sans-serif`);
    root.style.setProperty('--font-body', `'${bodyFont}', sans-serif`);
    root.style.setProperty('--primary', lightPrimary);
    root.style.setProperty('--secondary', lightSecondary);
    root.style.setProperty('--background', lightBackground);

    // Dark mode colors
    const darkRoot = document.querySelector('.dark');
    if (darkRoot) {
      (darkRoot as HTMLElement).style.setProperty('--primary', darkPrimary);
      (darkRoot as HTMLElement).style.setProperty('--secondary', darkSecondary);
      (darkRoot as HTMLElement).style.setProperty('--background', darkBackground);
    }
  }, [settings, headingFont, bodyFont, lightPrimary, lightSecondary, lightBackground, darkPrimary, darkSecondary, darkBackground]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateSettings({
        heading_font: headingFont,
        body_font: bodyFont,
        light_primary: lightPrimary,
        light_secondary: lightSecondary,
        light_background: lightBackground,
        dark_primary: darkPrimary,
        dark_secondary: darkSecondary,
        dark_background: darkBackground,
      });

      if (result?.success) {
        toast({
          title: 'Paramètres enregistrés',
          description: 'Les paramètres de design ont été mis à jour avec succès.',
        });
        
        // Reload page to apply changes
        window.location.reload();
      } else {
        throw new Error('Échec de la mise à jour');
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres de design.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Polices de caractères</CardTitle>
          <CardDescription>
            Choisissez les polices Google Fonts pour les titres et le texte
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="heading-font">Police des titres</Label>
            <Select value={headingFont} onValueChange={setHeadingFont}>
              <SelectTrigger id="heading-font">
                <SelectValue placeholder="Sélectionner une police" />
              </SelectTrigger>
              <SelectContent>
                {GOOGLE_FONTS.map((font) => (
                  <SelectItem key={font} value={font}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body-font">Police du texte</Label>
            <Select value={bodyFont} onValueChange={setBodyFont}>
              <SelectTrigger id="body-font">
                <SelectValue placeholder="Sélectionner une police" />
              </SelectTrigger>
              <SelectContent>
                {GOOGLE_FONTS.map((font) => (
                  <SelectItem key={font} value={font}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Couleurs - Mode clair</CardTitle>
          <CardDescription>
            Définissez les couleurs pour le thème clair (format HSL : "hue saturation lightness")
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="light-primary">Couleur primaire</Label>
            <Input
              id="light-primary"
              value={lightPrimary}
              onChange={(e) => setLightPrimary(e.target.value)}
              placeholder="210 100% 30%"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="light-secondary">Couleur secondaire</Label>
            <Input
              id="light-secondary"
              value={lightSecondary}
              onChange={(e) => setLightSecondary(e.target.value)}
              placeholder="210 60% 50%"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="light-background">Couleur de fond</Label>
            <Input
              id="light-background"
              value={lightBackground}
              onChange={(e) => setLightBackground(e.target.value)}
              placeholder="0 0% 100%"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Couleurs - Mode sombre</CardTitle>
          <CardDescription>
            Définissez les couleurs pour le thème sombre (format HSL : "hue saturation lightness")
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dark-primary">Couleur primaire</Label>
            <Input
              id="dark-primary"
              value={darkPrimary}
              onChange={(e) => setDarkPrimary(e.target.value)}
              placeholder="60 100% 70%"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dark-secondary">Couleur secondaire</Label>
            <Input
              id="dark-secondary"
              value={darkSecondary}
              onChange={(e) => setDarkSecondary(e.target.value)}
              placeholder="210 60% 60%"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dark-background">Couleur de fond</Label>
            <Input
              id="dark-background"
              value={darkBackground}
              onChange={(e) => setDarkBackground(e.target.value)}
              placeholder="220 15% 15%"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer les modifications
        </Button>
      </div>
    </div>
  );
}
