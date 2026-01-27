import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';
import { toast } from 'sonner';

export type NotificationType = 
  | 'project_assigned'
  | 'task_assigned'
  | 'task_comment'
  | 'mention'
  | 'message'
  | 'deadline_approaching'
  | 'reaction';

export type AppRole = 'admin' | 'team' | 'agency' | 'client';

export interface GlobalNotificationPreference {
  id: string;
  role: AppRole;
  notification_type: string;
  enabled: boolean;
  force_email: boolean;
}

export interface UserNotificationPreference {
  notification_type: string;
  push_enabled: boolean;
  email_enabled: boolean;
}

export const NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string; defaultEmail: boolean }[] = [
  { type: 'project_assigned', label: 'Projet attribué', description: 'Notification lors de l\'attribution d\'un projet', defaultEmail: true },
  { type: 'task_assigned', label: 'Tâche assignée', description: 'Notification lors de l\'assignation d\'une tâche', defaultEmail: true },
  { type: 'task_comment', label: 'Commentaire sur tâche', description: 'Nouveau commentaire sur une tâche', defaultEmail: false },
  { type: 'mention', label: 'Mention (@user)', description: 'Quelqu\'un vous mentionne dans un message', defaultEmail: false },
  { type: 'message', label: 'Nouveau message', description: 'Réception d\'un message direct ou dans un salon', defaultEmail: true },
  { type: 'deadline_approaching', label: 'Deadline approchante', description: 'Rappel 24h avant une deadline', defaultEmail: false },
  { type: 'reaction', label: 'Réaction à un post', description: 'Quelqu\'un réagit à votre publication', defaultEmail: false },
];

export const ROLES: { role: AppRole; label: string }[] = [
  { role: 'admin', label: 'Admin' },
  { role: 'team', label: 'Équipe' },
  { role: 'agency', label: 'Agence' },
  { role: 'client', label: 'Client' },
];

// Client role can only receive these notification types
export const CLIENT_ALLOWED_TYPES: NotificationType[] = ['project_assigned', 'message'];

export function useNotificationSettings() {
  const { user } = useAuth();
  const { role: userRole, isAdmin } = useUserRole();
  const [globalPreferences, setGlobalPreferences] = useState<GlobalNotificationPreference[]>([]);
  const [userPreferences, setUserPreferences] = useState<Record<string, { push: boolean; email: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      // Fetch global preferences
      const { data: globalData, error: globalError } = await supabase
        .from('notification_preferences_global')
        .select('*');

      if (globalError) throw globalError;
      setGlobalPreferences((globalData || []) as GlobalNotificationPreference[]);

      // Fetch user preferences from normalized table
      const { data: userData, error: userError } = await supabase
        .from('notification_user_preferences')
        .select('notification_type, push_enabled, email_enabled')
        .eq('user_id', user.id);

      if (userError) {
        throw userError;
      }

      if (userData && userData.length > 0) {
        const prefs: Record<string, { push: boolean; email: boolean }> = {};
        userData.forEach((pref) => {
          prefs[pref.notification_type] = {
            push: pref.push_enabled ?? true,
            email: pref.email_enabled ?? false,
          };
        });
        // Fill in defaults for any missing types
        NOTIFICATION_TYPES.forEach(({ type, defaultEmail }) => {
          if (!prefs[type]) {
            prefs[type] = { push: true, email: defaultEmail };
          }
        });
        setUserPreferences(prefs);
      } else {
        // Create default preferences
        const defaultPrefs: Record<string, { push: boolean; email: boolean }> = {};
        NOTIFICATION_TYPES.forEach(({ type, defaultEmail }) => {
          defaultPrefs[type] = { push: true, email: defaultEmail };
        });
        setUserPreferences(defaultPrefs);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      toast.error('Erreur lors du chargement des préférences');
    } finally {
      setLoading(false);
    }
  };

  const updateGlobalPreference = async (
    role: AppRole,
    notificationType: NotificationType,
    field: 'enabled' | 'force_email',
    value: boolean
  ) => {
    if (!isAdmin) {
      toast.error('Action non autorisée');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences_global')
        .update({ [field]: value })
        .eq('role', role)
        .eq('notification_type', notificationType);

      if (error) throw error;

      setGlobalPreferences(prev =>
        prev.map(p =>
          p.role === role && p.notification_type === notificationType
            ? { ...p, [field]: value }
            : p
        )
      );

      toast.success('Préférence globale mise à jour');
    } catch (error) {
      console.error('Error updating global preference:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const updateUserPreference = async (
    notificationType: NotificationType,
    channel: 'push' | 'email',
    value: boolean
  ) => {
    if (!user) return;

    // Check if this notification type is enabled globally for the user's role
    const globalPref = globalPreferences.find(
      p => p.role === (userRole as AppRole) && p.notification_type === notificationType
    );

    if (globalPref && !globalPref.enabled) {
      toast.error('Cette notification est désactivée par l\'administrateur');
      return;
    }

    // Client role restrictions
    if (userRole === 'client' && !CLIENT_ALLOWED_TYPES.includes(notificationType)) {
      toast.error('Ce type de notification n\'est pas disponible');
      return;
    }

    // Messages push cannot be fully disabled (safety net)
    if (notificationType === 'message' && channel === 'push' && !value) {
      toast.error('Les notifications push de messages ne peuvent pas être entièrement désactivées');
      return;
    }

    setSaving(true);
    try {
      const currentPrefs = userPreferences[notificationType] || { push: true, email: false };
      const newPushEnabled = channel === 'push' ? value : currentPrefs.push;
      const newEmailEnabled = channel === 'email' ? value : currentPrefs.email;

      // Upsert into normalized table
      const { error } = await supabase
        .from('notification_user_preferences')
        .upsert({
          user_id: user.id,
          notification_type: notificationType,
          push_enabled: newPushEnabled,
          email_enabled: newEmailEnabled,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,notification_type'
        });

      if (error) throw error;

      setUserPreferences(prev => ({
        ...prev,
        [notificationType]: {
          push: newPushEnabled,
          email: newEmailEnabled,
        },
      }));

      toast.success('Préférence mise à jour');
    } catch (error) {
      console.error('Error updating user preference:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const getGlobalPreference = (role: AppRole, notificationType: NotificationType) => {
    return globalPreferences.find(
      p => p.role === role && p.notification_type === notificationType
    );
  };

  const isNotificationEnabled = (notificationType: NotificationType): boolean => {
    if (!userRole) return true;
    
    // Client role restrictions
    if (userRole === 'client' && !CLIENT_ALLOWED_TYPES.includes(notificationType)) {
      return false;
    }
    
    const globalPref = getGlobalPreference(userRole as AppRole, notificationType);
    return globalPref?.enabled ?? true;
  };

  const isForceEmail = (notificationType: NotificationType): boolean => {
    if (!userRole) return false;
    
    // Client role always gets forced email for allowed types
    if (userRole === 'client' && CLIENT_ALLOWED_TYPES.includes(notificationType)) {
      return true;
    }
    
    const globalPref = getGlobalPreference(userRole as AppRole, notificationType);
    return globalPref?.force_email ?? false;
  };

  return {
    globalPreferences,
    userPreferences,
    loading,
    saving,
    updateGlobalPreference,
    updateUserPreference,
    getGlobalPreference,
    isNotificationEnabled,
    isForceEmail,
    refetch: fetchPreferences,
    userRole: userRole as AppRole | null,
    isAdmin,
  };
}
