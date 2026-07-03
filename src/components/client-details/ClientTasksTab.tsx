import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Calendar, User as UserIcon, ExternalLink } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { buildEmbeddedProjectPath } from '@/lib/project-nav';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface ClientTasksTabProps {
  clientId: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  end_date: string | null;
  assigned_to: string | null;
  project_id: string;
  projects?: { id: string; name: string } | null;
  assignee?: { first_name: string | null; last_name: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminée',
  blocked: 'Bloquée',
};

const STATUS_ORDER = ['todo', 'in_progress', 'blocked', 'done'];

export function ClientTasksTab({ clientId }: ClientTasksTabProps) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('open');

  useEffect(() => { fetchTasks(); }, [clientId]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      // 1. Get all project ids linked to this client
      const { data: pc, error: pcErr } = await supabase
        .from('project_clients')
        .select('project_id')
        .eq('client_id', clientId);
      if (pcErr) throw pcErr;
      const projectIds = (pc || []).map((r: any) => r.project_id).filter(Boolean);

      if (projectIds.length === 0) {
        setTasks([]);
        return;
      }

      // 2. Fetch tasks with project name + assignee profile
      const { data: rows, error } = await supabase
        .from('tasks')
        .select(`
          id, title, status, priority, end_date, assigned_to, project_id,
          projects:project_id ( id, name )
        `)
        .in('project_id', projectIds)
        .order('end_date', { ascending: true, nullsFirst: false });
      if (error) throw error;

      const assigneeIds = Array.from(
        new Set((rows || []).map((r: any) => r.assigned_to).filter(Boolean)),
      ) as string[];

      let profilesMap: Record<string, { first_name: string | null; last_name: string | null }> = {};
      if (assigneeIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', assigneeIds);
        profilesMap = Object.fromEntries(
          (profiles || []).map((p: any) => [p.id, { first_name: p.first_name, last_name: p.last_name }]),
        );
      }

      setTasks(
        (rows || []).map((r: any) => ({
          ...r,
          assignee: r.assigned_to ? profilesMap[r.assigned_to] || null : null,
        })),
      );
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  };

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      if (t.projects?.id && t.projects?.name) map.set(t.projects.id, t.projects.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => projectFilter === 'all' || t.project_id === projectFilter)
      .filter((t) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'open') return t.status !== 'done';
        return t.status === statusFilter;
      })
      .sort((a, b) => {
        const sa = STATUS_ORDER.indexOf(a.status || 'todo');
        const sb = STATUS_ORDER.indexOf(b.status || 'todo');
        if (sa !== sb) return sa - sb;
        const da = a.end_date ? new Date(a.end_date).getTime() : Number.POSITIVE_INFINITY;
        const db = b.end_date ? new Date(b.end_date).getTime() : Number.POSITIVE_INFINITY;
        return da - db;
      });
  }, [tasks, projectFilter, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[240px] h-9">
            <SelectValue placeholder="Filtrer par projet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les projets ({tasks.length})</SelectItem>
            {projectOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">À faire / en cours</SelectItem>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="todo">À faire</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="blocked">Bloquées</SelectItem>
            <SelectItem value="done">Terminées</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} tâche{filtered.length !== 1 ? 's' : ''} affichée{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Aucune tâche ne correspond aux filtres sélectionnés.
        </div>
      ) : (
        <div className="rounded-card border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Tâche</th>
                <th className="text-left px-4 py-2 font-semibold">Projet</th>
                <th className="text-left px-4 py-2 font-semibold">Assignée à</th>
                <th className="text-left px-4 py-2 font-semibold">Statut</th>
                <th className="text-left px-4 py-2 font-semibold">Échéance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const overdue = t.end_date && t.status !== 'done' && isPast(new Date(t.end_date));
                const assigneeName = [t.assignee?.first_name, t.assignee?.last_name]
                  .filter(Boolean)
                  .join(' ') || '—';
                return (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium text-foreground">{t.title}</td>
                    <td className="px-4 py-2.5">
                      {t.projects?.id ? (
                        <button
                          type="button"
                          onClick={() => navigate(buildEmbeddedProjectPath(clientId, t.projects!.id, 'tasks'))}
                          className="inline-flex items-center gap-1 rounded-badge bg-muted px-2 py-0.5 text-xs hover:bg-foreground hover:text-background transition-colors"
                        >
                          {t.projects.name}
                          <ExternalLink size={10} />
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <UserIcon size={12} /> {assigneeName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-badge bg-muted px-2 py-0.5 text-xs">
                        {STATUS_LABELS[t.status || 'todo'] || t.status}
                      </span>
                    </td>
                    <td className={cn('px-4 py-2.5', overdue ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                      {t.end_date ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} />
                          {format(new Date(t.end_date), 'dd MMM yyyy', { locale: fr })}
                          {overdue && ' · en retard'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
