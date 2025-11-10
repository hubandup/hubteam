import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SelectClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onClientSelected: () => void;
}

export function SelectClientDialog({ 
  open, 
  onOpenChange, 
  projectId,
  onClientSelected 
}: SelectClientDialogProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [associating, setAssociating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('company');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Erreur lors du chargement des clients');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    
    const query = searchQuery.toLowerCase();
    return clients.filter(client =>
      client.company?.toLowerCase().includes(query) ||
      client.first_name?.toLowerCase().includes(query) ||
      client.last_name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const handleSelectClient = async (clientId: string) => {
    setAssociating(true);
    try {
      const { error } = await supabase
        .from('project_clients')
        .insert({
          project_id: projectId,
          client_id: clientId,
        });

      if (error) throw error;

      toast.success('Client associé au projet avec succès');
      onClientSelected();
      onOpenChange(false);
    } catch (error) {
      console.error('Error linking client to project:', error);
      toast.error("Erreur lors de l'association du client au projet");
    } finally {
      setAssociating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Sélectionner un client</DialogTitle>
          <DialogDescription>
            Choisissez un client existant à associer à ce projet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {clients.length === 0 
                  ? 'Aucun client disponible' 
                  : 'Aucun client trouvé'}
              </p>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-2">
                  Essayez une autre recherche
                </p>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {filteredClients.map((client) => (
                  <Button
                    key={client.id}
                    variant="outline"
                    className="w-full justify-start h-auto p-4"
                    onClick={() => handleSelectClient(client.id)}
                    disabled={associating}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Avatar className="h-10 w-10">
                        {client.logo_url && (
                          <AvatarImage src={client.logo_url} alt={client.company} />
                        )}
                        <AvatarFallback>
                          {client.company.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <p className="font-semibold">{client.company}</p>
                        <p className="text-sm text-muted-foreground">
                          {client.first_name} {client.last_name}
                        </p>
                        {client.email && (
                          <p className="text-xs text-muted-foreground">
                            {client.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
