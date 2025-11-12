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

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    // Vérifier si l'utilisateur a un token valide dans l'URL
    const checkToken = async () => {
      try {
        // Supabase gère automatiquement le token dans l'URL
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
  }, [navigate]);

  const handleSetPassword = async (data: PasswordFormData) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast.error('Erreur lors de la définition du mot de passe : ' + error.message);
        return;
      }

      toast.success('Mot de passe défini avec succès ! Vous allez être redirigé...');
      
      // Rediriger vers le dashboard après un court délai
      setTimeout(() => {
        navigate('/');
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
          <CardTitle className="text-2xl text-center">Définir votre mot de passe</CardTitle>
          <CardDescription className="text-center">
            Choisissez un mot de passe sécurisé pour votre compte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSetPassword)} className="space-y-4">
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
                {form.formState.isSubmitting ? 'Définition en cours...' : 'Définir le mot de passe'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
