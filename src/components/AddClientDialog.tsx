import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Loader2, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddClientStatusDialog } from './client-details/AddClientStatusDialog';
import { AddClientSourceDialog } from './client-details/AddClientSourceDialog';

const clientSchema = z.object({
  first_name: z.string().trim().min(1, 'Le prénom est requis').max(100),
  last_name: z.string().trim().min(1, 'Le nom est requis').max(100),
  company: z.string().trim().min(1, "L'entreprise est requise").max(200),
  email: z.string().trim().email('Email invalide').max(255),
  phone: z.string().trim().max(20).optional(),
  revenue: z.number().min(0, 'Le CA doit être positif'),
  active: z.boolean(),
  follow_up_date: z.date().optional(),
  status_id: z.string().optional(),
  source_id: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

type CreatedClientData = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

export type AddedClientPayload = {
  id: string;
  company: string;
  first_name: string;
  last_name: string;
  email: string;
  kdrive_drive_id: number | null;
  kdrive_folder_id: string | null;
  kdrive_folder_path: string | null;
};

interface AddClientDialogProps {
  onClientAdded: (client?: AddedClientPayload) => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddClientDialog({ onClientAdded, open, onOpenChange }: AddClientDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [clientStatuses, setClientStatuses] = useState<any[]>([]);
  const [clientSources, setClientSources] = useState<any[]>([]);
  const [createdClientData, setCreatedClientData] = useState<CreatedClientData | null>(null);
  const pendingClient = useRef<AddedClientPayload | undefined>(undefined);

  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;
  const isConfirmationStep = !!createdClientData;

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
  const followUpDate = watch('follow_up_date');
  const selectedStatusId = watch('status_id');
  const selectedSourceId = watch('source_id');

  useEffect(() => {
    if (isOpen) {
      fetchStatuses();
    }
  }, [isOpen]);

  const fetchStatuses = async () => {
    const { data } = await supabase
      .from('client_statuses')
      .select('*')
      .order('name');
    setClientStatuses(data || []);

    const { data: sources } = await supabase
      .from('client_sources')
      .select('*')
      .order('name');
    setClientSources(sources || []);
  };

  const resetLocalState = () => {
    reset();
    setLogoFile(null);
    setLogoPreview(null);
    setCreatedClientData(null);
    pendingClient.current = undefined;
    setLoading(false);
    setCreatingAccount(false);
  };

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
    if (!logoFile) return null;

    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('client-logos')
      .upload(fileName, logoFile);

    if (error) {
      console.error('Error uploading logo:', error);
      toast.error("Erreur lors de l'upload du logo");
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('client-logos')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const closeDialog = () => {
    resetLocalState();
    setIsOpen(false);
  };

  const finishFlow = async () => {
    await onClientAdded(pendingClient.current);
    closeDialog();
  };

  const createUserAccount = async () => {
    if (!createdClientData) return;

    setCreatingAccount(true);
    try {
      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email: createdClientData.email,
          role: 'client',
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de la création du compte');
      }

      toast.success(`Compte utilisateur créé pour ${createdClientData.first_name} ${createdClientData.last_name}. Un email lui a été envoyé.`);
      await finishFlow();
    } catch (error: any) {
      console.error('Error creating user account:', error);
      toast.error(error.message || "Erreur lors de la création du compte utilisateur");
      setCreatingAccount(false);
    }
  };

  const onSubmit = async (data: ClientFormData) => {
    setLoading(true);
    try {
      const logoUrl = await uploadLogo();

      const { data: clientData, error } = await supabase
        .from('clients')
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          company: data.company,
          email: data.email,
          phone: data.phone || null,
          revenue: data.revenue,
          active: data.active,
          logo_url: logoUrl,
          follow_up_date: data.follow_up_date ? data.follow_up_date.toISOString() : null,
          status_id: data.status_id || null,
          source_id: data.source_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      pendingClient.current = {
        id: clientData.id,
        company: clientData.company,
        first_name: clientData.first_name,
        last_name: clientData.last_name,
        email: clientData.email,
        kdrive_drive_id: clientData.kdrive_drive_id,
        kdrive_folder_id: clientData.kdrive_folder_id,
        kdrive_folder_path: clientData.kdrive_folder_path,
      };
      setCreatedClientData({
        id: clientData.id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
      });
      setLoading(false);
      toast.success('Client ajouté avec succès');
    } catch (error) {
      console.error('Error adding client:', error);
      toast.error("Erreur lors de l'ajout du client");
      setLoading(false);
    }
  };

  const handleClientFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void handleSubmit(onSubmit)(e);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (loading || creatingAccount)) return;
    if (!nextOpen) {
      closeDialog();
      return;
    }
    setIsOpen(nextOpen);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      {!open && !onOpenChange && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau client
          </Button>
        </DialogTrigger>
      )}

      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          if (loading || creatingAccount) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (loading || creatingAccount) e.preventDefault();
        }}
      >
        {isConfirmationStep && createdClientData ? (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle>Créer un compte utilisateur ?</DialogTitle>
              <DialogDescription>
                Souhaitez-vous vraiment créer le compte utilisateur pour <strong>{createdClientData.first_name} {createdClientData.last_name}</strong> ? Un email automatique lui sera envoyé pour qu'il se connecte à son compte.
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-end gap-3 pt-2">
               <Button type="button" variant="outline" onClick={() => { void finishFlow(); }} disabled={creatingAccount}>
                Non
              </Button>
              <Button type="button" onClick={createUserAccount} disabled={creatingAccount}>
                {creatingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Oui, créer le compte
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Ajouter un nouveau client</DialogTitle>
              <DialogDescription>
                Remplissez les informations du client pour l'ajouter à votre base.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleClientFormSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input id="first_name" {...register('first_name')} placeholder="Jean" />
                  {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input id="last_name" {...register('last_name')} placeholder="Dupont" />
                  {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Entreprise *</Label>
                <Input id="company" {...register('company')} placeholder="Acme Corp" />
                {errors.company && <p className="text-sm text-destructive">{errors.company.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" {...register('email')} placeholder="jean.dupont@acme.com" />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" {...register('phone')} placeholder="+33 6 12 34 56 78" />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revenue">Chiffre d'affaires (€) *</Label>
                  <Input
                    id="revenue"
                    type="number"
                    step="0.01"
                    {...register('revenue', { valueAsNumber: true })}
                    placeholder="50000"
                  />
                  {errors.revenue && <p className="text-sm text-destructive">{errors.revenue.message}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="source_id">Source</Label>
                    <AddClientSourceDialog onSourceAdded={fetchStatuses} />
                  </div>
                  <Select value={selectedSourceId} onValueChange={(value) => setValue('source_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une source" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientSources.map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="status_id">Action</Label>
                  <AddClientStatusDialog onStatusAdded={fetchStatuses} />
                </div>
                <Select value={selectedStatusId} onValueChange={(value) => setValue('status_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une action" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="follow_up_date">Prochaine échéance</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !followUpDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {followUpDate ? format(followUpDate, 'dd/MM/yyyy') : 'Choisir une date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={followUpDate}
                      onSelect={(date) => setValue('follow_up_date', date)}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
                {errors.follow_up_date && <p className="text-sm text-destructive">{errors.follow_up_date.message}</p>}
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
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou WEBP - Max 5MB</p>
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
                  <p className="text-sm text-muted-foreground">Le client est-il actuellement actif ?</p>
                </div>
                <Switch id="active" checked={active} onCheckedChange={(checked) => setValue('active', checked)} />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>
                  Annuler
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ajouter le client
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
