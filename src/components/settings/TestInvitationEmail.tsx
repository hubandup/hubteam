import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function TestInvitationEmail() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

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
      console.log('Test email sent:', data);
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error('Erreur lors de l\'envoi de l\'email de test');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Test d'email d'invitation
        </CardTitle>
        <CardDescription>
          Envoyez un email de test avec le template Brevo d'invitation
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
  );
}
