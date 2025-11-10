import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, Upload, User, Mail, Lock, Badge as BadgeIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { UserManagement } from '@/components/settings/UserManagement';

const profileSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis').max(100),
  lastName: z.string().min(1, 'Le nom est requis').max(100),
  displayName: z.string().max(100).optional(),
  email: z.string().email('Email invalide'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  newPassword: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function Settings() {
  const { user } = useAuth();
  const { role, isAdmin } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      displayName: '',
      email: '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, display_name, email, avatar_url')
      .eq('id', user.id)
      .single();

    if (error) {
      toast.error('Erreur lors du chargement du profil');
      return;
    }

    if (data) {
      profileForm.reset({
        firstName: data.first_name,
        lastName: data.last_name,
        displayName: data.display_name || '',
        email: data.email,
      });
      setAvatarUrl(data.avatar_url);
    }
  };

  const onProfileSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    setLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          display_name: data.displayName || null,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update email if changed
      if (data.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: data.email,
        });

        if (emailError) throw emailError;
        toast.success('Un email de confirmation a été envoyé à votre nouvelle adresse');
      } else {
        toast.success('Profil mis à jour avec succès');
      }

      await fetchProfile();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setLoading(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    if (!user) return;

    setLoading(true);
    try {
      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: data.currentPassword,
      });

      if (signInError) {
        toast.error('Mot de passe actuel incorrect');
        setLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (updateError) throw updateError;

      toast.success('Mot de passe mis à jour avec succès');
      passwordForm.reset();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du mot de passe');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Math.random()}.${fileExt}`;
    const filePath = fileName;

    setUploadingAvatar(true);
    try {
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('client-logos')
        .getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlData.publicUrl);
      toast.success('Avatar mis à jour avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du téléchargement de l\'avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getRoleBadge = () => {
    const roleLabels = {
      admin: { label: 'Administrateur', variant: 'default' as const },
      team: { label: 'Équipe', variant: 'secondary' as const },
      client: { label: 'Client', variant: 'outline' as const },
      agency: { label: 'Agence', variant: 'outline' as const },
    };

    if (!role) return null;
    const roleInfo = roleLabels[role];
    return <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>;
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'Gérez les utilisateurs et vos informations personnelles' : 'Gérez vos informations personnelles'}
        </p>
      </div>

      {/* User Management Section - Only for Admins */}
      {isAdmin && <UserManagement />}

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profil utilisateur
          </CardTitle>
          <CardDescription>Informations générales de votre compte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-2xl">
                {profileForm.watch('firstName')?.[0]}{profileForm.watch('lastName')?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingAvatar}
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  {uploadingAvatar ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Téléchargement...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Changer l'avatar
                    </>
                  )}
                </Button>
              </Label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <p className="text-sm text-muted-foreground mt-2">
                JPG, PNG ou GIF. Taille maximale : 5MB
              </p>
            </div>
            <div className="flex items-center gap-2">
              <BadgeIcon className="h-4 w-4 text-muted-foreground" />
              {getRoleBadge()}
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  {...profileForm.register('firstName')}
                  placeholder="Jean"
                />
                {profileForm.formState.errors.firstName && (
                  <p className="text-sm text-destructive">
                    {profileForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  {...profileForm.register('lastName')}
                  placeholder="Dupont"
                />
                {profileForm.formState.errors.lastName && (
                  <p className="text-sm text-destructive">
                    {profileForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Nom d'affichage</Label>
              <Input
                id="displayName"
                {...profileForm.register('displayName')}
                placeholder="Jean D."
              />
              <p className="text-sm text-muted-foreground">
                Optionnel - Ce nom sera affiché au lieu de votre prénom et nom
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  {...profileForm.register('email')}
                  placeholder="jean.dupont@example.com"
                  className="flex-1"
                />
              </div>
              {profileForm.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {profileForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer les modifications'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Changer le mot de passe
          </CardTitle>
          <CardDescription>Modifiez votre mot de passe de connexion</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Mot de passe actuel *</Label>
              <Input
                id="currentPassword"
                type="password"
                {...passwordForm.register('currentPassword')}
                placeholder="••••••••"
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe *</Label>
              <Input
                id="newPassword"
                type="password"
                {...passwordForm.register('newPassword')}
                placeholder="••••••••"
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe *</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...passwordForm.register('confirmPassword')}
                placeholder="••••••••"
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                'Changer le mot de passe'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
