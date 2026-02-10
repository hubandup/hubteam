import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Users, FolderKanban, CheckSquare, Building2, Contact } from 'lucide-react';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: 'client' | 'project' | 'task' | 'agency' | 'contact';
  path: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const searchTerm = `%${q}%`;

    const [clientsRes, projectsRes, tasksRes, agenciesRes, contactsRes] = await Promise.all([
      supabase.from('clients').select('id, company, first_name, last_name').or(`company.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm}`).limit(5),
      supabase.from('projects').select('id, name, status').ilike('name', searchTerm).limit(5),
      supabase.from('tasks').select('id, title, status').ilike('title', searchTerm).limit(5),
      supabase.from('agencies').select('id, name').ilike('name', searchTerm).limit(5),
      supabase.from('client_contacts').select('id, first_name, last_name, email, client_id').or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`).limit(5),
    ]);

    const all: SearchResult[] = [];

    (clientsRes.data || []).forEach((c) =>
      all.push({ id: c.id, label: c.company, sublabel: `${c.first_name} ${c.last_name}`, type: 'client', path: `/client/${c.id}` })
    );
    (projectsRes.data || []).forEach((p) =>
      all.push({ id: p.id, label: p.name, sublabel: p.status, type: 'project', path: `/project/${p.id}` })
    );
    (tasksRes.data || []).forEach((tk) =>
      all.push({ id: tk.id, label: tk.title, sublabel: tk.status, type: 'task', path: `/tasks` })
    );
    (agenciesRes.data || []).forEach((a) =>
      all.push({ id: a.id, label: a.name, type: 'agency', path: `/agency/${a.id}` })
    );
    (contactsRes.data || []).forEach((co) =>
      all.push({ id: co.id, label: `${co.first_name} ${co.last_name}`, sublabel: co.email, type: 'contact', path: `/client/${co.client_id}` })
    );

    setResults(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    navigate(result.path);
  };

  const iconMap = {
    client: <Users className="h-4 w-4 text-muted-foreground" />,
    project: <FolderKanban className="h-4 w-4 text-muted-foreground" />,
    task: <CheckSquare className="h-4 w-4 text-muted-foreground" />,
    agency: <Building2 className="h-4 w-4 text-muted-foreground" />,
    contact: <Contact className="h-4 w-4 text-muted-foreground" />,
  };

  const groupLabels: Record<string, string> = {
    client: 'Clients',
    project: 'Projets',
    task: 'Tâches',
    agency: 'Agences',
    contact: 'Contacts',
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Rechercher clients, projets, tâches, contacts..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? 'Recherche...' : query.length < 2 ? 'Tapez au moins 2 caractères' : 'Aucun résultat'}
        </CommandEmpty>
        {Object.entries(grouped).map(([type, items], gi) => (
          <div key={type}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={groupLabels[type]}>
              {items.map((r) => (
                <CommandItem key={`${r.type}-${r.id}`} onSelect={() => handleSelect(r)} className="cursor-pointer">
                  {iconMap[r.type]}
                  <div className="ml-2 flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.label}</p>
                    {r.sublabel && <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
