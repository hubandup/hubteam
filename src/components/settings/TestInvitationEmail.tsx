import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export function TestInvitationEmail() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingNotif, setSendingNotif] = useState(false);

  const handleSendTest = async () => {
    if (!email) {
      toast.error('Veuillez entrer une adresse email');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-invitation-email', {
        body: { email }
      });

      if (error) throw error;

      toast.success('Email de test envoyé avec succès!');
      
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error('Erreur lors de l\'envoi de l\'email de test');
    } finally {
      setSending(false);
    }
  };

  const handleSendNotificationTest = async () => {
    if (!user) {
      toast.error('Vous devez être connecté pour tester les notifications');
      return;
    }

    setSendingNotif(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          userId: user.id,
          title: 'Test de notification',
          message: 'Ceci est un email de test pour vérifier que les notifications Brevo fonctionnent correctement. Si vous recevez cet email, la configuration est correcte!',
          link: '/settings?tab=test-email'
        }
      });

      if (error) throw error;

      toast.success('Notification de test envoyée! Vérifiez votre boîte email.');
      
    } catch (error: any) {
      console.error('Error sending test notification:', error);
      toast.error('Erreur lors de l\'envoi de la notification de test');
    } finally {
      setSendingNotif(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Test d'email d'invitation
          </CardTitle>
          <CardDescription>
            Envoyez un email de test avec le template Brevo d'invitation (ID 47)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-email">Adresse email</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleSendTest} 
            disabled={sending || !email}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Envoyer un email de test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Test de notification générale
          </CardTitle>
          <CardDescription>
            Envoyez-vous une notification de test avec le template Brevo (ID 49)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleSendNotificationTest} 
            disabled={sendingNotif || !user}
            className="w-full"
          >
            {sendingNotif ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Envoyer une notification de test
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
