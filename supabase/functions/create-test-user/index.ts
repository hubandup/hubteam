import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: "cbaulu@groupeseb.com",
    password: "1234567890",
    email_confirm: true,
    user_metadata: { first_name: "C", last_name: "Baulu", role: "client" },
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  
  // Assign client role
  await supabaseAdmin.from("user_roles").upsert({ user_id: data.user.id, role: "client" }, { onConflict: "user_id,role" });

  return new Response(JSON.stringify({ success: true, userId: data.user.id }), { status: 200 });
});
