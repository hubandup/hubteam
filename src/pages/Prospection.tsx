import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClients } from '@/hooks/useClients';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Mail, Linkedin, ArrowDownUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Prospection() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: clients = [], isLoading: loading } = useClients();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'alphabetical' | 'company'>('alphabetical');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterSector, setFilterSector] = useState<string>('all');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Extract unique filters
  const sources = useMemo(() => {
    const uniqueSources = new Set(clients.map(c => c.source_id).filter(Boolean));
    return Array.from(uniqueSources);
  }, [clients]);

  const actions = useMemo(() => {
    const uniqueActions = new Set(clients.map(c => c.status_id).filter(Boolean));
    return Array.from(uniqueActions);
  }, [clients]);

  const sectors = useMemo(() => {
    const uniqueSectors = new Set(clients.map(c => c.activity_sector_id).filter(Boolean));
    return Array.from(uniqueSectors);
  }, [clients]);

  const filteredClients = useMemo(() => {
    let result = clients;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(client =>
        client.company?.toLowerCase().includes(query) ||
        client.first_name?.toLowerCase().includes(query) ||
        client.last_name?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.toLowerCase().includes(query)
      );
    }
    
    // Apply source filter
    if (filterSource !== 'all') {
      result = result.filter(client => client.source_id === filterSource);
    }
    
    // Apply action filter
    if (filterAction !== 'all') {
      result = result.filter(client => client.status_id === filterAction);
    }
    
    // Apply sector filter
    if (filterSector !== 'all') {
      result = result.filter(client => client.activity_sector_id === filterSector);
    }
    
    // Apply sorting
    if (sortBy === 'alphabetical') {
      result = [...result].sort((a, b) => {
        const aName = `${a.first_name} ${a.last_name}`.toLowerCase();
        const bName = `${b.first_name} ${b.last_name}`.toLowerCase();
        return aName.localeCompare(bName);
      });
    } else if (sortBy === 'company') {
      result = [...result].sort((a, b) => {
        const aCompany = a.company?.toLowerCase() || '';
        const bCompany = b.company?.toLowerCase() || '';
        return aCompany.localeCompare(bCompany);
      });
    }
    
    return result;
  }, [clients, searchQuery, sortBy, filterSource, filterAction, filterSector]);

  const handleSelectClient = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredClients.map(c => c.id));
    }
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) {
      toast.error('Veuillez remplir le sujet et le message');
      return;
    }

    if (selectedClients.length === 0) {
      toast.error('Veuillez sélectionner au moins un contact');
      return;
    }

    setSendingEmail(true);
    try {
      const selectedClientData = clients.filter(c => selectedClients.includes(c.id));
      
      const { error } = await supabase.functions.invoke('send-prospection-email', {
        body: {
          recipients: selectedClientData.map(c => ({
            email: c.email,
            firstName: c.first_name,
            lastName: c.last_name,
            company: c.company
          })),
          subject: emailSubject,
          message: emailMessage
        }
      });

      if (error) throw error;

      toast.success(`Email envoyé à ${selectedClients.length} contact(s)`);
      setEmailDialogOpen(false);
      setEmailSubject('');
      setEmailMessage('');
      setSelectedClients([]);
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Erreur lors de l\'envoi des emails');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 pb-2 md:pb-4 bg-background">
        <h1 className="text-xl md:text-3xl font-bold text-foreground mb-0.5">Prospection</h1>
        <p className="text-muted-foreground text-xs md:text-base">Gérez vos contacts et campagnes d'emailing</p>
      </div>

      {/* Filters and Actions */}
      <div className="flex-shrink-0 pb-2 md:pb-4 bg-background space-y-2">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-white dark:bg-background h-10 text-sm"
            />
          </div>
          
          {!isMobile && (
            <>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[180px]">
                  <ArrowDownUp className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Trier par..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alphabetical">Nom alphabétique</SelectItem>
                  <SelectItem value="company">Société</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes sources</SelectItem>
                  {sources.map(sourceId => {
                    const client = clients.find(c => c.source_id === sourceId);
                    return client ? (
                      <SelectItem key={sourceId} value={sourceId}>
                        {client.source_id}
                      </SelectItem>
                    ) : null;
                  })}
                </SelectContent>
              </Select>

              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes actions</SelectItem>
                  {actions.map(actionId => {
                    const client = clients.find(c => c.status_id === actionId);
                    return client?.action_name ? (
                      <SelectItem key={actionId} value={actionId}>
                        {client.action_name}
                      </SelectItem>
                    ) : null;
                  })}
                </SelectContent>
              </Select>

              <Select value={filterSector} onValueChange={setFilterSector}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Secteur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous secteurs</SelectItem>
                  {sectors.map(sectorId => (
                    <SelectItem key={sectorId} value={sectorId}>
                      {sectorId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={selectedClients.length === 0}>
                <Mail className="h-4 w-4 mr-2" />
                Envoyer email ({selectedClients.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Envoyer un email</DialogTitle>
                <DialogDescription>
                  Email sera envoyé à {selectedClients.length} contact(s)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sujet</label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Sujet de l'email"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    placeholder="Votre message..."
                    rows={8}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSendEmail} disabled={sendingEmail}>
                  {sendingEmail ? 'Envoi...' : 'Envoyer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isMobile ? (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="border rounded-lg p-3 bg-card cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/client/${client.id}?tab=info`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium">{client.first_name} {client.last_name}</div>
                    <div className="text-sm text-muted-foreground">{client.company}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectClient(client.id);
                    }}
                    className="h-4 w-4"
                  />
                </div>
                <div className="text-sm space-y-1">
                  <div>{client.phone || '-'}</div>
                  <div className="text-muted-foreground">{client.email}</div>
                </div>
                {client.linkedin_connected && (
                  <Badge variant="secondary" className="mt-2">
                    <Linkedin className="h-3 w-3 mr-1" />
                    LinkedIn
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <input
                    type="checkbox"
                    checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4"
                  />
                </TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Société</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[100px]">LinkedIn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow 
                  key={client.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/client/${client.id}?tab=info`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedClients.includes(client.id)}
                      onChange={() => handleSelectClient(client.id)}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{client.first_name}</TableCell>
                  <TableCell>{client.last_name}</TableCell>
                  <TableCell>{client.company}</TableCell>
                  <TableCell>{client.phone || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{client.email}</TableCell>
                  <TableCell>
                    {client.linkedin_connected ? (
                      <Badge variant="secondary" className="gap-1">
                        <Linkedin className="h-3 w-3" />
                        Connecté
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}