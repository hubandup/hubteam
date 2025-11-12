import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RoleBadge } from '@/components/common/RoleBadge';
import { Users, Edit, Loader2, Trash2, UserPlus, Mail, CheckCircle2, Circle, Wifi, WifiOff, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { EditUserRoleDialog } from './EditUserRoleDialog';
import { InviteUserDialog } from './InviteUserDialog';
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

interface UserWithRole {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  role: 'admin' | 'team' | 'client' | 'agency' | null;
  created_at: string;
  confirmed?: boolean;
  last_sign_in_at?: string | null;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Call edge function to get users with status
      const { data, error } = await supabase.functions.invoke('list-users-with-status');

      if (error) throw error;

      if (data?.users) {
        setUsers(data.users.sort((a: UserWithRole, b: UserWithRole) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des utilisateurs');
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: UserWithRole) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleDialogClose = () => {
    setEditDialogOpen(false);
    setSelectedUser(null);
    fetchUsers();
  };

  const handleDeleteUser = (user: UserWithRole) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleResendInvite = async (user: UserWithRole) => {
    if (!user.role) {
      toast.error('Impossible de renvoyer l\'invitation', {
        description: 'L\'utilisateur n\'a pas de rôle assigné'
      });
      return;
    }

    setResendingInvite(user.id);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { 
          email: user.email, 
          role: user.role 
        },
      });

      if (error) throw error;

      if (data?.error) {
        console.error('Edge function returned error:', data);
        
        // Handle specific error cases
        let errorTitle = data.error;
        let errorDescription = data.details || undefined;
        
        if (data.error?.includes('déjà existant') || data.error?.includes('already')) {
          errorTitle = "Utilisateur déjà actif";
          errorDescription = "Cet utilisateur a déjà complété son inscription. Vous ne pouvez pas renvoyer d'invitation.";
        }
        
        toast.error(errorTitle, {
          duration: 6000,
          description: errorDescription
        });
        return;
      }

      toast.success('Invitation renvoyée avec succès', {
        description: `Un nouvel email a été envoyé à ${user.email}`
      });
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      toast.error('Erreur lors du renvoi de l\'invitation', {
        description: error.message || 'Une erreur s\'est produite'
      });
    } finally {
      setResendingInvite(null);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Session non trouvée');
      }

      // Call edge function to delete user
      const { data, error } = await supabase.functions.invoke('delete-users', {
        body: { userIds: [userToDelete.id] },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.results?.failed?.length > 0) {
        throw new Error(data.results.failed[0].error);
      }

      toast.success('Utilisateur supprimé avec succès');
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Erreur lors de la suppression de l\'utilisateur');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isRecentlyActive = (lastSignIn: string | null | undefined) => {
    if (!lastSignIn) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(lastSignIn) > fiveMinutesAgo;
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestion des utilisateurs
              </CardTitle>
              <CardDescription>
                Gérez les rôles et permissions des utilisateurs de l'application
              </CardDescription>
            </div>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Inviter un utilisateur
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date d'inscription</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Aucun utilisateur trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.confirmed && (
                            <BadgeCheck className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                          <div className="relative">
                            <div className={`absolute -left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full ${
                              isRecentlyActive(user.last_sign_in_at) ? 'bg-green-500' : 'bg-muted-foreground/30'
                            }`} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {user.display_name || `${user.first_name} ${user.last_name}`}
                            </span>
                            <span className="text-sm text-muted-foreground">{user.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><RoleBadge role={user.role} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5" title={user.confirmed ? "Compte activé" : "En attente d'activation"}>
                            {user.confirmed ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="text-xs text-muted-foreground">Inscrit</span>
                              </>
                            ) : (
                              <>
                                <Circle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                <span className="text-xs text-muted-foreground">En attente</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5" title={isRecentlyActive(user.last_sign_in_at) ? "Connecté récemment" : "Hors ligne"}>
                            {isRecentlyActive(user.last_sign_in_at) ? (
                              <>
                                <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="text-xs text-muted-foreground">En ligne</span>
                              </>
                            ) : (
                              <>
                                <WifiOff className="h-4 w-4 text-muted-foreground/50" />
                                <span className="text-xs text-muted-foreground">Hors ligne</span>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(user.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!user.confirmed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendInvite(user)}
                              disabled={resendingInvite === user.id}
                              title="Renvoyer l'invitation"
                            >
                              {resendingInvite === user.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Mail className="h-4 w-4 mr-1" />
                              )}
                              Renvoyer
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Modifier
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Supprimer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <EditUserRoleDialog
          open={editDialogOpen}
          onOpenChange={handleDialogClose}
          user={selectedUser}
        />
      )}

      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={fetchUsers}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l'utilisateur "{userToDelete?.display_name || `${userToDelete?.first_name} ${userToDelete?.last_name}`}" ? 
              Cette action est irréversible et supprimera toutes les données associées à cet utilisateur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
