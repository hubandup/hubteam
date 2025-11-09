import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Pencil, Loader2 } from 'lucide-react';

const clientSchema = z.object({
  first_name: z.string().trim().min(1, 'Le prénom est requis').max(100),
  last_name: z.string().trim().min(1, 'Le nom est requis').max(100),
  company: z.string().trim().min(1, "L'entreprise est requise").max(200),
  email: z.string().trim().email('Email invalide').max(255),
  phone: z.string().trim().max(20).optional(),
  revenue: z.number().min(0, 'Le CA doit être positif'),
  active: z.boolean(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface EditClientDialogProps {
  client: {
    id: string;
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    phone?: string;
    revenue: number;
    active: boolean;
    logo_url?: string;
  };
  onClientUpdated: () => void;
}

export function EditClientDialog({ client, onClientUpdated }: EditClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(client.logo_url || null);

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
      first_name: client.first_name,
      last_name: client.last_name,
      company: client.company,
      email: client.email,
      phone: client.phone || '',
      revenue: client.revenue,
      active: client.active,
    },
  });

  const active = watch('active');

  useEffect(() => {
    if (open) {
      reset({
        first_name: client.first_name,
        last_name: client.last_name,
        company: client.company,
        email: client.email,
        phone: client.phone || '',
        revenue: client.revenue,
        active: client.active,
      });
      setLogoPreview(client.logo_url || null);
      setLogoFile(null);
    }
  }, [open, client, reset]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Le fichier doit faire moins de 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Le fichier doit être une image');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return client.logo_url || null;

    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('client-logos')
      .upload(fileName, logoFile);

    if (error) {
      console.error('Error uploading logo:', error);
      toast.error("Erreur lors de l'upload du logo");
      return client.logo_url || null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('client-logos')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const onSubmit = async (data: ClientFormData) => {
    setLoading(true);
    try {
      const logoUrl = await uploadLogo();

      const { error } = await supabase
        .from('clients')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          company: data.company,
          email: data.email,
          phone: data.phone || null,
          revenue: data.revenue,
          active: data.active,
          logo_url: logoUrl,
        })
        .eq('id', client.id);

      if (error) throw error;

      toast.success('Client modifié avec succès');
      setOpen(false);
      onClientUpdated();
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Erreur lors de la modification du client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le client</DialogTitle>
          <DialogDescription>
            Modifiez les informations du client.
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
              {...register('revenue', { valueAsNumber: true })}
              placeholder="50000"
            />
            {errors.revenue && (
              <p className="text-sm text-destructive">{errors.revenue.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">Logo de l'entreprise</Label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG ou WEBP - Max 5MB
                </p>
              </div>
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt="Aperçu du logo"
                  className="w-16 h-16 object-cover rounded-lg border"
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="active">Statut</Label>
              <p className="text-sm text-muted-foreground">
                Le client est-il actuellement actif ?
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
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
