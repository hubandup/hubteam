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
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, X, CalendarIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const agencySchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'agence est requis").max(200),
  active: z.boolean(),
  description: z.string().trim().max(1000).optional(),
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
  const [partnerSince, setPartnerSince] = useState<Date>(new Date());
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

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

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const onSubmit = async (data: AgencyFormData) => {
    setLoading(true);
    try {
      // First insert the agency
      const { data: newAgency, error: insertError } = await supabase
        .from('agencies')
        .insert({
          name: data.name,
          active: data.active,
          created_at: partnerSince.toISOString(),
          description: data.description || null,
          tags: tags,
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
      setTags([]);
      setNewTag('');
      setPartnerSince(new Date());
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

          <div className="space-y-2">
            <Label>Partenaire depuis</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !partnerSince && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {partnerSince ? format(partnerSince, "PPP", { locale: fr }) : "Sélectionner une date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={partnerSince}
                  onSelect={(date) => date && setPartnerSince(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Description de l'agence..."
              rows={4}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Ajouter un tag (Ex: Influence, Site vitrine...)"
              />
              <Button type="button" onClick={handleAddTag} variant="outline">
                Ajouter
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
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
