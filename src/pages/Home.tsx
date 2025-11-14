import { useState, useEffect } from 'react';
import { TodoList } from '@/components/home/TodoList';
import { QuickNotes } from '@/components/home/QuickNotes';
import { TodayTasks } from '@/components/home/TodayTasks';
import { CalendarView } from '@/components/home/CalendarView';
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
        .select('display_name, first_name, last_name')
        .eq('id', user.id)
        .single();

      if (profile) {
        const name = profile.display_name || `${profile.first_name} ${profile.last_name}`;
        setUserName(name);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Bienvenue sur HubTeam {userName}
        </h1>
        <p className="text-muted-foreground mt-1 capitalize">{today}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <TodoList />
        <QuickNotes />
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        <TodayTasks />
        <CalendarView />
      </div>
    </div>
  );
}
