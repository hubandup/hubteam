import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AgencyCard } from '@/components/AgencyCard';
import { AddAgencyDialog } from '@/components/AddAgencyDialog';
import { toast } from 'sonner';
import { ProtectedAction } from '@/components/ProtectedAction';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import { X, Search } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export default function Agencies() {
  const navigate = useNavigate();
  const { canRead } = usePermissions();
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearchOpen, setTagSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAgencies();
  }, []);

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select(`
          *,
          agency_contacts (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      console.error('Error fetching agencies:', error);
      toast.error('Erreur lors du chargement des agences');
    } finally {
      setLoading(false);
    }
  };

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    agencies.forEach(agency => {
      if (agency.tags) {
        agency.tags.forEach((tag: string) => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [agencies]);

  // Filter agencies by selected tags and search query
  const filteredAgencies = useMemo(() => {
    let filtered = agencies;
    
    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(agency => {
        if (!agency.tags || agency.tags.length === 0) return false;
        return selectedTags.some(tag => agency.tags.includes(tag));
      });
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(agency => {
        // Search in agency name
        if (agency.name?.toLowerCase().includes(query)) return true;
        
        // Search in tags
        if (agency.tags?.some((tag: string) => tag.toLowerCase().includes(query))) return true;
        
        // Search in contacts
        if (agency.agency_contacts?.some((contact: any) => 
          contact.first_name?.toLowerCase().includes(query) ||
          contact.last_name?.toLowerCase().includes(query) ||
          contact.email?.toLowerCase().includes(query)
        )) return true;
        
        return false;
      });
    }
    
    return filtered;
  }, [agencies, selectedTags, searchQuery]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const getTagColor = (tag: string): string => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `${hue} 70% 50%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!canRead('agencies')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Accès refusé</p>
          <p className="text-muted-foreground">Vous n'avez pas les permissions pour accéder aux agences</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agences</h1>
          <p className="text-muted-foreground">Gérez vos agences partenaires</p>
        </div>
        <ProtectedAction module="agencies" action="create">
          <AddAgencyDialog onAgencyAdded={fetchAgencies} />
        </ProtectedAction>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Rechercher :</p>
        <Popover open={tagSearchOpen} onOpenChange={setTagSearchOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              <Search className="mr-2 h-4 w-4" />
              Rechercher...
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start" side="bottom">
            <Command>
              <CommandInput 
                placeholder="Rechercher..." 
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
                {allTags.length > 0 && (
                  <CommandGroup heading="Expertises">
                    {allTags.map((tag) => (
                      <CommandItem
                        key={tag}
                        onSelect={() => {
                          toggleTag(tag);
                          setTagSearchOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <Badge
                          variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                          style={{
                            backgroundColor: selectedTags.includes(tag) ? `hsl(${getTagColor(tag)})` : 'transparent',
                            borderColor: `hsl(${getTagColor(tag)})`,
                            color: selectedTags.includes(tag) ? 'white' : `hsl(${getTagColor(tag)})`,
                          }}
                        >
                          {tag}
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
          
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <Badge
                key={tag}
                className="cursor-pointer"
                style={{
                  backgroundColor: `hsl(${getTagColor(tag)})`,
                  borderColor: `hsl(${getTagColor(tag)})`,
                  color: 'white',
                }}
                onClick={() => toggleTag(tag)}
              >
                {tag}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {agencies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucune agence pour le moment</p>
          <p className="text-sm text-muted-foreground mt-2">Commencez par ajouter une nouvelle agence</p>
        </div>
      ) : filteredAgencies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucune agence ne correspond aux tags sélectionnés</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgencies.map((agency) => (
            <AgencyCard
              key={agency.id}
              agency={agency}
              onClick={() => navigate(`/agency/${agency.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
