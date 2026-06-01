import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, RefreshCw, Copy, Check } from 'lucide-react';
import { z } from 'zod';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const inviteSchema = z.object({
  email: z.string().trim().email({ message: "Email invalide" }),
  role: z.enum(['admin', 'team', 'client', 'agency'], {
    required_error: "Veuillez sélectionner un rôle"
  }),
});

const passwordSchema = inviteSchema.extend({
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

type Mode = 'invite' | 'password';

function generatePassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  // Ensure at least one of each category
  let out = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
  ];
  for (let i = 4; i < length; i++) out.push(all[arr[i] % all.length]);
  // Shuffle
  for (let i = out.length - 1; i > 0; i--) {
    const j = arr[i % arr.length] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join('');
}

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const [mode, setMode] = useState<Mode>('invite');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setMode('invite');
    setEmail('');
    setRole('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setShowPassword(false);
    setCreatedCredentials(null);
    setCopied(false);
  };

  const handleSubmit = async () => {
    try {
      const schema = mode === 'password' ? passwordSchema : inviteSchema;
      const payload: any = { email, role };
      if (mode === 'password') {
        payload.password = password;
        payload.firstName = firstName;
        payload.lastName = lastName;
      }
      const validation = schema.safeParse(payload);
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      setInviting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expirée, veuillez vous reconnecter');
        return;
      }

      const body: any = { email, role, mode };
      if (mode === 'password') {
        body.password = password;
        body.firstName = firstName;
        body.lastName = lastName;
      }

      const { data, error } = await supabase.functions.invoke('invite-user', { body });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error, { description: data.details, duration: 6000 });
        return;
      }

      if (mode === 'password') {
        setCreatedCredentials({ email, password });
        toast.success('Compte créé avec succès');
        onSuccess();
      } else {
        toast.success('Invitation envoyée', { description: `Un email a été envoyé à ${email}` });
        reset();
        onOpenChange(false);
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error creating user:', err);
      toast.error(err?.message || "Erreur lors de la création de l'utilisateur");
    } finally {
      setInviting(false);
    }
  };

  const handleCopy = async () => {
    if (!createdCredentials) return;
    const text = `Email : ${createdCredentials.email}\nMot de passe provisoire : ${createdCredentials.password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Identifiants copiés');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (inviting) return;
    if (!newOpen) reset();
    onOpenChange(newOpen);
  };

  // ---- Confirmation screen ----
  if (createdCredentials) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compte créé avec succès</DialogTitle>
            <DialogDescription>
              Communiquez ces identifiants à l'utilisateur de manière sécurisée. Il devra changer son mot de passe à la première connexion.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input readOnly value={createdCredentials.email} />
            </div>
            <div className="space-y-1">
              <Label>Mot de passe provisoire</Label>
              <Input readOnly value={createdCredentials.password} className="font-mono" />
            </div>
            <Button onClick={handleCopy} variant="outline" className="w-full">
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copié' : 'Copier les identifiants'}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ---- Form screen ----
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter un utilisateur</DialogTitle>
          <DialogDescription>
            Envoyez une invitation par email ou créez le compte avec un mot de passe provisoire.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid grid-cols-2 gap-2">
            <label className={`flex items-center gap-2 border p-3 cursor-pointer ${mode === 'invite' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <RadioGroupItem value="invite" id="m-invite" />
              <span className="text-sm">Invitation par email</span>
            </label>
            <label className={`flex items-center gap-2 border p-3 cursor-pointer ${mode === 'password' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <RadioGroupItem value="password" id="m-password" />
              <span className="text-sm">Mot de passe provisoire</span>
            </label>
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="utilisateur@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={inviting} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rôle</Label>
            <Select value={role} onValueChange={setRole} disabled={inviting}>
              <SelectTrigger id="role"><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="team">Équipe</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="agency">Agence</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'password' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={inviting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={inviting} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe provisoire</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={inviting}
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
                    disabled={inviting}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Générer
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  L'utilisateur devra changer ce mot de passe à sa première connexion.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={inviting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={inviting}>
            {inviting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{mode === 'password' ? 'Création...' : 'Envoi...'}</>
            ) : (mode === 'password' ? 'Créer le compte' : "Envoyer l'invitation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
