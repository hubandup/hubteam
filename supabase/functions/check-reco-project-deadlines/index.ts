import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectStep {
  project_id: string;
  project_name: string;
  step_name: string;
  step_date: string;
}

const STEP_MAPPING = {
  date_brief: 'Brief',
  date_prise_en_main: 'Prise en main',
  date_concertation_agences: 'Concertation des agences',
  date_montage_reco: 'Montage de la reco',
  date_restitution: 'Restitution',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Checking for upcoming recommendation project deadlines...');

    // Get all projects with status "reco_in_progress"
    const { data: projects, error: projectsError } = await supabaseClient
      .from('projects')
      .select('id, name, date_brief, date_prise_en_main, date_concertation_agences, date_montage_reco, date_restitution')
      .eq('status', 'reco_in_progress');

    if (projectsError) throw projectsError;

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcomingSteps: ProjectStep[] = [];

    // Check each project for steps happening in the next 24 hours
    for (const project of projects || []) {
      for (const [dateField, stepName] of Object.entries(STEP_MAPPING)) {
        const stepDate = project[dateField as keyof typeof project];
        
        if (stepDate) {
          const date = new Date(stepDate as string);
          
          // Check if step is within next 24 hours
          if (date > now && date <= in24Hours) {
            // Check if notification already sent
            const { data: existingNotif } = await supabaseClient
              .from('project_step_notifications')
              .select('id')
              .eq('project_id', project.id)
              .eq('step_name', stepName)
              .single();

            if (!existingNotif) {
              upcomingSteps.push({
                project_id: project.id,
                project_name: project.name,
                step_name: stepName,
                step_date: stepDate as string,
              });
            }
          }
        }
      }
    }

    console.log(`Found ${upcomingSteps.length} upcoming steps to notify`);

    // Send notifications for each upcoming step - only to project team members
    for (const step of upcomingSteps) {
      // Get team members for this specific project
      const { data: teamMembers, error: teamError } = await supabaseClient
        .from('project_team_members')
        .select('member_id')
        .eq('project_id', step.project_id)
        .eq('member_type', 'profile');

      if (teamError) {
        console.error(`Error fetching team members for project ${step.project_id}:`, teamError);
        continue;
      }

      const projectUserIds = [...new Set(teamMembers?.map(tm => tm.member_id) || [])];

      if (projectUserIds.length === 0) {
        console.log(`No team members found for project ${step.project_id}, skipping notification`);
        continue;
      }

      console.log(`Found ${projectUserIds.length} team members for project ${step.project_name}`);

      const notificationMessage = `L'étape ${step.step_name} du projet ${step.project_name} est prévue demain.`;

      // Create notifications only for project team members
      const notifications = projectUserIds.map(userId => ({
        user_id: userId,
        type: 'deadline_approaching',
        title: 'Rappel : Étape de projet',
        message: notificationMessage,
        link: `/project/${step.project_id}`,
      }));

      const { error: notifError } = await supabaseClient
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Error creating notifications:', notifError);
        continue;
      }

      // Send email notifications via Brevo only to project team members
      for (const userId of projectUserIds) {
        try {
          const { error: emailError } = await supabaseClient.functions.invoke('send-notification-email', {
            body: {
              userId: userId,
              title: 'Rappel : Étape de projet',
              message: notificationMessage,
              link: `/project/${step.project_id}`,
            }
          });

          if (emailError) {
            console.error(`Error sending email to ${userId}:`, emailError);
          } else {
            console.log(`Email sent to ${userId}`);
          }
        } catch (emailErr) {
          console.error('Failed to invoke email function:', emailErr);
        }
      }

      // Mark notification as sent
      const { error: trackError } = await supabaseClient
        .from('project_step_notifications')
        .insert({
          project_id: step.project_id,
          step_name: step.step_name,
        });

      if (trackError) {
        console.error('Error tracking notification:', trackError);
      } else {
        console.log(`Sent ${projectUserIds.length} notifications for ${step.step_name} on project ${step.project_name}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${upcomingSteps.length} upcoming steps`,
        steps: upcomingSteps.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
