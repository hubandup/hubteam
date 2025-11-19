import { TodoList } from '@/components/home/TodoList';
import { QuickNotes } from '@/components/home/QuickNotes';

export default function Notes() {
  return (
    <div className="p-6 space-y-6">
      <TodoList />
      <QuickNotes />
    </div>
  );
}
