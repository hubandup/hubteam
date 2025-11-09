import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Pencil, Upload, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface EditAgencyDialogProps {
  agency: {
    id: string;
    name: string;
    contact_email?: string;
    contact_phone?: string;
    revenue: number;
    active: boolean;
    logo_url?: string;
  };
  onAgencyUpdated: () => void;
}

export function EditAgencyDialog({ agency, onAgencyUpdated }: EditAgencyDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(agency.logo_url || null);
  const [formData, setFormData] = useState({
    name: agency.name,
    contact_email: agency.contact_email || '',
    contact_phone: agency.contact_phone || '',
    revenue: agency.revenue,
    active: agency.active,
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let logoUrl = agency.logo_url;

      // Upload logo if a new file was selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${agency.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('agency-logos')
          .upload(filePath, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('agency-logos')
          .getPublicUrl(filePath);

        logoUrl = publicUrl;
      } else if (logoPreview === null && agency.logo_url) {
        // Logo was removed
        logoUrl = null;
      }

      const { error } = await supabase
        .from('agencies')
        .update({
          name: formData.name,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          revenue: formData.revenue,
          active: formData.active,
          logo_url: logoUrl,
        })
        .eq('id', agency.id);

      if (error) throw error;

      toast.success('Agence modifiée avec succès');
      setOpen(false);
      onAgencyUpdated();
    } catch (error) {
      console.error('Error updating agency:', error);
      toast.error('Erreur lors de la modification de l\'agence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Modifier l'agence</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l'agence partenaire
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Logo de l'agence</Label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={logoPreview} alt="Logo" />
                      <AvatarFallback>Logo</AvatarFallback>
                    </Avatar>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={handleRemoveLogo}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Avatar className="h-20 w-20">
                    <AvatarFallback>Logo</AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG jusqu'à 5MB
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="name">Nom de l'agence *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_email">Email de contact</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_phone">Téléphone</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="revenue">Chiffre d'affaires (€)</Label>
              <Input
                id="revenue"
                type="number"
                value={formData.revenue}
                onChange={(e) => setFormData({ ...formData, revenue: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Agence active</Label>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
