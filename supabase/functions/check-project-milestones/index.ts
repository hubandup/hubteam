import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MilestoneCheck {
  project_id: string;
  project_name: string;
  milestone_type: string;
  milestone_label: string;
  due_at: string;
}

const MILESTONE_MAPPING: Record<string, string> = {
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

  // ── CRON_SECRET guard ──
  const cronSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization');
  const providedSecret = req.headers.get('x-cron-secret');
  if (cronSecret && providedSecret !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

    console.log('Checking for upcoming project milestones (Reco en Cours)...');

    // Get all projects with status "reco_in_progress"
    const { data: projects, error: projectsError } = await supabaseClient
      .from('projects')
      .select('id, name, date_brief, date_prise_en_main, date_concertation_agences, date_montage_reco, date_restitution')
      .eq('status', 'reco_in_progress')
      .eq('archived', false);

    if (projectsError) throw projectsError;

    if (!projects || projects.length === 0) {
      console.log('No reco_in_progress projects found');
      return new Response(
        JSON.stringify({ success: true, message: 'No projects to check', milestones: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcomingMilestones: MilestoneCheck[] = [];

    // Check each project for milestones happening in the next 24 hours
    for (const project of projects) {
      for (const [dateField, milestoneLabel] of Object.entries(MILESTONE_MAPPING)) {
        const milestoneDate = project[dateField as keyof typeof project];
        
        if (milestoneDate) {
          const date = new Date(milestoneDate as string);
          
          // Check if milestone is within next 24 hours and not already past
          if (date > now && date <= in24Hours) {
            // Check if notification already sent for this milestone
            const { data: existingNotif } = await supabaseClient
              .from('project_step_notifications')
              .select('id')
              .eq('project_id', project.id)
              .eq('step_name', milestoneLabel)
              .single();

            if (!existingNotif) {
              upcomingMilestones.push({
                project_id: project.id,
                project_name: project.name,
                milestone_type: dateField,
                milestone_label: milestoneLabel,
                due_at: milestoneDate as string,
              });
            }
          }
        }
      }
    }

    console.log(`Found ${upcomingMilestones.length} upcoming milestones to notify`);

    // Send notifications for each upcoming milestone - only to INTERNAL team members (not clients)
    for (const milestone of upcomingMilestones) {
      // Get team members for this project - ONLY profiles (internal users), NOT contacts
      const { data: teamMembers, error: teamError } = await supabaseClient
        .from('project_team_members')
        .select('member_id')
        .eq('project_id', milestone.project_id)
        .eq('member_type', 'profile');

      if (teamError) {
        console.error(`Error fetching team members for project ${milestone.project_id}:`, teamError);
        continue;
      }

      // Filter out client role users - they should NOT receive milestone notifications
      const internalUserIds: string[] = [];
      for (const tm of teamMembers || []) {
        const { data: userRole } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', tm.member_id)
          .single();

        // Only include non-client roles (admin, team, agency)
        if (userRole && userRole.role !== 'client') {
          internalUserIds.push(tm.member_id);
        }
      }

      const uniqueUserIds = [...new Set(internalUserIds)];

      if (uniqueUserIds.length === 0) {
        console.log(`No internal team members found for project ${milestone.project_id}, skipping`);
        continue;
      }

      console.log(`Found ${uniqueUserIds.length} internal team members for project ${milestone.project_name}`);

      const notificationMessage = `L'étape "${milestone.milestone_label}" du projet "${milestone.project_name}" est prévue demain.`;

      // Create notifications for internal team members
      const notifications = uniqueUserIds.map(userId => ({
        user_id: userId,
        type: 'deadline_approaching',
        title: 'Rappel : Jalon de projet',
        message: notificationMessage,
        link: `/project/${milestone.project_id}`,
        entity_type: 'project_milestone',
        entity_id: milestone.project_id,
      }));

      const { error: notifError } = await supabaseClient
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Error creating notifications:', notifError);
        continue;
      }

      // Mark milestone notification as sent
      const { error: trackError } = await supabaseClient
        .from('project_step_notifications')
        .insert({
          project_id: milestone.project_id,
          step_name: milestone.milestone_label,
        });

      if (trackError) {
        console.error('Error tracking notification:', trackError);
      } else {
        console.log(`Sent ${uniqueUserIds.length} notifications for ${milestone.milestone_label} on project ${milestone.project_name}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${upcomingMilestones.length} upcoming milestones`,
        milestones: upcomingMilestones.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
