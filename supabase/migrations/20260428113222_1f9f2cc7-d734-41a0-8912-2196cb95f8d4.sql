
-- ============ Step 1: Table + RLS ============
CREATE TABLE IF NOT EXISTS public.expertises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE,
  categorie text NOT NULL DEFAULT 'Autre',
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_expertises_updated_at ON public.expertises;
CREATE TRIGGER update_expertises_updated_at
  BEFORE UPDATE ON public.expertises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.expertises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture expertises authentifiés" ON public.expertises;
CREATE POLICY "Lecture expertises authentifiés"
  ON public.expertises FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin gère expertises" ON public.expertises;
CREATE POLICY "Admin gère expertises"
  ON public.expertises FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Step 2: Seed 115 expertises ============
INSERT INTO public.expertises (nom, categorie) VALUES
('Branding', 'Communication'),
('Identité de marque', 'Communication'),
('Stratégie de marque', 'Communication'),
('Plateforme de discours', 'Communication'),
('Diagnostic & audit de communication', 'Communication'),
('Communication durable', 'Communication'),
('Communication pédagogique', 'Communication'),
('Communication Responsable', 'Communication'),
('Communication RSE', 'Communication'),
('Marque employeur / RSE', 'Communication'),
('Media training & accompagnement à la prise de parole', 'Communication'),
('Conférencier · célébrités', 'Communication'),
('Relations presse & relations médias', 'Relations Presse & Influence'),
('Influence', 'Relations Presse & Influence'),
('Influence & médias digitaux', 'Relations Presse & Influence'),
('Reporting & mesure des retombées', 'Relations Presse & Influence'),
('Conception et création graphique', 'Création & Production'),
('Création graphique', 'Création & Production'),
('Exécution graphique', 'Création & Production'),
('Easy Catalog', 'Création & Production'),
('Motion design, animation 3D, effets spéciaux', 'Création & Production'),
('Production audiovisuelle (photo & vidéo)', 'Création & Production'),
('Production vidéo classique & corporate film', 'Création & Production'),
('Contenu corporate, pub web/TV, brand content & film de marque', 'Création & Production'),
('Captation vidéo / diffusion / install audiovisuelle', 'Création & Production'),
('Captation drone / vue aérienne', 'Création & Production'),
('Live streaming / captation & diffusion d''événements', 'Création & Production'),
('Pré-production / post-production', 'Création & Production'),
('Vidéo "avancée" / technos immersives / nouvelles technologies', 'Création & Production'),
('Location de studio & matériel', 'Création & Production'),
('Conception rédaction et production de contenus variés', 'Digital & Web'),
('Content marketing & rédaction web spécialisée', 'Digital & Web'),
('Production de contenus avec talents', 'Digital & Web'),
('Production de contenus Instagram', 'Digital & Web'),
('production de contenus optimisés par IA', 'Digital & Web'),
('Social Media / Éditorial', 'Digital & Web'),
('Création de site vitrine : Headless / Webflow / Wordpress', 'Digital & Web'),
('Création de site complexe : Drupal / Headless / Symfony / Webflow / Wordpress', 'Digital & Web'),
('Création de site eCommerce B to B : Prestashop / Shopify / Sylius', 'Digital & Web'),
('Création de site eCommerce B to C : Prestashop / Shopify / Sylius', 'Digital & Web'),
('Usine à sites : Drupal / Webflow / Wordpress', 'Digital & Web'),
('Création d''Application Mobile : React Native', 'Digital & Web'),
('Création d''Application Tactiles + PWA : React/Vue', 'Digital & Web'),
('Développement sur mesure : Laravel / React/Vue / Symfony', 'Digital & Web'),
('Médiatisation : Display / Programmatique / SEA', 'Data & Performance'),
('Acquisition / performance media / campagnes média optimisées par IA', 'Data & Performance'),
('Publicité digitale', 'Data & Performance'),
('Social ads', 'Data & Performance'),
('GEO', 'Data & Performance'),
('Retargeting & personnalisation in-store', 'Data & Performance'),
('Drive-to-Store : commerce de proximité', 'Data & Performance'),
('Drive-to-store & attribution media -> magasin', 'Data & Performance'),
('Retail-media & monétisation de l''espace magasin', 'Data & Performance'),
('Tracking, monitoring, mesure de la performance', 'Data & Performance'),
('Analytics & tracking magasin', 'Data & Performance'),
('Mesure de performance des espaces événementiels', 'Data & Performance'),
('Accompagnement IA', 'IA & Innovation'),
('Conseil en stratégie IA appliquée au marketing', 'IA & Innovation'),
('Déploiement de solutions IA "packagées ou sur mesure" dans les process métiers.', 'IA & Innovation'),
('Études consommateurs & analyses de marché via IA', 'IA & Innovation'),
('Accompagnement projet salon', 'Événementiel'),
('Accueil & hospitalité événementielle ou permanente', 'Événementiel'),
('Externalisation "clé en main" de la gestion des équipes d''accueil', 'Événementiel'),
('Gestion de publics lors de manifestations', 'Événementiel'),
('Design & conception de stands', 'Événementiel'),
('Scénographie & mise en scène', 'Événementiel'),
('Scénographie & structure événementielle', 'Événementiel'),
('Design d''espaces / aménagement', 'Événementiel'),
('Bureau d''études & pré-production / modélisation 3D', 'Événementiel'),
('Direction technique & régie générale', 'Événementiel'),
('Installation & logistique événementielle', 'Événementiel'),
('Logistique & livraison événementielle', 'Événementiel'),
('Location & régie son, lumière, vidéo', 'Événementiel'),
('Production & spectacle vivant', 'Événementiel'),
('Traiteur & restauration événementielle', 'Événementiel'),
('Location d''arts de la table', 'Événementiel'),
('Location de matériel de cuisine et office pour traiteurs', 'Événementiel'),
('Location de mobilier', 'Événementiel'),
('Location de nappage et linge de table', 'Événementiel'),
('Fourniture d''accessoires de décoration', 'Événementiel'),
('Fabrication & menuiserie intégrée', 'Production & Fabrication'),
('Production & impression / fabrication & logistique', 'Production & Fabrication'),
('Production d''éléments "volume / 3D / décor"', 'Production & Fabrication'),
('Impression numérique grand format / print', 'Production & Fabrication'),
('Signalétique & Digital Signage / Affichage dynamique', 'Production & Fabrication'),
('Installations pérennes – intégration audiovisuelle', 'Production & Fabrication'),
('PLV', 'Production & Fabrication'),
('Objets personnalisés', 'Production & Fabrication'),
('Boutique d''objets personnalisés', 'Production & Fabrication'),
('Textile personnalisé', 'Production & Fabrication'),
('Fidélisation & CRM offline', 'Data & Performance'),
('Néofidélité (loyauté & récompense)', 'Data & Performance'),
('Éco-fidélité & engagement durable', 'Data & Performance'),
('Engagement collaborateur & "ambassadorship" interne', 'Data & Performance'),
('Promotion des ventes & animation commerciale', 'Data & Performance'),
('Gestion & diffusion de promotions automatisée', 'Data & Performance'),
('Diffusion automatique Multi-canal', 'Data & Performance'),
('Formation & sensibilisation', 'Formations'),
('Formation IA', 'Formations'),
('Coaching', 'Formations'),
('Atelier / Workshop', 'Formations'),
('Hub To You', 'Ressources déportées'),
('Renfort d''équipe communication ou marketing', 'Ressources déportées')
ON CONFLICT (nom) DO NOTHING;
