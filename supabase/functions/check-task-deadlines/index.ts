import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Checking for tasks with approaching deadlines...');

    // Get tasks with end_date within the next 24-48 hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        end_date,
        assigned_to,
        status,
        project_id,
        projects (
          name
        )
      `)
      .gte('end_date', tomorrow.toISOString().split('T')[0])
      .lte('end_date', dayAfterTomorrow.toISOString().split('T')[0])
      .neq('status', 'done')
      .not('assigned_to', 'is', null);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    console.log(`Found ${tasks?.length || 0} tasks with approaching deadlines`);

    if (tasks && tasks.length > 0) {
      const notificationPromises = tasks.map(async (task) => {
        try {
          const { error: notifError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: task.assigned_to,
              title: 'Deadline proche',
              body: `La tâche "${task.title}" arrive à échéance demain`,
              url: `/projects/${task.project_id}`
            }
          });

          if (notifError) {
            console.error(`Error sending notification for task ${task.id}:`, notifError);
          } else {
            console.log(`Notification sent for task: ${task.title}`);
          }
        } catch (error) {
          console.error(`Failed to send notification for task ${task.id}:`, error);
        }
      });

      await Promise.allSettled(notificationPromises);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasksChecked: tasks?.length || 0,
        message: `Checked ${tasks?.length || 0} tasks with approaching deadlines`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in check-task-deadlines:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
