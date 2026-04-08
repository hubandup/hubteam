
-- Table de synchronisation des fichiers
CREATE TABLE public.lagostina_files_sync (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'upload',
  last_synced TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_files_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lagostina_files_sync"
ON public.lagostina_files_sync FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team can manage lagostina_files_sync"
ON public.lagostina_files_sync FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view lagostina_files_sync"
ON public.lagostina_files_sync FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'client'));

-- Table scorecard
CREATE TABLE public.lagostina_scorecards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  priority TEXT NOT NULL,
  levier TEXT NOT NULL,
  kpi_name TEXT NOT NULL,
  week TEXT NOT NULL,
  month TEXT,
  actual NUMERIC,
  objective NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lagostina_scorecards"
ON public.lagostina_scorecards FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team can manage lagostina_scorecards"
ON public.lagostina_scorecards FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view lagostina_scorecards"
ON public.lagostina_scorecards FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'client'));

-- Table budget
CREATE TABLE public.lagostina_budget (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  levier TEXT NOT NULL,
  month TEXT NOT NULL,
  planned NUMERIC DEFAULT 0,
  engaged NUMERIC DEFAULT 0,
  invoiced NUMERIC DEFAULT 0,
  remaining NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lagostina_budget"
ON public.lagostina_budget FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team can manage lagostina_budget"
ON public.lagostina_budget FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view lagostina_budget"
ON public.lagostina_budget FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'client'));

-- Table statut catégoriel
CREATE TABLE public.lagostina_category_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  priority TEXT NOT NULL,
  priority_label TEXT NOT NULL,
  axis TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_category_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lagostina_category_status"
ON public.lagostina_category_status FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team can manage lagostina_category_status"
ON public.lagostina_category_status FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view lagostina_category_status"
ON public.lagostina_category_status FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'client'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('lagostina-files', 'lagostina-files', false);

CREATE POLICY "Admins can manage lagostina files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'lagostina-files' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'lagostina-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team can manage lagostina files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'lagostina-files' AND public.has_role(auth.uid(), 'team'))
WITH CHECK (bucket_id = 'lagostina-files' AND public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view lagostina files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lagostina-files' AND public.has_role(auth.uid(), 'client'));
