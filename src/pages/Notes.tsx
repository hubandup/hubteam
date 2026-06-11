import { TodoList } from '@/components/home/TodoList';
import { QuickNotes } from '@/components/home/QuickNotes';
import { PageHeader } from '@/components/layout';
import { useTranslation } from 'react-i18next';

export default function Notes() {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 md:space-y-6">
      <PageHeader
        title={t('notes.title', { defaultValue: 'Notes' })}
        subtitle={t('notes.subtitle', { defaultValue: 'Tâches et notes rapides' })}
      />
      <TodoList />
      <QuickNotes />
    </div>
  );
}
