import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, RefreshCw, Copy, Check } from 'lucide-react';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; email: string; role: 'admin' | 'team' | 'client' | 'agency' | null } | null;
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

export function ResetPasswordDialog({ open, onOpenChange, user }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setPassword('');
    setShowPassword(false);
    setCreated(null);
    setCopied(false);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!password || password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    setSubmitting(true);
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
      setCreated({ email: user.email, password });
      toast.success('Mot de passe provisoire défini');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erreur lors de la réinitialisation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(`Email : ${created.email}\nMot de passe provisoire : ${created.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Identifiants copiés');
  };

  const handleOpenChange = (o: boolean) => {
    if (submitting) return;
    if (!o) reset();
    onOpenChange(o);
  };

  if (created) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mot de passe provisoire défini</DialogTitle>
            <DialogDescription>
              Communiquez ces identifiants de manière sécurisée. L'utilisateur devra changer son mot de passe à sa prochaine connexion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input readOnly value={created.email} />
            </div>
            <div className="space-y-1">
              <Label>Mot de passe provisoire</Label>
              <Input readOnly value={created.password} className="font-mono" />
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            Définissez un mot de passe provisoire pour {user?.email}. L'utilisateur devra le modifier à sa prochaine connexion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reset-password">Mot de passe provisoire</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
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
                disabled={submitting}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Générer
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Application...</>) : 'Définir le mot de passe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
