import { FolderCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EntityCard } from '@/components/layout';
import { STATUS_TOKENS } from '@/lib/design-tokens';

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

  const contactName = mainContact
    ? `${mainContact.first_name} ${mainContact.last_name}`.trim()
    : 'Agence partenaire';
  const email = mainContact?.email || agency.contact_email || undefined;
  const phone = mainContact?.phone || agency.contact_phone || undefined;

  const status = agency.active ? STATUS_TOKENS.active : STATUS_TOKENS.inactive;


  return (
    <EntityCard
      title={agency.name}
      subtitle={contactName}
      logoUrl={agency.logo_url}
      logoTitleAdornment={
        agency.kdrive_drive_id && agency.kdrive_folder_id ? (
          <FolderCheck className="h-3.5 w-3.5 text-success flex-shrink-0" />
        ) : undefined
      }
      status={status}
      email={email}
      phone={phone}
      onClick={onClick}
    />
  );
}
