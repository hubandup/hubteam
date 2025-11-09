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
import { Plus, Loader2 } from 'lucide-react';

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

  const onSubmit = async (data: AgencyFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('agencies').insert({
        name: data.name,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        revenue: data.revenue,
        active: data.active,
      });

      if (error) throw error;

      toast.success('Agence ajoutée avec succès');
      reset();
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
