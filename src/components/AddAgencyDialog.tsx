import { useState } from 'react';
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
import { Plus, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const agencySchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'agence est requis").max(200),
  contact_email: z.string().trim().email('Email invalide').max(255).optional().or(z.literal('')),
  contact_phone: z.string().trim().max(20).optional(),
  revenue: z.number().min(0, 'Le CA doit être positif'),
  active: z.boolean(),
});

type AgencyFormData = z.infer<typeof agencySchema>;

interface AddAgencyDialogProps {
  onAgencyAdded: () => void;
}

export function AddAgencyDialog({ onAgencyAdded }: AddAgencyDialogProps) {
  const [open, setOpen] = useState(false);
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
  } = useForm<AgencyFormData>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      active: true,
      revenue: 0,
    },
  });

  const active = watch('active');

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

  const onSubmit = async (data: AgencyFormData) => {
    setLoading(true);
    try {
      // First insert the agency
      const { data: newAgency, error: insertError } = await supabase
        .from('agencies')
        .insert({
          name: data.name,
          contact_email: data.contact_email || null,
          contact_phone: data.contact_phone || null,
          revenue: data.revenue,
          active: data.active,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload logo if provided
      if (logoFile && newAgency) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${newAgency.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('agency-logos')
          .upload(filePath, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('agency-logos')
          .getPublicUrl(filePath);

        // Update agency with logo URL
        const { error: updateError } = await supabase
          .from('agencies')
          .update({ logo_url: publicUrl })
          .eq('id', newAgency.id);

        if (updateError) throw updateError;
      }

      toast.success('Agence ajoutée avec succès');
      reset();
      setLogoFile(null);
      setLogoPreview(null);
      setOpen(false);
      onAgencyAdded();
    } catch (error) {
      console.error('Error adding agency:', error);
      toast.error("Erreur lors de l'ajout de l'agence");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle agence
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter une nouvelle agence</DialogTitle>
          <DialogDescription>
            Remplissez les informations de l'agence partenaire.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
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

          <div className="space-y-2">
            <Label htmlFor="name">Nom de l'agence *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="WebDesign Pro"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_email">Email de contact</Label>
              <Input
                id="contact_email"
                type="email"
                {...register('contact_email')}
                placeholder="contact@agence.com"
              />
              {errors.contact_email && (
                <p className="text-sm text-destructive">{errors.contact_email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Téléphone</Label>
              <Input
                id="contact_phone"
                {...register('contact_phone')}
                placeholder="+33 1 23 45 67 89"
              />
              {errors.contact_phone && (
                <p className="text-sm text-destructive">{errors.contact_phone.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revenue">Chiffre d'affaires généré (€) *</Label>
            <Input
              id="revenue"
              type="number"
              step="0.01"
              {...register('revenue', { valueAsNumber: true })}
              placeholder="0"
            />
            {errors.revenue && (
              <p className="text-sm text-destructive">{errors.revenue.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="active">Statut</Label>
              <p className="text-sm text-muted-foreground">
                L'agence est-elle actuellement active ?
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
                setOpen(false);
              }}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ajouter l'agence
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
