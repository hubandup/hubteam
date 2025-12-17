import { useState, useEffect } from 'react';
import { TodoList } from '@/components/home/TodoList';
import { QuickNotes } from '@/components/home/QuickNotes';
import { TodayTasks } from '@/components/home/TodayTasks';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Home() {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserName(profile.first_name);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 18 || hour < 6) {
      return 'Bonsoir';
    }
    return 'Bonjour';
  };

  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {getGreeting()} {userName}
        </h1>
        <p className="text-muted-foreground mt-1 capitalize">{today}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <TodoList />
        <QuickNotes />
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        <TodayTasks />
      </div>
    </div>
  );
}
