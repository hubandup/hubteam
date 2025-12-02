import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Trash2, Loader2, Database, AlertTriangle, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Papa from 'papaparse';

interface DataItem {
  id: string;
  display: string;
  metadata?: string;
}

type DataCategory = 'crm' | 'agencies' | 'projects' | 'users' | 'tasks' | 'invoices' | 'meeting_notes' | 'posts';

export function DataManagementTab() {
  const [crmData, setCrmData] = useState<DataItem[]>([]);
  const [agenciesData, setAgenciesData] = useState<DataItem[]>([]);
  const [projectsData, setProjectsData] = useState<DataItem[]>([]);
  const [usersData, setUsersData] = useState<DataItem[]>([]);
  const [tasksData, setTasksData] = useState<DataItem[]>([]);
  const [invoicesData, setInvoicesData] = useState<DataItem[]>([]);
  const [meetingNotesData, setMeetingNotesData] = useState<DataItem[]>([]);
  const [postsData, setPostsData] = useState<DataItem[]>([]);
  
  const [selectedCrm, setSelectedCrm] = useState<Set<string>>(new Set());
  const [selectedAgencies, setSelectedAgencies] = useState<Set<string>>(new Set());
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [selectedMeetingNotes, setSelectedMeetingNotes] = useState<Set<string>>(new Set());
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteCategory, setDeleteCategory] = useState<DataCategory | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch CRM clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, first_name, last_name, company, email')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      setCrmData(
        (clients || []).map(c => ({
          id: c.id,
          display: `${c.first_name} ${c.last_name} - ${c.company}`,
          metadata: c.email,
        }))
      );

      // Fetch Agencies
      const { data: agencies, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, name, contact_email')
        .order('created_at', { ascending: false });

      if (agenciesError) throw agenciesError;

      setAgenciesData(
        (agencies || []).map(a => ({
          id: a.id,
          display: a.name,
          metadata: a.contact_email || 'Pas d\'email',
        }))
      );

      // Fetch Projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, status')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      setProjectsData(
        (projects || []).map(p => ({
          id: p.id,
          display: p.name,
          metadata: `Statut: ${p.status}`,
        }))
      );

      // Fetch Users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      setUsersData(
        (profiles || []).map(p => ({
          id: p.id,
          display: `${p.first_name} ${p.last_name}`,
          metadata: p.email,
        }))
      );

      // Fetch Tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, status, priority')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      setTasksData(
        (tasks || []).map(t => ({
          id: t.id,
          display: t.title,
          metadata: `${t.status} - Priorité: ${t.priority}`,
        }))
      );

      // Fetch Invoices
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, status')
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      setInvoicesData(
        (invoices || []).map(i => ({
          id: i.id,
          display: i.invoice_number,
          metadata: `${i.amount}€ - ${i.status}`,
        }))
      );

      // Fetch Meeting Notes
      const { data: meetingNotes, error: meetingNotesError } = await supabase
        .from('meeting_notes')
        .select('id, title, meeting_date')
        .order('created_at', { ascending: false });

      if (meetingNotesError) throw meetingNotesError;

      setMeetingNotesData(
        (meetingNotes || []).map(m => ({
          id: m.id,
          display: m.title || 'Sans titre',
          metadata: m.meeting_date ? new Date(m.meeting_date).toLocaleDateString() : 'Pas de date',
        }))
      );

      // Fetch User Posts
      const { data: posts, error: postsError } = await supabase
        .from('user_posts')
        .select('id, content, created_at')
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      setPostsData(
        (posts || []).map(p => ({
          id: p.id,
          display: p.content.substring(0, 50) + (p.content.length > 50 ? '...' : ''),
          metadata: new Date(p.created_at).toLocaleDateString(),
        }))
      );
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (category: DataCategory, checked: boolean) => {
    const dataMap: Record<DataCategory, DataItem[]> = {
      crm: crmData,
      agencies: agenciesData,
      projects: projectsData,
      users: usersData,
      tasks: tasksData,
      invoices: invoicesData,
      meeting_notes: meetingNotesData,
      posts: postsData,
    };

    const setterMap: Record<DataCategory, React.Dispatch<React.SetStateAction<Set<string>>>> = {
      crm: setSelectedCrm,
      agencies: setSelectedAgencies,
      projects: setSelectedProjects,
      users: setSelectedUsers,
      tasks: setSelectedTasks,
      invoices: setSelectedInvoices,
      meeting_notes: setSelectedMeetingNotes,
      posts: setSelectedPosts,
    };

    if (checked) {
      setterMap[category](new Set(dataMap[category].map(item => item.id)));
    } else {
      setterMap[category](new Set());
    }
  };

  const handleSelectItem = (category: DataCategory, id: string, checked: boolean) => {
    const setterMap: Record<DataCategory, React.Dispatch<React.SetStateAction<Set<string>>>> = {
      crm: setSelectedCrm,
      agencies: setSelectedAgencies,
      projects: setSelectedProjects,
      users: setSelectedUsers,
      tasks: setSelectedTasks,
      invoices: setSelectedInvoices,
      meeting_notes: setSelectedMeetingNotes,
      posts: setSelectedPosts,
    };

    const selectedMap: Record<DataCategory, Set<string>> = {
      crm: selectedCrm,
      agencies: selectedAgencies,
      projects: selectedProjects,
      users: selectedUsers,
      tasks: selectedTasks,
      invoices: selectedInvoices,
      meeting_notes: selectedMeetingNotes,
      posts: selectedPosts,
    };

    const newSet = new Set(selectedMap[category]);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setterMap[category](newSet);
  };

  const confirmDelete = (category: DataCategory) => {
    setDeleteCategory(category);
    setDeleteDialogOpen(true);
  };

  const exportToCSV = async (category: DataCategory) => {
    try {
      let data: any[] = [];
      let filename = '';

      // Fetch full data with all fields
      if (category === 'crm') {
        const { data: clients, error } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = clients || [];
        filename = 'clients_crm';
      } else if (category === 'agencies') {
        const { data: agencies, error } = await supabase
          .from('agencies')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = agencies || [];
        filename = 'agences';
      } else if (category === 'projects') {
        const { data: projects, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = projects || [];
        filename = 'projets';
      } else if (category === 'users') {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = profiles || [];
        filename = 'utilisateurs';
      } else if (category === 'tasks') {
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = tasks || [];
        filename = 'taches';
      } else if (category === 'invoices') {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = invoices || [];
        filename = 'factures';
      } else if (category === 'meeting_notes') {
        const { data: meetingNotes, error } = await supabase
          .from('meeting_notes')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = meetingNotes || [];
        filename = 'comptes_rendus';
      } else if (category === 'posts') {
        const { data: posts, error } = await supabase
          .from('user_posts')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = posts || [];
        filename = 'publications';
      }

      if (data.length === 0) {
        toast.error('Aucune donnée à exporter');
        return;
      }

      // Convert to CSV
      const csv = Papa.unparse(data);
      
      // Create download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Export CSV réussi');
    } catch (error: any) {
      console.error('Error exporting to CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const exportToJSON = async (category: DataCategory) => {
    try {
      let data: any[] = [];
      let filename = '';

      // Fetch full data with all fields
      if (category === 'crm') {
        const { data: clients, error } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = clients || [];
        filename = 'clients_crm';
      } else if (category === 'agencies') {
        const { data: agencies, error } = await supabase
          .from('agencies')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = agencies || [];
        filename = 'agences';
      } else if (category === 'projects') {
        const { data: projects, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = projects || [];
        filename = 'projets';
      } else if (category === 'users') {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = profiles || [];
        filename = 'utilisateurs';
      } else if (category === 'tasks') {
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = tasks || [];
        filename = 'taches';
      } else if (category === 'invoices') {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = invoices || [];
        filename = 'factures';
      } else if (category === 'meeting_notes') {
        const { data: meetingNotes, error } = await supabase
          .from('meeting_notes')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = meetingNotes || [];
        filename = 'comptes_rendus';
      } else if (category === 'posts') {
        const { data: posts, error } = await supabase
          .from('user_posts')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = posts || [];
        filename = 'publications';
      }

      if (data.length === 0) {
        toast.error('Aucune donnée à exporter');
        return;
      }

      // Convert to JSON
      const json = JSON.stringify(data, null, 2);
      
      // Create download
      const blob = new Blob([json], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Export JSON réussi');
    } catch (error: any) {
      console.error('Error exporting to JSON:', error);
      toast.error('Erreur lors de l\'export JSON');
    }
  };

  const handleDelete = async () => {
    if (!deleteCategory) return;

    const selectedMap: Record<DataCategory, Set<string>> = {
      crm: selectedCrm,
      agencies: selectedAgencies,
      projects: selectedProjects,
      users: selectedUsers,
      tasks: selectedTasks,
      invoices: selectedInvoices,
      meeting_notes: selectedMeetingNotes,
      posts: selectedPosts,
    };

    const selected = selectedMap[deleteCategory];
    if (selected.size === 0) {
      toast.error('Aucun élément sélectionné');
      return;
    }

    setDeleting(true);
    try {
      const idsToDelete = Array.from(selected);
      
      // Handle deletion based on category
      if (deleteCategory === 'users') {
        // For users, use edge function with admin privileges
        const { data, error } = await supabase.functions.invoke('delete-users', {
          body: { userIds: idsToDelete },
        });

        if (error) throw error;
        
        if (data?.error) {
          throw new Error(data.error);
        }

        if (data?.results?.failed?.length > 0) {
          console.warn('Some users failed to delete:', data.results.failed);
          toast.warning(
            `${data.results.success.length} utilisateur(s) supprimé(s), ${data.results.failed.length} échec(s)`
          );
        } else {
          toast.success(data?.message || `${selected.size} utilisateur(s) supprimé(s) avec succès`);
        }
      } else if (deleteCategory === 'crm') {
        const { error } = await supabase
          .from('clients')
          .delete()
          .in('id', idsToDelete);
        if (error) throw error;
        toast.success(`${selected.size} client(s) supprimé(s) avec succès`);
      } else if (deleteCategory === 'agencies') {
        const { error } = await supabase
          .from('agencies')
          .delete()
          .in('id', idsToDelete);
        if (error) throw error;
        toast.success(`${selected.size} agence(s) supprimée(s) avec succès`);
      } else if (deleteCategory === 'projects') {
        const { error } = await supabase
          .from('projects')
          .delete()
          .in('id', idsToDelete);
        if (error) throw error;
        toast.success(`${selected.size} projet(s) supprimé(s) avec succès`);
      } else if (deleteCategory === 'tasks') {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .in('id', idsToDelete);
        if (error) throw error;
        toast.success(`${selected.size} tâche(s) supprimée(s) avec succès`);
      } else if (deleteCategory === 'invoices') {
        const { error } = await supabase
          .from('invoices')
          .delete()
          .in('id', idsToDelete);
        if (error) throw error;
        toast.success(`${selected.size} facture(s) supprimée(s) avec succès`);
      } else if (deleteCategory === 'meeting_notes') {
        const { error } = await supabase
          .from('meeting_notes')
          .delete()
          .in('id', idsToDelete);
        if (error) throw error;
        toast.success(`${selected.size} compte(s) rendu(s) supprimé(s) avec succès`);
      } else if (deleteCategory === 'posts') {
        const { error } = await supabase
          .from('user_posts')
          .delete()
          .in('id', idsToDelete);
        if (error) throw error;
        toast.success(`${selected.size} publication(s) supprimée(s) avec succès`);
      }
      
      // Clear selection and refresh data
      if (deleteCategory === 'crm') setSelectedCrm(new Set());
      if (deleteCategory === 'agencies') setSelectedAgencies(new Set());
      if (deleteCategory === 'projects') setSelectedProjects(new Set());
      if (deleteCategory === 'users') setSelectedUsers(new Set());
      if (deleteCategory === 'tasks') setSelectedTasks(new Set());
      if (deleteCategory === 'invoices') setSelectedInvoices(new Set());
      if (deleteCategory === 'meeting_notes') setSelectedMeetingNotes(new Set());
      if (deleteCategory === 'posts') setSelectedPosts(new Set());
      
      await fetchAllData();
    } catch (error: any) {
      console.error('Error deleting data:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteCategory(null);
    }
  };

  const renderDataTable = (
    data: DataItem[],
    category: DataCategory,
    selectedSet: Set<string>,
    title: string
  ) => {
    const selectedCount = selectedSet.size;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>
                {data.length} élément(s) • {selectedCount} sélectionné(s)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={data.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Exporter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => exportToCSV(category)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exporter en CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToJSON(category)}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Exporter en JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedCount > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => confirmDelete(category)}
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer ({selectedCount})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucune donnée disponible</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedCount === data.length && data.length > 0}
                        onCheckedChange={(checked) => handleSelectAll(category, checked as boolean)}
                      />
                    </TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSet.has(item.id)}
                          onCheckedChange={(checked) => handleSelectItem(category, item.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.display}</TableCell>
                      <TableCell className="text-muted-foreground">{item.metadata}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-warning/50 bg-warning/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Zone de danger
          </CardTitle>
          <CardDescription>
            Supprimez définitivement des données. Cette action est irréversible.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="crm" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="crm">CRM ({crmData.length})</TabsTrigger>
          <TabsTrigger value="agencies">Agences ({agenciesData.length})</TabsTrigger>
          <TabsTrigger value="projects">Projets ({projectsData.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tâches ({tasksData.length})</TabsTrigger>
          <TabsTrigger value="invoices">Factures ({invoicesData.length})</TabsTrigger>
          <TabsTrigger value="meeting_notes">CR ({meetingNotesData.length})</TabsTrigger>
          <TabsTrigger value="posts">Posts ({postsData.length})</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs ({usersData.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="crm" className="mt-6">
          {renderDataTable(crmData, 'crm', selectedCrm, 'Clients CRM')}
        </TabsContent>

        <TabsContent value="agencies" className="mt-6">
          {renderDataTable(agenciesData, 'agencies', selectedAgencies, 'Agences')}
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          {renderDataTable(projectsData, 'projects', selectedProjects, 'Projets')}
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          {renderDataTable(tasksData, 'tasks', selectedTasks, 'Tâches')}
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          {renderDataTable(invoicesData, 'invoices', selectedInvoices, 'Factures')}
        </TabsContent>

        <TabsContent value="meeting_notes" className="mt-6">
          {renderDataTable(meetingNotesData, 'meeting_notes', selectedMeetingNotes, 'Comptes rendus')}
        </TabsContent>

        <TabsContent value="posts" className="mt-6">
          {renderDataTable(postsData, 'posts', selectedPosts, 'Publications')}
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          {renderDataTable(usersData, 'users', selectedUsers, 'Utilisateurs')}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement{' '}
              {deleteCategory === 'crm' && selectedCrm.size}
              {deleteCategory === 'agencies' && selectedAgencies.size}
              {deleteCategory === 'projects' && selectedProjects.size}
              {deleteCategory === 'users' && selectedUsers.size}
              {deleteCategory === 'tasks' && selectedTasks.size}
              {deleteCategory === 'invoices' && selectedInvoices.size}
              {deleteCategory === 'meeting_notes' && selectedMeetingNotes.size}
              {deleteCategory === 'posts' && selectedPosts.size}
              {' '}élément(s) ?
              <br />
              <strong className="text-destructive">Cette action est irréversible.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer définitivement
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
