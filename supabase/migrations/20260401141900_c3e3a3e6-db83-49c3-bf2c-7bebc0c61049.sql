
-- Table for agency attestations
CREATE TABLE public.agency_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  attestation_type TEXT NOT NULL CHECK (attestation_type IN ('urssaf', 'non_dependance', 'nda', 'kbis', 'rc_pro')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_attestations ENABLE ROW LEVEL SECURITY;

-- Admin can see all attestations
CREATE POLICY "Admins can manage all attestations"
  ON public.agency_attestations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Agency users can manage attestations for their own agency (matched by email in agency_contacts)
CREATE POLICY "Agency users can manage own attestations"
  ON public.agency_attestations
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'agency')
    AND EXISTS (
      SELECT 1 FROM public.agency_contacts ac
      JOIN public.profiles p ON p.email = ac.email
      WHERE ac.agency_id = agency_attestations.agency_id
        AND p.id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'agency')
    AND EXISTS (
      SELECT 1 FROM public.agency_contacts ac
      JOIN public.profiles p ON p.email = ac.email
      WHERE ac.agency_id = agency_attestations.agency_id
        AND p.id = auth.uid()
    )
  );

-- Storage bucket for attestation PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('agency-attestations', 'agency-attestations', false);

-- Storage RLS: Admin full access
CREATE POLICY "Admin storage access attestations"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'agency-attestations' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'agency-attestations' AND public.has_role(auth.uid(), 'admin'));

-- Storage RLS: Agency users access own folder
CREATE POLICY "Agency storage access own attestations"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'agency-attestations'
    AND public.has_role(auth.uid(), 'agency')
    AND EXISTS (
      SELECT 1 FROM public.agency_contacts ac
      JOIN public.profiles p ON p.email = ac.email
      WHERE ac.agency_id::text = (storage.foldername(name))[1]
        AND p.id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'agency-attestations'
    AND public.has_role(auth.uid(), 'agency')
    AND EXISTS (
      SELECT 1 FROM public.agency_contacts ac
      JOIN public.profiles p ON p.email = ac.email
      WHERE ac.agency_id::text = (storage.foldername(name))[1]
        AND p.id = auth.uid()
    )
  );
