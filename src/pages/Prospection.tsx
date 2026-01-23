import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClients } from '@/hooks/useClients';
import { useProspects, useUpdateProspect, useCreateInteraction, PROSPECT_STATUSES } from '@/hooks/useProspects';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Mail, Linkedin, ArrowDownUp, BarChart3, Kanban, List, Plus, TrendingUp, Users, AlertTriangle, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery } from '@tanstack/react-query';
import { PageLoader } from '@/components/PageLoader';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { isToday, isPast, parseISO, addDays, format } from 'date-fns';

// CRM Components
import { PipelineStats } from '@/components/prospection/PipelineStats';
import { ProspectKanbanView } from '@/components/prospection/ProspectKanbanView';
import { ProspectTableView } from '@/components/prospection/ProspectTableView';
import { AddProspectDialog } from '@/components/prospection/AddProspectDialog';
import { AddInteractionDialog } from '@/components/prospection/AddInteractionDialog';
import { ScheduleFollowupDialog } from '@/components/prospection/ScheduleFollowupDialog';
import { CloseProspectDialog } from '@/components/prospection/CloseProspectDialog';
import { ProspectDetailDialog } from '@/components/prospection/ProspectDetailDialog';
import { EmailTemplateManager } from '@/components/prospection/EmailTemplateManager';
import { EmailImageUploader } from '@/components/prospection/EmailImageUploader';

export default function Prospection() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: prospects = [], isLoading: prospectsLoading } = useProspects();
  const updateProspect = useUpdateProspect();
  const createInteraction = useCreateInteraction();

  // Pipeline state
  const [pipelineView, setPipelineView] = useState<'table' | 'kanban'>('table');
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showFollowupsDue, setShowFollowupsDue] = useState(false);
  const [showThisWeek, setShowThisWeek] = useState(false);

  // Dialogs state
  const [addProspectOpen, setAddProspectOpen] = useState(false);
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [followupDialogOpen, setFollowupDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeDialogType, setCloseDialogType] = useState<'won' | 'lost'>('won');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Contacts & Campaigns state (existing)
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

  // Fetch email stats
  const { data: emailStats } = useQuery({
    queryKey: ['prospection-email-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospection_email_logs')
        .select('*');
      
      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());
      
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      return {
        total: data.length,
        sent: data.filter(log => log.status === 'sent').length,
        failed: data.filter(log => log.status === 'failed').length,
        today: data.filter(log => new Date(log.sent_at) >= today).length,
        thisWeek: data.filter(log => new Date(log.sent_at) >= thisWeekStart).length,
        thisMonth: data.filter(log => new Date(log.sent_at) >= thisMonthStart).length,
        recentEmails: data.slice(-10).reverse(),
      };
    },
  });

  // Filter prospects for pipeline
  const filteredProspects = useMemo(() => {
    let result = prospects;

    // Search filter
    if (pipelineSearch.trim()) {
      const query = pipelineSearch.toLowerCase();
      result = result.filter(p =>
        p.company_name?.toLowerCase().includes(query) ||
        p.contact_name?.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query) ||
        p.phone?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(p => p.status === filterStatus);
    }

    // Channel filter
    if (filterChannel !== 'all') {
      result = result.filter(p => p.channel === filterChannel);
    }

    // Priority filter
    if (filterPriority !== 'all') {
      result = result.filter(p => p.priority === filterPriority);
    }

    // Followups due filter
    if (showFollowupsDue) {
      result = result.filter(p => {
        if (!p.next_action_at || ['Gagné', 'Perdu'].includes(p.status)) return false;
        const actionDate = parseISO(p.next_action_at);
        return isToday(actionDate) || isPast(actionDate);
      });
    }

    // This week filter
    if (showThisWeek) {
      const weekEnd = addDays(new Date(), 7);
      result = result.filter(p => {
        if (!p.next_action_at) return false;
        const actionDate = parseISO(p.next_action_at);
        return actionDate <= weekEnd;
      });
    }

    return result;
  }, [prospects, pipelineSearch, filterStatus, filterChannel, filterPriority, showFollowupsDue, showThisWeek]);

  // Extract unique filters from clients
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
    
    if (filterSource !== 'all') {
      result = result.filter(client => client.source_id === filterSource);
    }
    
    if (filterAction !== 'all') {
      result = result.filter(client => client.status_id === filterAction);
    }
    
    if (filterSector !== 'all') {
      result = result.filter(client => client.activity_sector_id === filterSector);
    }
    
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

  // Check if a client has a linked prospect
  const getLinkedProspect = (clientEmail: string) => {
    return prospects.find(p => p.email === clientEmail);
  };

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

  // Pipeline quick actions
  const handleQuickAction = async (prospectId: string, action: 'contacted' | 'schedule' | 'interaction' | 'won' | 'lost') => {
    setSelectedProspectId(prospectId);
    
    switch (action) {
      case 'contacted':
        try {
          await updateProspect.mutateAsync({
            id: prospectId,
            last_contact_at: format(new Date(), 'yyyy-MM-dd'),
          });
          await createInteraction.mutateAsync({
            prospect_id: prospectId,
            action_type: 'Appel',
            happened_at: new Date().toISOString(),
            outcome: 'Contact effectué',
          });
          toast.success('Prospect marqué comme contacté');
        } catch (error) {
          toast.error('Erreur lors de la mise à jour');
        }
        break;
      case 'schedule':
        setFollowupDialogOpen(true);
        break;
      case 'interaction':
        setInteractionDialogOpen(true);
        break;
      case 'won':
        setCloseDialogType('won');
        setCloseDialogOpen(true);
        break;
      case 'lost':
        setCloseDialogType('lost');
        setCloseDialogOpen(true);
        break;
    }
  };

  const handleProspectClick = (prospectId: string) => {
    setSelectedProspectId(prospectId);
    setDetailDialogOpen(true);
  };

  const handleStatusChange = async (prospectId: string, newStatus: string) => {
    try {
      await updateProspect.mutateAsync({
        id: prospectId,
        status: newStatus as any,
      });
      await createInteraction.mutateAsync({
        prospect_id: prospectId,
        action_type: 'Autre',
        happened_at: new Date().toISOString(),
        outcome: `Statut changé vers: ${newStatus}`,
      });
    } catch (error) {
      toast.error('Erreur lors du changement de statut');
    }
  };

  const loading = clientsLoading || prospectsLoading;

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 pb-2 md:pb-4 bg-background">
        <h1 className="text-xl md:text-3xl font-bold text-foreground mb-0.5">Prospection</h1>
        <p className="text-muted-foreground text-xs md:text-base">Gérez votre pipeline commercial et vos campagnes</p>
      </div>

      <Tabs defaultValue="pipeline" className="flex-1 flex flex-col min-h-0">
        <TabsList className="flex-shrink-0 mb-4">
          <TabsTrigger value="pipeline">
            <TrendingUp className="h-4 w-4 mr-2" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <Mail className="h-4 w-4 mr-2" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-2" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        {/* PIPELINE TAB */}
        <TabsContent value="pipeline" className="flex-1 flex flex-col min-h-0 mt-0">
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            {/* Pipeline Stats */}
            <PipelineStats prospects={prospects} />

            {/* Filters */}
            <div className="flex-shrink-0 py-4 bg-background space-y-2">
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher entreprise, contact, email..."
                    value={pipelineSearch}
                    onChange={(e) => setPipelineSearch(e.target.value)}
                    className="pl-8 bg-white dark:bg-background h-10 text-sm"
                  />
                </div>

                {!isMobile && (
                  <>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous statuts</SelectItem>
                        {PROSPECT_STATUSES.map(status => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterChannel} onValueChange={setFilterChannel}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Canal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous canaux</SelectItem>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="Téléphone">Téléphone</SelectItem>
                        <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                        <SelectItem value="Bouche-à-oreille">Bouche-à-oreille</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterPriority} onValueChange={setFilterPriority}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Priorité" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes</SelectItem>
                        <SelectItem value="A">Priorité A</SelectItem>
                        <SelectItem value="B">Priorité B</SelectItem>
                        <SelectItem value="C">Priorité C</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="followups-due"
                        checked={showFollowupsDue}
                        onCheckedChange={setShowFollowupsDue}
                      />
                      <Label htmlFor="followups-due" className="text-sm cursor-pointer">
                        Relances dues
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="this-week"
                        checked={showThisWeek}
                        onCheckedChange={setShowThisWeek}
                      />
                      <Label htmlFor="this-week" className="text-sm cursor-pointer">
                        Cette semaine
                      </Label>
                    </div>
                  </>
                )}

                <div className="flex gap-2 ml-auto">
                  <div className="flex border rounded-md">
                    <Button
                      variant={pipelineView === 'table' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setPipelineView('table')}
                      className="rounded-r-none"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={pipelineView === 'kanban' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setPipelineView('kanban')}
                      className="rounded-l-none"
                    >
                      <Kanban className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button onClick={() => setAddProspectOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau prospect
                  </Button>
                </div>
              </div>
            </div>

            {/* Pipeline Content */}
            <div className="flex-1 overflow-auto">
              {pipelineView === 'table' ? (
                <ProspectTableView
                  prospects={filteredProspects}
                  onProspectClick={handleProspectClick}
                  onQuickAction={handleQuickAction}
                />
              ) : (
                <ProspectKanbanView
                  prospects={filteredProspects}
                  onProspectClick={handleProspectClick}
                  onStatusChange={handleStatusChange}
                />
              )}
            </div>
          </div>
        </TabsContent>

        {/* CONTACTS & CAMPAIGNS TAB */}
        <TabsContent value="contacts" className="flex-1 flex flex-col min-h-0 mt-0">
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
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
                  <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Envoyer un email</DialogTitle>
                      <DialogDescription>
                        Email sera envoyé à {selectedClients.length} contact(s).
                        Placeholders disponibles: {'{prénom}'}, {'{nom}'}, {'{société}'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* Template Manager */}
                      <EmailTemplateManager
                        currentSubject={emailSubject}
                        currentMessage={emailMessage}
                        onSelectTemplate={(subject, message) => {
                          setEmailSubject(subject);
                          setEmailMessage(message);
                        }}
                      />

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

                      {/* Image Uploader */}
                      <EmailImageUploader
                        onImageInsert={(imageUrl, imageHtml) => {
                          // Insert image HTML at the end of the message
                          setEmailMessage((prev) => prev + '\n\n[Image: ' + imageUrl + ']');
                        }}
                      />

                      <p className="text-xs text-muted-foreground">
                        💡 Les images seront affichées dans l'email. Format supporté: HTML.
                      </p>
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
                  {filteredClients.map((client) => {
                    const linkedProspect = getLinkedProspect(client.email);
                    return (
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
                        <div className="flex gap-2 mt-2">
                          {client.linkedin_connected && (
                            <Badge variant="secondary">
                              <Linkedin className="h-3 w-3 mr-1" />
                              LinkedIn
                            </Badge>
                          )}
                          {linkedProspect && (
                            <Badge variant="outline" className="text-xs">
                              Pipeline: {linkedProspect.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                      <TableHead className="w-[150px]">Pipeline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => {
                      const linkedProspect = getLinkedProspect(client.email);
                      return (
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
                          <TableCell>
                            {linkedProspect ? (
                              <Badge variant="outline" className="text-xs">
                                {linkedProspect.status}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* STATISTICS TAB */}
        <TabsContent value="stats" className="flex-1 overflow-auto mt-0">
          <div className="space-y-6">
            {/* Pipeline Stats Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Statistiques Pipeline</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>CA pondéré (actif)</CardDescription>
                    <CardTitle className="text-2xl">
                      {prospects
                        .filter(p => !['Gagné', 'Perdu'].includes(p.status))
                        .reduce((sum, p) => sum + (p.estimated_amount * p.probability), 0)
                        .toLocaleString('fr-FR')} €
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Taux de conversion</CardDescription>
                    <CardTitle className="text-2xl">
                      {prospects.length > 0
                        ? Math.round((prospects.filter(p => p.status === 'Gagné').length / prospects.length) * 100)
                        : 0}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {prospects.filter(p => p.status === 'Gagné').length} gagné(s) / {prospects.length} total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Relances dues</CardDescription>
                    <CardTitle className="text-2xl text-destructive">
                      {prospects.filter(p => {
                        if (!p.next_action_at || ['Gagné', 'Perdu'].includes(p.status)) return false;
                        const actionDate = parseISO(p.next_action_at);
                        return isToday(actionDate) || isPast(actionDate);
                      }).length}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {prospects.filter(p => {
                        if (!p.next_action_at || ['Gagné', 'Perdu'].includes(p.status)) return false;
                        const actionDate = parseISO(p.next_action_at);
                        const weekEnd = addDays(new Date(), 7);
                        return actionDate <= weekEnd && !isToday(actionDate) && !isPast(actionDate);
                      }).length} cette semaine
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Répartition par canal</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {['Email', 'Téléphone', 'LinkedIn', 'Bouche-à-oreille'].map(channel => {
                      const count = prospects.filter(p => p.channel === channel).length;
                      return (
                        <div key={channel} className="flex justify-between text-sm">
                          <span>{channel}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Email Stats Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Statistiques Emailing</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total envoyé</CardDescription>
                    <CardTitle className="text-3xl">{emailStats?.sent || 0}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {emailStats?.failed || 0} échec(s)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Cette semaine</CardDescription>
                    <CardTitle className="text-3xl">{emailStats?.thisWeek || 0}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {emailStats?.today || 0} aujourd'hui
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Ce mois</CardDescription>
                    <CardTitle className="text-3xl">{emailStats?.thisMonth || 0}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Emails envoyés
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Recent Emails Table */}
            <Card>
              <CardHeader>
                <CardTitle>Emails récents</CardTitle>
                <CardDescription>Les 10 derniers emails envoyés</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Destinataire</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Sujet</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailStats?.recentEmails?.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.recipient_name}</TableCell>
                        <TableCell className="text-muted-foreground">{log.recipient_email}</TableCell>
                        <TableCell>{log.subject}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(log.sent_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                            {log.status === 'sent' ? 'Envoyé' : 'Échec'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddProspectDialog
        open={addProspectOpen}
        onOpenChange={setAddProspectOpen}
      />

      {selectedProspectId && (
        <>
          <AddInteractionDialog
            open={interactionDialogOpen}
            onOpenChange={setInteractionDialogOpen}
            prospectId={selectedProspectId}
          />

          <ScheduleFollowupDialog
            open={followupDialogOpen}
            onOpenChange={setFollowupDialogOpen}
            prospectId={selectedProspectId}
          />

          <CloseProspectDialog
            open={closeDialogOpen}
            onOpenChange={setCloseDialogOpen}
            prospectId={selectedProspectId}
            type={closeDialogType}
          />

          <ProspectDetailDialog
            open={detailDialogOpen}
            onOpenChange={setDetailDialogOpen}
            prospect={prospects.find(p => p.id === selectedProspectId) || null}
          />
        </>
      )}
    </div>
  );
}
