import { useState, useEffect } from 'react';
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
import { Pencil, Loader2, CalendarIcon } from 'lucide-react';
import { AddActivitySectorDialog } from './client-details/AddActivitySectorDialog';
import { AddClientStatusDialog } from './client-details/AddClientStatusDialog';
import { AddClientSourceDialog } from './client-details/AddClientSourceDialog';
import { cn } from '@/lib/utils';

const clientSchema = z.object({
  first_name: z.string().trim().min(1, 'Le prénom est requis').max(100),
  last_name: z.string().trim().min(1, 'Le nom est requis').max(100),
  company: z.string().trim().min(1, "L'entreprise est requise").max(200),
  email: z.string().trim().email('Email invalide').max(255),
  phone: z.string().trim().max(20).optional(),
  revenue: z.number().min(0, 'Le CA doit être positif'),
  active: z.boolean(),
  activity_sector_id: z.string().optional(),
  status_id: z.string().optional(),
  source_id: z.string().optional(),
  follow_up_date: z.date().optional(),
  last_contact: z.date().optional(),
  kanban_stage: z.string(),
  main_contact_id: z.string().optional(),
  linkedin_connected: z.boolean().optional(),
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
    activity_sector_id?: string;
    status_id?: string;
    source_id?: string;
    follow_up_date?: string;
    last_contact?: string;
    kanban_stage: string;
    main_contact_id?: string;
    linkedin_connected?: boolean;
  };
  onClientUpdated: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function EditClientDialog({ client, onClientUpdated, open: controlledOpen, onOpenChange, hideTrigger }: EditClientDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    if (controlledOpen === undefined) setInternalOpen(v);
  };
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(client.logo_url || null);
  const [activitySectors, setActivitySectors] = useState<any[]>([]);
  const [clientStatuses, setClientStatuses] = useState<any[]>([]);
  const [clientSources, setClientSources] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

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
      activity_sector_id: client.activity_sector_id || '',
      status_id: client.status_id || '',
      source_id: client.source_id || '',
      follow_up_date: client.follow_up_date ? new Date(client.follow_up_date) : undefined,
      last_contact: client.last_contact ? new Date(client.last_contact) : undefined,
      kanban_stage: client.kanban_stage,
      main_contact_id: client.main_contact_id || '',
      linkedin_connected: client.linkedin_connected ?? false,
    },
  });

  const active = watch('active');
  const linkedinConnected = watch('linkedin_connected');
  const selectedSectorId = watch('activity_sector_id');
  const selectedStatusId = watch('status_id');
  const selectedSourceId = watch('source_id');
  const followUpDate = watch('follow_up_date');
  const lastContact = watch('last_contact');
  const kanbanStage = watch('kanban_stage');
  const mainContactId = watch('main_contact_id');

  useEffect(() => {
    fetchSectorsAndStatuses();
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['admin', 'team']);

    if (roles) {
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds);

      if (profiles) {
        const members = profiles.map(p => {
          const roleData = roles.find(r => r.user_id === p.id);
          return {
            id: p.id,
            name: `${p.first_name} ${p.last_name}`,
            role: roleData?.role || 'team'
          };
        });
        setTeamMembers(members);
      }
    }
  };

  const fetchSectorsAndStatuses = async () => {
    const { data: sectors } = await supabase
      .from('activity_sectors')
      .select('*')
      .order('name');
    setActivitySectors(sectors || []);

    const { data: statuses } = await supabase
      .from('client_statuses')
      .select('*')
      .order('name');
    setClientStatuses(statuses || []);

    const { data: sources } = await supabase
      .from('client_sources')
      .select('*')
      .order('name');
    setClientSources(sources || []);
  };

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
        activity_sector_id: client.activity_sector_id || '',
        status_id: client.status_id || '',
        source_id: client.source_id || '',
        follow_up_date: client.follow_up_date ? new Date(client.follow_up_date) : undefined,
        last_contact: client.last_contact ? new Date(client.last_contact) : undefined,
        kanban_stage: client.kanban_stage,
        main_contact_id: client.main_contact_id || '',
        linkedin_connected: client.linkedin_connected ?? false,
      });
      setLogoPreview(client.logo_url || null);
      setLogoFile(null);
      fetchSectorsAndStatuses();
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
          activity_sector_id: data.activity_sector_id || null,
          status_id: data.status_id || null,
          source_id: data.source_id || null,
          follow_up_date: data.follow_up_date ? data.follow_up_date.toISOString() : null,
          last_contact: data.last_contact ? data.last_contact.toISOString() : null,
          kanban_stage: data.kanban_stage,
          main_contact_id: data.main_contact_id || null,
          linkedin_connected: data.linkedin_connected ?? false,
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
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Modifier
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="revenue">Chiffre d'affaires (€ HT) *</Label>
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
              <Label htmlFor="kanban_stage">Position Kanban *</Label>
              <Select
                value={kanbanStage}
                onValueChange={(value) => setValue('kanban_stage', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="rdv_a_prendre">RDV à prendre</SelectItem>
                  <SelectItem value="a_relancer">À relancer</SelectItem>
                  <SelectItem value="rdv_hub_date">RDV Hub Date</SelectItem>
                  <SelectItem value="rdv_pris">RDV Pris</SelectItem>
                  <SelectItem value="reco_en_cours">Reco en cours</SelectItem>
                  <SelectItem value="projet_valide">Projet Validé</SelectItem>
                  <SelectItem value="a_fideliser">À fidéliser</SelectItem>
                  <SelectItem value="sans_suite">Sans suite</SelectItem>
                </SelectContent>
              </Select>
              {errors.kanban_stage && (
                <p className="text-sm text-destructive">{errors.kanban_stage.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="last_contact">Dernier contact</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !lastContact && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {lastContact ? format(lastContact, "dd/MM/yyyy") : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={lastContact}
                    onSelect={(date) => setValue('last_contact', date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {errors.last_contact && (
                <p className="text-sm text-destructive">{errors.last_contact.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="follow_up_date">Prochaine échéance</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !followUpDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {followUpDate ? format(followUpDate, "dd/MM/yyyy") : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={followUpDate}
                    onSelect={(date) => setValue('follow_up_date', date)}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {errors.follow_up_date && (
                <p className="text-sm text-destructive">{errors.follow_up_date.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="activity_sector_id">Secteur d'activité</Label>
                <AddActivitySectorDialog onSectorAdded={fetchSectorsAndStatuses} />
              </div>
              <Select
                value={selectedSectorId}
                onValueChange={(value) => setValue('activity_sector_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un secteur" />
                </SelectTrigger>
                <SelectContent>
                  {activitySectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="source_id">Source</Label>
                <AddClientSourceDialog onSourceAdded={fetchSectorsAndStatuses} />
              </div>
              <Select
                value={selectedSourceId}
                onValueChange={(value) => setValue('source_id', value)}
              >
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
              <AddClientStatusDialog onStatusAdded={fetchSectorsAndStatuses} />
            </div>
            <Select
              value={selectedStatusId}
              onValueChange={(value) => setValue('status_id', value)}
            >
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
            <Label htmlFor="main_contact_id">Interlocuteur Hub & Up</Label>
            <Select
              value={mainContactId}
              onValueChange={(value) => setValue('main_contact_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un interlocuteur" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} ({member.role === 'admin' ? 'Administrateur' : 'Équipe'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="linkedin_connected">Connexion LinkedIn</Label>
              <p className="text-sm text-muted-foreground">
                Êtes-vous connecté avec ce client sur LinkedIn ?
              </p>
            </div>
            <Switch
              id="linkedin_connected"
              checked={linkedinConnected ?? false}
              onCheckedChange={(checked) => setValue('linkedin_connected', checked)}
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
    </>
  );
}
