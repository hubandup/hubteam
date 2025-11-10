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
import { Plus, Loader2 } from 'lucide-react';

const statusSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(100),
  color: z.string().regex(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/, 'Format HSL requis'),
});

type StatusFormData = z.infer<typeof statusSchema>;

interface AddClientStatusDialogProps {
  onStatusAdded: () => void;
}

export function AddClientStatusDialog({ onStatusAdded }: AddClientStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<StatusFormData>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      name: '',
      color: 'hsl(200, 70%, 50%)',
    },
  });

  const onSubmit = async (data: StatusFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('client_statuses')
        .insert({
          name: data.name,
          color: data.color,
        });

      if (error) throw error;

      toast.success('Statut ajouté');
      setOpen(false);
      reset();
      onStatusAdded();
    } catch (error: any) {
      console.error('Error adding status:', error);
      if (error.code === '23505') {
        toast.error('Ce statut existe déjà');
      } else {
        toast.error('Erreur lors de l\'ajout du statut');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une action client</DialogTitle>
          <DialogDescription>
            Créez une nouvelle action personnalisée
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ex: En négociation"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Couleur (HSL) *</Label>
            <Input
              id="color"
              {...register('color')}
              placeholder="hsl(200, 70%, 50%)"
            />
            {errors.color && (
              <p className="text-sm text-destructive">{errors.color.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Format: hsl(teinte, saturation%, luminosité%)
            </p>
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
              Ajouter
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
