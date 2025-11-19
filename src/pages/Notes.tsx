import { TodoList } from '@/components/home/TodoList';
import { QuickNotes } from '@/components/home/QuickNotes';

export default function Notes() {
  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-6 pb-20 md:pb-8">
      <TodoList />
      <QuickNotes />
    </div>
  );
}
