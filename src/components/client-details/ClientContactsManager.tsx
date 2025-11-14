import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Mail, UserPlus, UserCheck, Pencil } from 'lucide-react';
import { z } from 'zod';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  title?: string;
  email: string;
  is_user?: boolean;
}

interface ClientContactsManagerProps {
  clientId: string;
}

const contactSchema = z.object({
  first_name: z.string().trim().min(1, 'Le prénom est requis').max(100, 'Le prénom doit faire moins de 100 caractères'),
  last_name: z.string().trim().min(1, 'Le nom est requis').max(100, 'Le nom doit faire moins de 100 caractères'),
  title: z.string().trim().max(100, 'Le titre doit faire moins de 100 caractères').optional(),
  email: z.string().trim().email('Email invalide').max(255, 'L\'email doit faire moins de 255 caractères'),
});

export function ClientContactsManager({ clientId }: ClientContactsManagerProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [inviteRole, setInviteRole] = useState<string>('client');
  const [inviting, setInviting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    title: '',
    email: '',
  });

  const fetchContacts = async () => {
    try {
      const { data: contactsData, error } = await supabase
        .from('client_contacts' as any)
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check if each contact is already a user
      const contactsWithUserStatus = await Promise.all(
        (contactsData || []).map(async (contact: any) => {
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
  }, [clientId]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate input
      const validatedData = contactSchema.parse(formData);

      const { error } = await supabase.from('client_contacts' as any).insert({
        client_id: clientId,
        first_name: validatedData.first_name,
        last_name: validatedData.last_name,
        title: validatedData.title || null,
        email: validatedData.email,
      });

      if (error) throw error;

      toast.success('Contact ajouté avec succès');
      setFormData({ first_name: '', last_name: '', title: '', email: '' });
      setOpen(false);
      fetchContacts();
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          toast.error(err.message);
        });
      } else {
        console.error('Error adding contact:', error);
        toast.error("Erreur lors de l'ajout du contact");
      }
    }
  };

  const handleEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedContact) return;

    try {
      // Validate input
      const validatedData = contactSchema.parse(formData);

      const { error } = await supabase
        .from('client_contacts' as any)
        .update({
          first_name: validatedData.first_name,
          last_name: validatedData.last_name,
          title: validatedData.title || null,
          email: validatedData.email,
        })
        .eq('id', selectedContact.id);

      if (error) throw error;

      toast.success('Contact modifié avec succès');
      setEditDialogOpen(false);
      setSelectedContact(null);
      setFormData({ first_name: '', last_name: '', title: '', email: '' });
      fetchContacts();
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          toast.error(err.message);
        });
      } else {
        console.error('Error updating contact:', error);
        toast.error('Erreur lors de la modification du contact');
      }
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('client_contacts' as any)
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
      setInviteRole('client');
      fetchContacts();
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error("Erreur lors de l'envoi de l'invitation");
    } finally {
      setInviting(false);
    }
  };

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
                  Ajoutez les informations du contact du client
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
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Titre</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Directeur, Responsable marketing..."
                    maxLength={100}
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
                    maxLength={255}
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
                <div className="flex-1">
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
                  {contact.title && (
                    <p className="text-sm text-muted-foreground mb-1">{contact.title}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{contact.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedContact(contact);
                      setFormData({
                        first_name: contact.first_name,
                        last_name: contact.last_name,
                        title: contact.title || '',
                        email: contact.email,
                      });
                      setEditDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedContact(contact);
                      setInviteDialogOpen(true);
                    }}
                    disabled={contact.is_user}
                  >
                    <UserPlus className="h-4 w-4" />
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le contact</DialogTitle>
            <DialogDescription>
              Modifiez les informations du contact
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditContact} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_first_name">Prénom *</Label>
              <Input
                id="edit_first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_last_name">Nom *</Label>
              <Input
                id="edit_last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_title">Titre</Label>
              <Input
                id="edit_title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Directeur, Responsable marketing..."
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_email">Email *</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                maxLength={255}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedContact(null);
                  setFormData({ first_name: '', last_name: '', title: '', email: '' });
                }}
              >
                Annuler
              </Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="agency">Agence</SelectItem>
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
                  setInviteRole('client');
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
