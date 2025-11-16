import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Phone, Calendar, Building2, Briefcase, TrendingUp, ExternalLink, Clock, FolderKanban, CheckCircle2, PhoneCall, MessageSquare, CalendarDays, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EditClientDialog } from '@/components/EditClientDialog';
import { supabase } from '@/integrations/supabase/client';
import { ProtectedAction } from '@/components/ProtectedAction';
import { useIsMobile } from '@/hooks/use-mobile';
import { ClientContactsManager } from './ClientContactsManager';
import { KDriveFolderSelector } from './KDriveFolderSelector';
import { useUserRole } from '@/hooks/useUserRole';
import { useRoleConfig } from '@/hooks/useRoleConfig';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface ClientInfoTabProps {
  client: {
    id: string;
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    phone?: string;
    revenue: number;
    revenue_current_year?: number;
    last_contact?: string;
    active: boolean;
    created_at: string;
    updated_at: string;
    logo_url?: string;
    activity_sector_id?: string;
    status_id?: string;
    follow_up_date?: string;
    kanban_stage: string;
    kdrive_drive_id?: number;
    kdrive_folder_id?: string;
    kdrive_folder_path?: string;
    main_contact_id?: string;
  };
  onUpdate: () => void;
}

interface Project {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

interface Task {
  id: string;
  title: string;
  status: string;
  end_date: string | null;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  role?: string;
}

export function ClientInfoTab({ client, onUpdate }: ClientInfoTabProps) {
  const isMobile = useIsMobile();
  const { isAgency, isClient } = useUserRole();
  const { getRoleLabel } = useRoleConfig();
  const [activitySector, setActivitySector] = useState<any>(null);
  const [clientStatus, setClientStatus] = useState<any>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [nextTask, setNextTask] = useState<Task | null>(null);
  const [projectProgress, setProjectProgress] = useState<number>(0);
  const [totalProjects, setTotalProjects] = useState<number>(0);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    fetchSectorAndStatus();
    if (isClient) {
      fetchClientData();
    }
    if (!isClient && !isAgency) {
      fetchTeamMembers();
    }
    if (client.main_contact_id) {
      fetchMainContact();
    }
  }, [client, isClient, isAgency]);

  const fetchTeamMembers = async () => {
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['admin', 'team']);

    if (rolesData) {
      const userIds = rolesData.map(r => r.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url')
        .in('id', userIds);

      if (profilesData) {
        const members = profilesData.map(profile => ({
          ...profile,
          role: rolesData.find(r => r.user_id === profile.id)?.role || 'team'
        }));
        setTeamMembers(members);
      }
    }
  };

  const fetchMainContact = async () => {
    if (!client.main_contact_id) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, avatar_url')
      .eq('id', client.main_contact_id)
      .single();

    if (profileData) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profileData.id)
        .single();

      setTeamMember({
        ...profileData,
        role: roleData?.role || 'team'
      });
    }
  };

  const handleMainContactChange = async (userId: string) => {
    try {
      const contactId = userId === 'none' ? null : userId;
      const { error } = await supabase
        .from('clients')
        .update({ main_contact_id: contactId })
        .eq('id', client.id);

      if (error) throw error;

      toast.success('Interlocuteur Hub & Up mis à jour');
      onUpdate();
    } catch (error) {
      console.error('Error updating main contact:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const fetchSectorAndStatus = async () => {
    if (client.activity_sector_id) {
      const { data } = await supabase
        .from('activity_sectors')
        .select('*')
        .eq('id', client.activity_sector_id)
        .single();
      setActivitySector(data);
    }

    if (client.status_id) {
      const { data } = await supabase
        .from('client_statuses')
        .select('*')
        .eq('id', client.status_id)
        .single();
      setClientStatus(data);
    }
  };

  const fetchClientData = async () => {
    // Fetch active projects count
    const { data: projectsData, count } = await supabase
      .from('project_clients')
      .select('project_id, projects!inner(id, name, status, start_date, end_date)', { count: 'exact' })
      .eq('client_id', client.id)
      .eq('projects.archived', false);

    setTotalProjects(count || 0);

    // Find the most recent active project
    const activeProjects = projectsData?.filter(pc => pc.projects?.status === 'active') || [];
    if (activeProjects.length > 0) {
      const project = activeProjects[0].projects as Project;
      setCurrentProject(project);

      // Fetch next task for this project
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, status, end_date')
        .eq('project_id', project.id)
        .neq('status', 'completed')
        .order('end_date', { ascending: true, nullsFirst: false })
        .limit(1);

      if (tasksData && tasksData.length > 0) {
        setNextTask(tasksData[0]);
      }

      // Fetch team member (first profile type member)
      const { data: teamData } = await supabase
        .from('project_team_members')
        .select('member_id, member_type')
        .eq('project_id', project.id)
        .eq('member_type', 'profile')
        .limit(1);

      if (teamData && teamData.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url')
          .eq('id', teamData[0].member_id)
          .single();

        if (profileData) {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profileData.id)
            .single();

          setTeamMember({
            ...profileData,
            role: roleData?.role || 'team'
          });
        }
      }
    }

    // Calculate cumulative progress across ALL projects
    if (projectsData && projectsData.length > 0) {
      const projectIds = projectsData.map(pc => pc.project_id);
      
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('id, status, project_id')
        .in('project_id', projectIds);

      if (allTasks && allTasks.length > 0) {
        const completedTasks = allTasks.filter(t => t.status === 'done').length;
        const progress = Math.round((completedTasks / allTasks.length) * 100);
        setProjectProgress(progress);
      }
    }
  };

  return (
    <div className="space-y-6">
      {!isMobile && (
        <div className="flex justify-end gap-2">
          {client.kdrive_drive_id && client.kdrive_folder_id && !isAgency && !isClient && (
            <Button
              variant="outline"
              onClick={() => window.open(`https://kdrive.infomaniak.com/app/drive/${client.kdrive_drive_id}/files/${client.kdrive_folder_id}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ouvrir dans KDrive
            </Button>
          )}
          <ProtectedAction module="crm" action="update">
            <EditClientDialog client={client} onClientUpdated={onUpdate} />
          </ProtectedAction>
        </div>
      )}
      
      <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Entreprise</p>
              <p className="font-medium uppercase">{client.company}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{client.email}</p>
            </div>
          </div>

          {client.phone && (
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Téléphone</p>
                <p className="font-medium">{client.phone}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Client depuis</p>
              <p className="font-medium">
                {format(new Date(client.created_at), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>

          {activitySector && (
            <div className="flex items-start gap-3">
              <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Secteur d'activité</p>
                <Badge style={{ backgroundColor: activitySector.color, color: 'white' }}>
                  {activitySector.name}
                </Badge>
              </div>
            </div>
          )}

          {clientStatus && (
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Action</p>
                <Badge style={{ backgroundColor: clientStatus.color, color: 'white' }}>
                  {clientStatus.name}
                </Badge>
              </div>
            </div>
          )}

          {!isClient && !isAgency && (
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">Interlocuteur Hub & Up</p>
                <Select
                  value={client.main_contact_id || 'none'}
                  onValueChange={handleMainContactChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un interlocuteur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isMobile && (
          isClient ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mon suivi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Dernière mise à jour</p>
                    <p className="font-medium">
                      {format(new Date(client.updated_at), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>

                {currentProject && (
                  <>
                    <div className="flex items-start gap-3">
                      <FolderKanban className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Mon projet en cours</p>
                        <Link to={`/project/${currentProject.id}`} className="font-medium text-primary hover:underline">
                          {currentProject.name}
                        </Link>
                      </div>
                    </div>

                    {nextTask && (
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Prochaine étape</p>
                          <p className="font-medium">{nextTask.title}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Avancement</p>
                        <p className="text-sm font-medium">{projectProgress}%</p>
                      </div>
                      <Progress value={projectProgress} className="h-2" />
                    </div>
                  </>
                )}

                <div className="flex items-start gap-3 pt-2 border-t">
                  <FolderKanban className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tous mes projets</p>
                    <p className="text-lg font-bold text-primary">{totalProjects}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Statistiques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-success mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Chiffre d'affaires total</p>
                    <p className="text-2xl font-bold text-success">
                      {client.revenue.toLocaleString('fr-FR')} € HT
                    </p>
                    {client.revenue_current_year !== undefined && client.revenue_current_year !== null && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-sm text-muted-foreground">Année fiscale en cours</p>
                        <p className="text-lg font-semibold text-primary">
                          {client.revenue_current_year.toLocaleString('fr-FR')} € HT
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {client.last_contact && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Dernier contact</p>
                      <p className="font-medium">
                        {format(new Date(client.last_contact), 'dd MMMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Statut</span>
                  <Badge variant={client.active ? "default" : "secondary"}>
                    {client.active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {!isAgency && !isClient && (
        <>
          {client.kdrive_drive_id && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">KDrive</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Dossier kDrive connecté
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientContactsManager clientId={client.id} />
            </CardContent>
          </Card>
        </>
      )}

      {isClient && teamMember && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mon interlocuteur Hub & Up</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center text-center space-y-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={teamMember.avatar_url} alt={`${teamMember.first_name} ${teamMember.last_name}`} />
                <AvatarFallback className="text-lg">
                  {teamMember.first_name[0]}{teamMember.last_name[0]}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <p className="font-semibold text-lg">
                  {teamMember.first_name} {teamMember.last_name}
                </p>
                <Badge variant="secondary" className="mt-1">
                  {getRoleLabel(teamMember.role)}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:${teamMember.email}`}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Écrire
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://calendly.com" target="_blank" rel="noopener noreferrer">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Prendre rendez-vous
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
