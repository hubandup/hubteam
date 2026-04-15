
-- Announcements table
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience_type TEXT NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all', 'role', 'users')),
  target_roles app_role[] DEFAULT NULL,
  target_user_ids UUID[] DEFAULT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ DEFAULT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can read active announcements
CREATE POLICY "Authenticated users can read announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can insert announcements"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Dismissals table
CREATE TABLE public.announcement_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own dismissals"
  ON public.announcement_dismissals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can dismiss announcements"
  ON public.announcement_dismissals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
