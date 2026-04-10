import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { BarChart3, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface UserWithAccess {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string | null;
  granted: boolean;
}

export function LagostinaAccessTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['lagostina-access-management'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, avatar_url');
      if (pErr) throw pErr;

      // Get all roles
      const { data: roles, error: rErr } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rErr) throw rErr;

      // Get all lagostina_access
      const { data: accesses, error: aErr } = await supabase
        .from('lagostina_access')
        .select('user_id, granted');
      if (aErr) throw aErr;

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      const accessMap = new Map(accesses?.map(a => [a.user_id, a.granted]) || []);

      return (profiles || [])
        .filter(p => {
          const role = roleMap.get(p.id);
          // Don't show admin/team (they always have access)
          return role !== 'admin' && role !== 'team';
        })
        .map(p => ({
          id: p.id,
          email: p.email || '',
          first_name: p.first_name,
          last_name: p.last_name,
          avatar_url: p.avatar_url,
          role: roleMap.get(p.id) || null,
          granted: accessMap.get(p.id) ?? false,
        }))
        .sort((a, b) => {
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim();
          return nameA.localeCompare(nameB);
        }) as UserWithAccess[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ userId, granted }: { userId: string; granted: boolean }) => {
      if (granted) {
        const { error } = await supabase
          .from('lagostina_access')
          .upsert({ user_id: userId, granted: true }, { onConflict: 'user_id' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lagostina_access')
          .delete()
          .eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lagostina-access-management'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-access'] });
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour de l\'accès');
    },
  });

  const filtered = (users || []).filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    return name.includes(q) || u.email.toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
  });

  const roleLabel = (role: string | null) => {
    switch (role) {
      case 'client': return 'Client';
      case 'agency': return 'Agence';
      default: return role || '—';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Accès Lagostina
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez les utilisateurs ayant accès au dashboard Lagostina. Les administrateurs et l'équipe ont toujours accès.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un utilisateur..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Aucun utilisateur trouvé
        </p>
      ) : (
        <div className="border rounded-lg divide-y">
          {filtered.map(user => {
            const initials = `${(user.first_name || '')[0] || ''}${(user.last_name || '')[0] || ''}`.toUpperCase() || '?';
            return (
              <div key={user.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {user.first_name || ''} {user.last_name || ''}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs ml-2">
                    {roleLabel(user.role)}
                  </Badge>
                </div>
                <Switch
                  checked={user.granted}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({ userId: user.id, granted: checked })
                  }
                  disabled={toggleMutation.isPending}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
