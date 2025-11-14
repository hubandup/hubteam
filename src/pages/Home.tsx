import { MyWeeklySchedule } from '@/components/home/MyWeeklySchedule';
import { TodoList } from '@/components/home/TodoList';
import { TodayTasks } from '@/components/home/TodayTasks';
import { CalendarView } from '@/components/home/CalendarView';

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Accueil</h1>
        <p className="text-muted-foreground mt-1">Votre espace personnel de travail</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <TodayTasks />
          <MyWeeklySchedule />
        </div>
        <div className="space-y-6">
          <TodoList />
          <CalendarView />
        </div>
      </div>
    </div>
  );
}
