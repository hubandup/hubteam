import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, Mail, UserPlus, UserCheck, Star, Phone, MessageSquare } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useUserRole } from '@/hooks/useUserRole';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_user?: boolean;
}

interface AgencyContactsManagerProps {
  agencyId: string;
  mainContactId?: string | null;
}

export function AgencyContactsManager({ agencyId, mainContactId }: AgencyContactsManagerProps) {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const isClient = role === 'client';
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [inviteRole, setInviteRole] = useState<string>('agency');
  const [inviting, setInviting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  const fetchContacts = async () => {
    try {
      const { data: contactsData, error } = await supabase
        .from('agency_contacts')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check if each contact is already a user
      const contactsWithUserStatus = await Promise.all(
        (contactsData || []).map(async (contact) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', contact.email)
            .maybeSingle();

          return {
            ...contact,
            is_user: !!profileData,
          };
        })
      );

      setContacts(contactsWithUserStatus);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Erreur lors du chargement des contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();

    // Écouter les changements pour rafraîchir quand le contact principal change
    const channel = supabase
      .channel('agency-contact-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agency_contacts',
          filter: `agency_id=eq.${agencyId}`,
        },
        () => {
          fetchContacts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agencies',
          filter: `id=eq.${agencyId}`,
        },
        () => {
          fetchContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase.from('agency_contacts').insert({
        agency_id: agencyId,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
      });

      if (error) throw error;

      toast.success('Contact ajouté avec succès');
      setFormData({ first_name: '', last_name: '', email: '', phone: '' });
      setOpen(false);
      fetchContacts();
    } catch (error) {
      console.error('Error adding contact:', error);
      toast.error("Erreur lors de l'ajout du contact");
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('agency_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      toast.success('Contact supprimé avec succès');
      fetchContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Erreur lors de la suppression du contact');
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setEditFormData({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone || '',
    });
    setEditDialogOpen(true);
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    
    try {
      const { error } = await supabase
        .from('agency_contacts')
        .update({
          first_name: editFormData.first_name,
          last_name: editFormData.last_name,
          email: editFormData.email,
          phone: editFormData.phone,
        })
        .eq('id', editingContact.id);

      if (error) throw error;

      toast.success('Contact modifié avec succès');
      setEditDialogOpen(false);
      setEditingContact(null);
      setEditFormData({ first_name: '', last_name: '', email: '', phone: '' });
      fetchContacts();
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('Erreur lors de la modification du contact');
    }
  };

  const handleSetMainContact = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('agencies')
        .update({ main_contact_id: contactId })
        .eq('id', agencyId);

      if (error) throw error;

      toast.success('Contact principal défini avec succès');
      fetchContacts();
    } catch (error) {
      console.error('Error setting main contact:', error);
      toast.error('Erreur lors de la définition du contact principal');
    }
  };

  const handleInviteContact = async () => {
    if (!selectedContact) return;

    setInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté pour inviter un utilisateur');
        return;
      }

      const { error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: selectedContact.email,
          role: inviteRole,
          firstName: selectedContact.first_name,
          lastName: selectedContact.last_name,
        },
      });

      if (error) throw error;

      toast.success('Invitation envoyée avec succès');
      setInviteDialogOpen(false);
      setSelectedContact(null);
      setInviteRole('agency');
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error("Erreur lors de l'envoi de l'invitation");
    } finally {
      setInviting(false);
    }
  };

  // Simplified view for clients
  if (isClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun contact pour le moment</p>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {mainContactId === contact.id && (
                      <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                    )}
                    <p className="font-medium">
                      {contact.first_name} {contact.last_name}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/messages')}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Envoyer un message
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full view for admin/team/agency
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Contacts</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un contact</DialogTitle>
                <DialogDescription>
                  Ajoutez les informations du contact de l'agence
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddContact} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit">Ajouter</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun contact pour le moment</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-start justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetMainContact(contact.id)}
                    className="p-1 h-8 w-8"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        mainContactId === contact.id
                          ? 'fill-yellow-500 text-yellow-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </Button>
                  <div 
                    className="flex-1 cursor-pointer hover:bg-accent/50 rounded-md p-1 transition-colors"
                    onClick={() => handleEditContact(contact)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">
                        {contact.first_name} {contact.last_name}
                      </p>
                      {contact.is_user && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          Utilisateur
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{contact.email}</span>
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedContact(contact);
                      setInviteDialogOpen(true);
                    }}
                    disabled={contact.is_user}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Inviter
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteContact(contact.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog d'édition */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le contact</DialogTitle>
            <DialogDescription>
              Modifiez les informations du contact de l'agence
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateContact} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_first_name">Prénom *</Label>
              <Input
                id="edit_first_name"
                value={editFormData.first_name}
                onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_last_name">Nom *</Label>
              <Input
                id="edit_last_name"
                value={editFormData.last_name}
                onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_email">Email *</Label>
              <Input
                id="edit_email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_phone">Téléphone</Label>
              <Input
                id="edit_phone"
                type="tel"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingContact(null);
                  setEditFormData({ first_name: '', last_name: '', email: '', phone: '' });
                }}
              >
                Annuler
              </Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog d'invitation */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inviter {selectedContact?.first_name} {selectedContact?.last_name}</DialogTitle>
            <DialogDescription>
              Envoyer une invitation pour rejoindre la plateforme
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={selectedContact?.email || ''}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Rôle</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agence</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="team">Équipe</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setInviteDialogOpen(false);
                  setSelectedContact(null);
                  setInviteRole('agency');
                }}
                disabled={inviting}
              >
                Annuler
              </Button>
              <Button onClick={handleInviteContact} disabled={inviting}>
                {inviting ? 'Envoi...' : "Envoyer l'invitation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
