import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import logo from '@/assets/logo-hubandup.svg';

const passwordSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  confirmPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function SetPassword() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    // Détecter si c'est un flow de récupération depuis le hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const tokenType = hashParams.get('type');
    if (tokenType === 'recovery') {
      setIsRecovery(true);
    }

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        
        
        if (event === 'PASSWORD_RECOVERY' && session) {
          setIsRecovery(true);
          setIsValidToken(true);
          setIsLoading(false);
        } else if (event === 'SIGNED_IN' && session) {
          setIsValidToken(true);
          setIsLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setIsValidToken(true);
          setIsLoading(false);
        }
      }
    );

    // Vérifier si l'utilisateur a un token valide dans l'URL ou une session existante
    const checkToken = async () => {
      try {
        // Vérifier d'abord s'il y a un hash avec des tokens dans l'URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) {
            console.error('Error setting session from URL tokens:', error);
            toast.error('Lien d\'invitation invalide ou expiré');
            navigate('/auth');
            return;
          }
          
          if (data.session) {
            setIsValidToken(true);
            setIsLoading(false);
            // Nettoyer l'URL
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }
        }
        
        // Sinon, vérifier la session existante
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          toast.error('Lien d\'invitation invalide ou expiré');
          navigate('/auth');
          return;
        }

        if (session) {
          setIsValidToken(true);
        } else {
          toast.error('Lien d\'invitation invalide ou expiré');
          navigate('/auth');
        }
      } catch (error) {
        console.error('Error checking token:', error);
        toast.error('Une erreur est survenue');
        navigate('/auth');
      } finally {
        setIsLoading(false);
      }
    };

    checkToken();
    
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSetPassword = async (data: PasswordFormData) => {
    try {
      const { data: { user }, error: updateError } = await supabase.auth.updateUser({
        password: data.password,
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
        }
      });

      if (updateError) {
        toast.error('Erreur lors de la définition du mot de passe : ' + updateError.message);
        return;
      }

      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            first_name: data.firstName,
            last_name: data.lastName,
          })
          .eq('id', user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }

      toast.success('Compte configuré avec succès ! Vous allez être redirigé...');
      
      setTimeout(() => {
        navigate('/auth');
      }, 1500);
    } catch (error) {
      console.error('Error setting password:', error);
      toast.error('Une erreur est survenue');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-light to-background">
        <div className="text-muted-foreground">Vérification de votre invitation...</div>
      </div>
    );
  }

  if (!isValidToken) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-light to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <img src={logo} alt="HubandUp" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl text-center">
            {isRecovery ? 'Réinitialiser votre mot de passe' : 'Finaliser votre inscription'}
          </CardTitle>
          <CardDescription className="text-center">
            {isRecovery
              ? 'Choisissez un nouveau mot de passe sécurisé'
              : 'Renseignez vos informations et choisissez un mot de passe sécurisé'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSetPassword)} className="space-y-4">
              {!isRecovery && (
                <>
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom</FormLabel>
                        <FormControl>
                          <Input {...field} type="text" placeholder="Votre prénom" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input {...field} type="text" placeholder="Votre nom" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Configuration en cours...' : (isRecovery ? 'Réinitialiser le mot de passe' : 'Finaliser mon inscription')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
