import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, RefreshCw, Copy, Check, KeyRound, Shield } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

interface Agency {
  id: string;
  name: string;
}

interface EditUserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    role: 'admin' | 'team' | 'client' | 'agency' | null;
  };
}

function generatePassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  const out = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
  ];
  for (let i = 4; i < length; i++) out.push(all[arr[i] % all.length]);
  for (let i = out.length - 1; i > 0; i--) {
    const j = arr[i % arr.length] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join('');
}

export function EditUserRoleDialog({ open, onOpenChange, user }: EditUserRoleDialogProps) {
  const { isAdmin } = useUserRole();

  // Access tab state
  const [selectedRole, setSelectedRole] = useState<string>(user.role || '');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [loadingAgencies, setLoadingAgencies] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);

  // Password tab state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [tab, setTab] = useState<'password' | 'access'>(isAdmin ? 'access' : 'password');

  useEffect(() => {
    if (open) {
      setSelectedRole(user.role || '');
      setPassword('');
      setShowPassword(false);
      setCreatedCreds(null);
      setCopied(false);
      setTab(isAdmin ? 'access' : 'password');
      if (isAdmin) {
        fetchAgencies();
        if (user.role === 'agency') fetchUserAgencies();
      }
    }
  }, [open, user, isAdmin]);

  const fetchAgencies = async () => {
    setLoadingAgencies(true);
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      setAgencies(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des agences');
      console.error(error);
    } finally {
      setLoadingAgencies(false);
    }
  };

  const fetchUserAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_members')
        .select('agency_id')
        .eq('user_id', user.id);
      if (error) throw error;
      setSelectedAgencies(data.map((item) => item.agency_id));
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleAgencyToggle = (agencyId: string) => {
    setSelectedAgencies((prev) =>
      prev.includes(agencyId) ? prev.filter((id) => id !== agencyId) : [...prev, agencyId]
    );
  };

  const handleSaveAccess = async () => {
    if (!isAdmin) {
      toast.error("Seuls les administrateurs peuvent modifier les accès");
      return;
    }
    if (!selectedRole) {
      toast.error('Veuillez sélectionner un rôle');
      return;
    }
    setSavingAccess(true);
    try {
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const roleValue = selectedRole as 'admin' | 'team' | 'client' | 'agency';
      const { error: roleError } = existingRole
        ? await supabase.from('user_roles').update({ role: roleValue }).eq('user_id', user.id)
        : await supabase.from('user_roles').insert({ user_id: user.id, role: roleValue });
      if (roleError) throw roleError;

      if (selectedRole === 'agency') {
        const { data: currentMemberships, error: fetchError } = await supabase
          .from('agency_members')
          .select('id, agency_id')
          .eq('user_id', user.id);
        if (fetchError) throw fetchError;

        const currentAgencyIds = currentMemberships?.map((m) => m.agency_id) || [];
        const toAdd = selectedAgencies.filter((id) => !currentAgencyIds.includes(id));
        const toRemove = currentAgencyIds.filter((id) => !selectedAgencies.includes(id));

        if (toAdd.length > 0) {
          const { error } = await supabase
            .from('agency_members')
            .insert(toAdd.map((agency_id) => ({ user_id: user.id, agency_id })));
          if (error) throw error;
        }
        if (toRemove.length > 0) {
          const ids = currentMemberships!
            .filter((m) => toRemove.includes(m.agency_id))
            .map((m) => m.id);
          const { error } = await supabase.from('agency_members').delete().in('id', ids);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('agency_members').delete().eq('user_id', user.id);
        if (error) throw error;
      }

      toast.success('Accès mis à jour avec succès');
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour des accès');
      console.error(error);
    } finally {
      setSavingAccess(false);
    }
  };

  const handleSavePassword = async () => {
    if (!password || password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    setSubmittingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: user.email,
          role: user.role || 'team',
          mode: 'password',
          password,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error, { description: data.details, duration: 6000 });
        return;
      }
      setCreatedCreds({ email: user.email, password });
      toast.success('Mot de passe provisoire défini');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erreur lors de la mise à jour du mot de passe');
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleCopyCreds = async () => {
    if (!createdCreds) return;
    await navigator.clipboard.writeText(
      `Email : ${createdCreds.email}\nMot de passe provisoire : ${createdCreds.password}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Identifiants copiés');
  };

  const displayName = user.display_name || `${user.first_name} ${user.last_name}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Modifier l'utilisateur</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{displayName}</span> — {user.email}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (v === 'access' && !isAdmin) return;
            setTab(v as 'password' | 'access');
          }}
          className="w-full"
        >
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="password">
              <KeyRound className="h-4 w-4 mr-2" />
              Mot de passe
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="access">
                <Shield className="h-4 w-4 mr-2" />
                Accès
              </TabsTrigger>
            )}
          </TabsList>

          {/* PASSWORD TAB */}
          <TabsContent value="password" className="space-y-4 py-4">
            {createdCreds ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Communiquez ces identifiants de manière sécurisée. L'utilisateur devra changer son mot de passe à sa prochaine connexion.
                </p>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input readOnly value={createdCreds.email} />
                </div>
                <div className="space-y-1">
                  <Label>Mot de passe provisoire</Label>
                  <Input readOnly value={createdCreds.password} className="font-mono" />
                </div>
                <Button onClick={handleCopyCreds} variant="outline" className="w-full">
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Copié' : 'Copier les identifiants'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe provisoire</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submittingPassword}
                      placeholder="Min. 8 caractères"
                      className="pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setPassword(generatePassword()); setShowPassword(true); }}
                    disabled={submittingPassword}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Générer
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  L'utilisateur devra définir un nouveau mot de passe à sa prochaine connexion.
                </p>
              </div>
            )}
          </TabsContent>

          {/* ACCESS TAB — admin only */}
          {isAdmin && (
            <TabsContent value="access" className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="role">Rôle *</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Sélectionner un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="team">Équipe</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="agency">Agence</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {selectedRole === 'admin' && "Tous les droits sur l'application"}
                  {selectedRole === 'team' && 'Lecture dans Dashboard, CRM, Agences, Projets. Écriture dans CRM et Projets'}
                  {selectedRole === 'client' && 'Lecture limitée à leurs propres données'}
                  {selectedRole === 'agency' && 'Lecture CRM, Agences, Projets. Écriture limitée aux données rattachées'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Les droits d'accès détaillés par page sont configurables dans <span className="font-medium">Paramètres → Permissions</span>.
                </p>
              </div>

              {selectedRole === 'agency' && (
                <div className="space-y-3">
                  <Label>Agences rattachées</Label>
                  {loadingAgencies ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : agencies.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      Aucune agence disponible. Créez une agence d'abord.
                    </p>
                  ) : (
                    <div className="space-y-2 border rounded-md p-4 max-h-[200px] overflow-y-auto">
                      {agencies.map((agency) => (
                        <div key={agency.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`agency-${agency.id}`}
                            checked={selectedAgencies.includes(agency.id)}
                            onCheckedChange={() => handleAgencyToggle(agency.id)}
                          />
                          <label
                            htmlFor={`agency-${agency.id}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {agency.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={savingAccess || submittingPassword}>
            Fermer
          </Button>
          {tab === 'password' && !createdCreds && (
            <Button onClick={handleSavePassword} disabled={submittingPassword}>
              {submittingPassword ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Application...</>
              ) : (
                'Définir le mot de passe'
              )}
            </Button>
          )}
          {tab === 'access' && isAdmin && (
            <Button onClick={handleSaveAccess} disabled={savingAccess}>
              {savingAccess ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</>
              ) : (
                'Enregistrer les accès'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
