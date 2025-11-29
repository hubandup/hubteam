import { useState, useRef } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Pencil, X, CalendarIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface EditAgencyDialogProps {
  agency: {
    id: string;
    name: string;
    active: boolean;
    created_at: string;
    logo_url?: string;
    description?: string;
    tags?: string[];
  };
  onAgencyUpdated: () => void;
}

export function EditAgencyDialog({ agency, onAgencyUpdated }: EditAgencyDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [partnerSince, setPartnerSince] = useState<Date>(new Date(agency.created_at));
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [newTag, setNewTag] = useState('');
  const [formData, setFormData] = useState({
    name: agency.name,
    active: agency.active,
    description: agency.description || '',
    tags: agency.tags || [],
  });
  const formRef = useRef<HTMLFormElement>(null);

  // Reset form when dialog opens or when agency changes
  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Load available tags
      try {
        const { data, error } = await supabase
          .from('agency_tags')
          .select('*')
          .order('name');
        
        if (error) throw error;
        setAvailableTags(data || []);
      } catch (error) {
        console.error('Error loading tags:', error);
      }

      // Reset all states
      setLogoFile(null);
      setLogoPreview(agency.logo_url || null);
      setPartnerSince(new Date(agency.created_at));
      setNewTag('');
      setFormData({
        name: agency.name,
        active: agency.active,
        description: agency.description || '',
        tags: agency.tags || [],
      });
      // Reset file input
      setTimeout(() => {
        const fileInput = document.getElementById('logo-input-edit') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }, 0);
    }
  };

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
    const fileInput = document.getElementById('logo-input-edit') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const togglePredefinedTag = (tagName: string) => {
    if (formData.tags.includes(tagName)) {
      setFormData({ ...formData, tags: formData.tags.filter(t => t !== tagName) });
    } else {
      setFormData({ ...formData, tags: [...formData.tags, tagName] });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) });
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

        const { error: uploadError } = await supabase.storage
          .from('agency-logos')
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('agency-logos')
          .getPublicUrl(fileName);

        logoUrl = publicUrl;
      } else if (logoPreview === null) {
        // Logo was removed
        logoUrl = null;
      }

      const { error } = await supabase
        .from('agencies')
        .update({
          name: formData.name,
          active: formData.active,
          created_at: partnerSince.toISOString(),
          logo_url: logoUrl,
          description: formData.description || null,
          tags: formData.tags,
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form ref={formRef} onSubmit={handleSubmit}>
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
                    id="logo-input-edit"
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
                  <Calendar
                    mode="single"
                    selected={partnerSince}
                    onSelect={(date) => date && setPartnerSince(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description de l'agence..."
                rows={4}
              />
            </div>

            <div className="grid gap-2">
              <Label>Expertises</Label>
              
              {availableTags.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Expertises prédéfinies :</p>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={formData.tags.includes(tag.name) ? 'default' : 'outline'}
                        className="cursor-pointer transition-all hover:scale-105"
                        style={formData.tags.includes(tag.name) ? {
                          backgroundColor: tag.color,
                          borderColor: tag.color,
                          color: 'white',
                        } : {
                          borderColor: `${tag.color}80`,
                          color: tag.color,
                        }}
                        onClick={() => togglePredefinedTag(tag.name)}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Ou ajouter une expertise personnalisée..."
                />
                <Button type="button" onClick={handleAddTag} variant="outline">
                  Ajouter
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="space-y-1 pt-2">
                  <p className="text-sm text-muted-foreground">Expertises sélectionnées :</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
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
                </div>
              )}
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
            <Button type="button" disabled={loading} onClick={() => formRef.current?.requestSubmit()}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
