import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

interface CreateChatRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
}

export function CreateChatRoomDialog({ open, onOpenChange, onSuccess }: CreateChatRoomDialogProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
      setSelectedUsers([]);
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, display_name, avatar_url')
        .neq('id', user!.id)
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Veuillez sélectionner au moins un destinataire');
      return;
    }

    setCreating(true);
    try {
      // Create room name from participants
      const participantNames = selectedUsers.map(u => 
        u.display_name || `${u.first_name} ${u.last_name}`
      ).join(', ');

      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({
          name: participantNames,
          type: 'direct',
          project_id: null,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add current user and selected users as members
      const members = [
        { room_id: room.id, user_id: user!.id },
        ...selectedUsers.map(u => ({ room_id: room.id, user_id: u.id }))
      ];

      const { error: memberError } = await supabase
        .from('chat_room_members')
        .insert(members);

      if (memberError) throw memberError;

      toast.success('Conversation créée avec succès');
      setSelectedUsers([]);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating chat room:', error);
      toast.error('Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const toggleUser = (selectedUser: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === selectedUser.id);
      if (isSelected) {
        return prev.filter(u => u.id !== selectedUser.id);
      } else {
        return [...prev, selectedUser];
      }
    });
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle conversation</DialogTitle>
          <DialogDescription>
            Sélectionnez un ou plusieurs destinataires pour démarrer une conversation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map(user => (
                <Badge key={user.id} variant="secondary" className="flex items-center gap-2 pr-1">
                  <span>{user.display_name || `${user.first_name} ${user.last_name}`}</span>
                  <button
                    onClick={() => removeUser(user.id)}
                    className="hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Destinataires</Label>
            <Command className="border rounded-lg">
              <CommandInput placeholder="Rechercher un utilisateur..." />
              <CommandList>
                <CommandEmpty>Aucun utilisateur trouvé</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {users.map(u => {
                    const isSelected = selectedUsers.some(selected => selected.id === u.id);
                    return (
                      <CommandItem
                        key={u.id}
                        onSelect={() => toggleUser(u)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div className={`h-4 w-4 border rounded flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : ''}`}>
                          {isSelected && (
                            <div className="h-2 w-2 bg-white rounded-sm" />
                          )}
                        </div>
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {u.first_name[0]}{u.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {u.display_name || `${u.first_name} ${u.last_name}`}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={creating || selectedUsers.length === 0}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              'Créer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
