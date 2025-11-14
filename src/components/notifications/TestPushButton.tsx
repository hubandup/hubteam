import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function TestPushButton() {
  const [loading, setLoading] = useState(false);

  const handleTestPush = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Vous devez être connecté');
        return;
      }

      const { data, error } = await supabase.functions.invoke('push-test', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast.success('Notification de test envoyée !');
      console.log('Test result:', data);
    } catch (error: any) {
      console.error('Error sending test:', error);
      toast.error('Erreur lors de l\'envoi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleTestPush} 
      disabled={loading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Bell className="h-4 w-4" />
      {loading ? 'Envoi...' : 'Test Push'}
    </Button>
  );
}
