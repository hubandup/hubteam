import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, User, Building2, Users, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AddTeamMemberDialog } from './AddTeamMemberDialog';
import { ProtectedAction } from '@/components/ProtectedAction';
import { useUserRole } from '@/hooks/useUserRole';

interface TeamMember {
  id: string;
  member_type: 'profile' | 'agency_contact' | 'client' | 'client_contact';
  member_id: string;
  member_name: string;
  member_email: string;
  member_company?: string;
}

interface ProjectTeamTabProps {
  projectId: string;
}

export function ProjectTeamTab({ projectId }: ProjectTeamTabProps) {
  const { isClient } = useUserRole();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [clientInfo, setClientInfo] = useState<{ id: string; company: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    fetchTeamData();
  }, [projectId]);

  const fetchTeamData = async () => {
    try {
      // Fetch client info
      const { data: projectClients, error: clientError } = await supabase
        .from('project_clients')
        .select('clients(id, company)')
        .eq('project_id', projectId)
        .single();

      if (!clientError && projectClients?.clients) {
        setClientInfo({
          id: projectClients.clients.id,
          company: projectClients.clients.company
        });
      }

      // Fetch team members
      const { data: members, error: membersError } = await supabase
        .from('project_team_members' as any)
        .select('*')
        .eq('project_id', projectId);

      if (membersError) throw membersError;

      // Fetch agencies linked to project
      const { data: projectAgencies, error: agenciesError } = await supabase
        .from('project_agencies')
        .select('agencies(*)')
        .eq('project_id', projectId);

      if (agenciesError) throw agenciesError;
      setAgencies(projectAgencies?.map(pa => pa.agencies) || []);

      // Enrich team members with their details
      const enrichedMembers = await Promise.all(
        (members || []).map(async (member: any) => {
          let memberData: any = {};
          
          if (member.member_type === 'profile') {
            const { data } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', member.member_id)
              .single();
            memberData = data;
          } else if (member.member_type === 'agency_contact') {
            const { data: contactData } = await supabase
              .from('agency_contacts')
              .select('first_name, last_name, email, agency_id')
              .eq('id', member.member_id)
              .single();
            
            if (contactData?.agency_id) {
              const { data: agencyData } = await supabase
                .from('agencies')
                .select('name')
                .eq('id', contactData.agency_id)
                .single();
              
              memberData = {
                ...contactData,
                agencies: agencyData
              };
            } else {
              memberData = contactData;
            }
          } else if (member.member_type === 'client_contact') {
            const { data } = await supabase
              .from('client_contacts' as any)
              .select('first_name, last_name, email, title')
              .eq('id', member.member_id)
              .single();
            memberData = data;
          } else if (member.member_type === 'client') {
            const { data } = await supabase
              .from('clients')
              .select('first_name, last_name, email, company')
              .eq('id', member.member_id)
              .single();
            memberData = data;
          }

          return {
            id: member.id,
            member_type: member.member_type,
            member_id: member.member_id,
            member_name: `${memberData?.first_name || ''} ${memberData?.last_name || ''}`,
            member_email: memberData?.email || '',
            member_company: memberData?.company || memberData?.agencies?.name || memberData?.title,
          };
        })
      );

      setTeamMembers(enrichedMembers);
    } catch (error) {
      console.error('Error fetching team:', error);
      toast.error('Erreur lors du chargement de l\'équipe');
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      // Get member details before deleting
      const { data: memberToDelete } = await supabase
        .from('project_team_members')
        .select('member_type, member_id')
        .eq('id', memberId)
        .single();

      // Delete the member
      const { error } = await supabase
        .from('project_team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      // If it was an agency contact, check if we should remove the agency
      if (memberToDelete?.member_type === 'agency_contact') {
        // Get the agency_id of this contact
        const { data: contactData } = await supabase
          .from('agency_contacts')
          .select('agency_id')
          .eq('id', memberToDelete.member_id)
          .single();

        if (contactData?.agency_id) {
          // Check if there are any remaining agency_contact members from this agency
          const { data: remainingMembers } = await supabase
            .from('project_team_members')
            .select('member_id')
            .eq('project_id', projectId)
            .eq('member_type', 'agency_contact');

          // Get all agency IDs of remaining members
          const remainingAgencyIds = await Promise.all(
            (remainingMembers || []).map(async (member: any) => {
              const { data } = await supabase
                .from('agency_contacts')
                .select('agency_id')
                .eq('id', member.member_id)
                .single();
              return data?.agency_id;
            })
          );

          // If the agency has no more members in this project, remove it from project_agencies
          if (!remainingAgencyIds.includes(contactData.agency_id)) {
            await supabase
              .from('project_agencies')
              .delete()
              .eq('project_id', projectId)
              .eq('agency_id', contactData.agency_id);
          }
        }
      }
      
      toast.success('Membre retiré de l\'équipe');
      fetchTeamData();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Erreur lors du retrait du membre');
    }
  };

  const getMemberIcon = (type: string) => {
    switch (type) {
      case 'profile':
        return <User className="h-4 w-4" />;
      case 'agency_contact':
        return <Building2 className="h-4 w-4" />;
      case 'client_contact':
        return <User className="h-4 w-4" />;
      case 'client':
        return <Users className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getMemberTypeLabel = (type: string) => {
    switch (type) {
      case 'profile':
        return 'Équipe';
      case 'agency_contact':
        return 'Agences';
      case 'client_contact':
        return 'Contacts clients';
      case 'client':
        return 'Clients';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {!isClient && clientInfo && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {clientInfo.company}
            </span>
          </div>
          <Link to={`/client/${clientInfo.id}`}>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Voir la fiche client
            </Button>
          </Link>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Agences partenaires</CardTitle>
        </CardHeader>
        <CardContent>
          {agencies.length > 0 ? (
            <div className="space-y-2">
              {agencies.map((agency) => (
                <div key={agency.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  {agency.logo_url && (
                    <img src={agency.logo_url} alt={agency.name} className="w-10 h-10 rounded object-cover" />
                  )}
                  <div>
                    <p className="font-medium">{agency.name}</p>
                    {agency.contact_email && (
                      <p className="text-sm text-muted-foreground">{agency.contact_email}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune agence associée
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Membres de l'équipe</CardTitle>
          <ProtectedAction module="projects" action="update">
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </ProtectedAction>
        </CardHeader>
        <CardContent>
          {teamMembers.length > 0 ? (
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getMemberIcon(member.member_type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{member.member_name}</p>
                        <Badge variant="secondary" className="text-xs">
                          {getMemberTypeLabel(member.member_type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{member.member_email}</p>
                      {member.member_company && (
                        <p className="text-xs text-muted-foreground">{member.member_company}</p>
                      )}
                    </div>
                  </div>
                  <ProtectedAction module="projects" action="update">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMember(member.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </ProtectedAction>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun membre dans l'équipe
            </p>
          )}
        </CardContent>
      </Card>

      <AddTeamMemberDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        projectId={projectId}
        onSuccess={fetchTeamData}
      />
    </div>
  );
}
