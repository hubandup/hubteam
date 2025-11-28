import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Info, FolderKanban, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ResponsiveTabs, type TabItem } from '@/components/ui/responsive-tabs';
import { AgencyInfoTab } from '@/components/agency-details/AgencyInfoTab';
import { AgencyProjectsTab } from '@/components/agency-details/AgencyProjectsTab';
import { AgencyKDriveTab } from '@/components/agency-details/AgencyKDriveTab';

export default function AgencyDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projectsCount, setProjectsCount] = useState(0);

  useEffect(() => {
    if (id) {
      fetchAgencyDetails();
      fetchProjectsCount();
    }
  }, [id]);

  const fetchProjectsCount = async () => {
    if (!id) return;

    try {
      const { count, error } = await supabase
        .from('project_agencies')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', id);

      if (error) throw error;
      setProjectsCount(count || 0);
    } catch (error) {
      console.error('Error fetching projects count:', error);
    }
  };

  const fetchAgencyDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAgency(data);
    } catch (error) {
      console.error('Error fetching agency:', error);
      toast.error("Erreur lors du chargement de l'agence");
      navigate('/agencies');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agency) {
    return null;
  }

  const tabs: TabItem[] = [
    {
      value: 'info',
      label: 'Informations',
      icon: <Info className="h-4 w-4" />,
      content: <AgencyInfoTab agency={agency} onUpdate={fetchAgencyDetails} />
    },
    {
      value: 'projects',
      label: 'Projets',
      icon: <FolderKanban className="h-4 w-4" />,
      badge: projectsCount,
      content: <AgencyProjectsTab agencyId={agency.id} />
    },
    {
      value: 'kdrive',
      label: 'KDrive',
      icon: <FileText className="h-4 w-4" />,
      content: <AgencyKDriveTab agencyId={agency.id} agencyName={agency.name} />
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/agencies')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          {agency.logo_url && (
            <img
              src={agency.logo_url}
              alt={`${agency.name} logo`}
              className="w-16 h-16 rounded-lg object-cover"
            />
          )}
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{agency.name}</h1>
            <Badge variant={agency.active ? 'default' : 'secondary'}>
              {agency.active ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
        </div>
      </div>

      <ResponsiveTabs defaultValue="info" tabs={tabs} storageKey="agency-tabs" />
    </div>
  );
}
