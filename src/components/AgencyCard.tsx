import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, FolderCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Generate consistent color based on tag name
const getTagColor = (tag: string): string => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `${hue} 70% 50%`;
};

interface AgencyCardProps {
  agency: {
    id: string;
    name: string;
    contact_email?: string;
    contact_phone?: string;
    revenue: number;
    active: boolean;
    created_at: string;
    logo_url?: string;
    kdrive_drive_id?: number;
    kdrive_folder_id?: string;
    tags?: string[];
    main_contact_id?: string | null;
  };
  onClick: () => void;
}

export function AgencyCard({ agency, onClick }: AgencyCardProps) {
  const [mainContact, setMainContact] = useState<{
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  } | null>(null);

  useEffect(() => {
    const fetchMainContact = async () => {
      if (!agency.main_contact_id) {
        setMainContact(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('agency_contacts')
          .select('first_name, last_name, email, phone')
          .eq('id', agency.main_contact_id)
          .single();

        if (error) throw error;
        setMainContact(data);
      } catch (error) {
        console.error('Error fetching main contact:', error);
        setMainContact(null);
      }
    };

    fetchMainContact();
  }, [agency.main_contact_id]);

  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {agency.logo_url ? (
              <Avatar className="h-12 w-12 flex-shrink-0">
                <AvatarImage src={agency.logo_url} alt={agency.name} />
                <AvatarFallback>{agency.name.charAt(0)}</AvatarFallback>
              </Avatar>
            ) : (
              <Building2 className="h-12 w-12 text-primary flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg truncate flex items-center gap-2">
                {agency.name}
                {agency.kdrive_drive_id && agency.kdrive_folder_id && (
                  <FolderCheck className="h-4 w-4 text-success flex-shrink-0" />
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Agence partenaire
              </CardDescription>
            </div>
          </div>
          <Badge variant={agency.active ? 'default' : 'secondary'} className="flex-shrink-0">
            {agency.active ? 'Actif' : 'Inactif'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {agency.tags && agency.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {agency.tags.map((tag) => (
              <Badge
                key={tag}
                style={{
                  backgroundColor: `hsl(${getTagColor(tag)} / 0.15)`,
                  color: `hsl(${getTagColor(tag)})`,
                  borderColor: `hsl(${getTagColor(tag)} / 0.3)`,
                }}
                className="border"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {mainContact ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                {mainContact.first_name} {mainContact.last_name}
              </span>
            </div>
            {mainContact.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{mainContact.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate">{mainContact.email}</span>
            </div>
          </>
        ) : (
          <>
            {agency.contact_email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="truncate">{agency.contact_email}</span>
              </div>
            )}
            {agency.contact_phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{agency.contact_phone}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
