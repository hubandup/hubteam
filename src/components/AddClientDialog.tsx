import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Upload, Loader2 } from 'lucide-react';

const clientSchema = z.object({
  first_name: z.string().trim().min(1, 'Le prénom est requis').max(100),
  last_name: z.string().trim().min(1, 'Le nom est requis').max(100),
  company: z.string().trim().min(1, 'L\'entreprise est requise').max(200),
  email: z.string().trim().email('Email invalide').max(255),
  phone: z.string().trim().max(20).optional(),
  revenue: z.coerce.number().min(0, 'Le CA doit être positif'),
  active: z.boolean(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientAdded: () => void;
}

export function AddClientDialog({ open, onOpenChange, onClientAdded }: AddClientDialogProps) {
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      active: true,
      revenue: 0,
    },
  });

  const active = watch('active');

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Le fichier ne doit pas dépasser 5 MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Veuillez sélectionner une image');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (clientId: string): Promise<string | null> => {
    if (!logoFile) return null;

    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${clientId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('client-logos')
      .upload(filePath, logoFile);

    if (uploadError) {
      console.error('Erreur upload logo:', uploadError);
      toast.error('Erreur lors de l\'upload du logo');
      return null;
    }

    const { data } = supabase.storage
      .from('client-logos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const onSubmit = async (data: ClientFormData) => {
    setLoading(true);
    try {
      const { data: client, error: insertError } = await supabase
        .from('clients')
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          company: data.company,
          email: data.email,
          phone: data.phone || null,
          revenue: data.revenue,
          active: data.active,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (logoFile && client) {
        const logoUrl = await uploadLogo(client.id);
        if (logoUrl) {
          const { error: updateError } = await supabase
            .from('clients')
            .update({ logo_url: logoUrl })
            .eq('id', client.id);

          if (updateError) {
            console.error('Erreur mise à jour logo:', updateError);
          }
        }
      }

      toast.success('Client ajouté avec succès');
      reset();
      setLogoFile(null);
      setLogoPreview(null);
      onClientAdded();
      onOpenChange(false);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'ajout du client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau client à votre base de données
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Prénom *</Label>
              <Input
                id="first_name"
                {...register('first_name')}
                placeholder="Jean"
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Nom *</Label>
              <Input
                id="last_name"
                {...register('last_name')}
                placeholder="Dupont"
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Entreprise *</Label>
            <Input
              id="company"
              {...register('company')}
              placeholder="Acme Corp"
            />
            {errors.company && (
              <p className="text-sm text-destructive">{errors.company.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="jean.dupont@acme.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+33 6 12 34 56 78"
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revenue">Chiffre d'affaires (€) *</Label>
            <Input
              id="revenue"
              type="number"
              step="0.01"
              {...register('revenue')}
              placeholder="50000"
            />
            {errors.revenue && (
              <p className="text-sm text-destructive">{errors.revenue.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">Logo de l'entreprise</Label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt="Aperçu logo"
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Max 5 MB - JPG, PNG, WebP
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="active">Client actif</Label>
              <p className="text-sm text-muted-foreground">
                Le client est actuellement actif dans votre système
              </p>
            </div>
            <Switch
              id="active"
              checked={active}
              onCheckedChange={(checked) => setValue('active', checked)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setLogoFile(null);
                setLogoPreview(null);
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ajouter le client
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
