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

const sourceSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Format hexadécimal requis'),
});

type SourceFormData = z.infer<typeof sourceSchema>;

interface AddClientSourceDialogProps {
  onSourceAdded: () => void;
}

export function AddClientSourceDialog({ onSourceAdded }: AddClientSourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SourceFormData>({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      name: '',
      color: '#3b82f6',
    },
  });

  const onSubmit = async (data: SourceFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('client_sources')
        .insert({
          name: data.name,
          color: data.color,
        });

      if (error) throw error;

      toast.success('Source ajoutée');
      setOpen(false);
      reset();
      onSourceAdded();
    } catch (error: any) {
      console.error('Error adding source:', error);
      if (error.code === '23505') {
        toast.error('Cette source existe déjà');
      } else {
        toast.error('Erreur lors de l\'ajout de la source');
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
          <DialogTitle>Ajouter une source</DialogTitle>
          <DialogDescription>
            Créez une nouvelle source de contact personnalisée
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ex: Recommandation"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Couleur *</Label>
            <div className="flex gap-2">
              <Input
                id="color"
                type="color"
                {...register('color')}
                className="w-20 h-10 cursor-pointer"
              />
              <Input
                {...register('color')}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
            {errors.color && (
              <p className="text-sm text-destructive">{errors.color.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Format: #RRGGBB (hexadécimal)
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