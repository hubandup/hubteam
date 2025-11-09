-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'team', 'client');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create agencies table
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  revenue DECIMAL(12,2) DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  revenue DECIMAL(12,2) DEFAULT 0,
  last_contact TIMESTAMP WITH TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create project_clients junction table (many-to-many)
CREATE TABLE public.project_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, client_id)
);

ALTER TABLE public.project_clients ENABLE ROW LEVEL SECURITY;

-- Create project_agencies junction table (many-to-many)
CREATE TABLE public.project_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, agency_id)
);

ALTER TABLE public.project_agencies ENABLE ROW LEVEL SECURITY;

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create task_agencies junction table (many-to-many)
CREATE TABLE public.task_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, agency_id)
);

ALTER TABLE public.task_agencies ENABLE ROW LEVEL SECURITY;

-- Create task_comments table
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Create quotes table (devis)
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('won', 'pending', 'lost')),
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Create invoices table (factures)
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'overdue')),
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create meeting_notes table (comptes rendus)
CREATE TABLE public.meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.agencies FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.task_comments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meeting_notes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create profile on user signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'team'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for agencies
CREATE POLICY "Admins can manage agencies" ON public.agencies FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can view agencies" ON public.agencies FOR SELECT USING (public.has_role(auth.uid(), 'team'));

-- RLS Policies for clients
CREATE POLICY "Admins can manage clients" ON public.clients FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can manage clients" ON public.clients FOR ALL USING (public.has_role(auth.uid(), 'team'));

-- RLS Policies for projects
CREATE POLICY "Admins can manage projects" ON public.projects FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can manage projects" ON public.projects FOR ALL USING (public.has_role(auth.uid(), 'team'));
CREATE POLICY "Clients can view their projects" ON public.projects FOR SELECT USING (
  public.has_role(auth.uid(), 'client') AND 
  EXISTS (
    SELECT 1 FROM public.project_clients pc
    JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.project_id = projects.id AND c.email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);

-- RLS Policies for project_clients
CREATE POLICY "Admins can manage project_clients" ON public.project_clients FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can manage project_clients" ON public.project_clients FOR ALL USING (public.has_role(auth.uid(), 'team'));

-- RLS Policies for project_agencies
CREATE POLICY "Admins can manage project_agencies" ON public.project_agencies FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can view project_agencies" ON public.project_agencies FOR SELECT USING (public.has_role(auth.uid(), 'team'));

-- RLS Policies for tasks
CREATE POLICY "Admins can manage tasks" ON public.tasks FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can manage tasks" ON public.tasks FOR ALL USING (public.has_role(auth.uid(), 'team'));
CREATE POLICY "Clients can view their tasks" ON public.tasks FOR SELECT USING (
  public.has_role(auth.uid(), 'client') AND 
  EXISTS (
    SELECT 1 FROM public.project_clients pc
    JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.project_id = tasks.project_id AND c.email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);

-- RLS Policies for task_agencies
CREATE POLICY "Admins can manage task_agencies" ON public.task_agencies FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can view task_agencies" ON public.task_agencies FOR SELECT USING (public.has_role(auth.uid(), 'team'));

-- RLS Policies for task_comments
CREATE POLICY "Users can view task comments" ON public.task_comments FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'team') OR
  (public.has_role(auth.uid(), 'client') AND 
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_clients pc ON pc.project_id = t.project_id
      JOIN public.clients c ON c.id = pc.client_id
      WHERE t.id = task_comments.task_id AND c.email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    )
  )
);
CREATE POLICY "Users can create task comments" ON public.task_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON public.task_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any comment" ON public.task_comments FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for quotes
CREATE POLICY "Admins can manage quotes" ON public.quotes FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can manage quotes" ON public.quotes FOR ALL USING (public.has_role(auth.uid(), 'team'));
CREATE POLICY "Clients can view their quotes" ON public.quotes FOR SELECT USING (
  public.has_role(auth.uid(), 'client') AND 
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = quotes.client_id AND c.email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);

-- RLS Policies for invoices
CREATE POLICY "Admins can manage invoices" ON public.invoices FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can manage invoices" ON public.invoices FOR ALL USING (public.has_role(auth.uid(), 'team'));
CREATE POLICY "Clients can view their invoices" ON public.invoices FOR SELECT USING (
  public.has_role(auth.uid(), 'client') AND 
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = invoices.client_id AND c.email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);

-- RLS Policies for meeting_notes
CREATE POLICY "Admins can manage meeting_notes" ON public.meeting_notes FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can manage meeting_notes" ON public.meeting_notes FOR ALL USING (public.has_role(auth.uid(), 'team'));