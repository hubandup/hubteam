## Objectif

Créer une table de référence `expertises` administrable, seedée avec les 115 expertises réelles déjà présentes dans `agencies.tags`, exposer une vraie UI de gestion dans **Réglages → Expertises**, et brancher `EditAgencyDialog` (+ `AddAgencyDialog`) sur cette table via un multi-select groupé par catégorie. Rétrocompatibilité totale : `agencies.tags` reste une `text[]`, aucune FK.

Note : la table `agency_tags` (ajoutée la semaine dernière, vide) sera **abandonnée** au profit de `expertises`. Je la laisse en place pour ne rien casser, mais l'onglet Réglages pointera désormais sur `expertises`.

---

## Étape 1 — Migration SQL

Création de la table `expertises` + RLS.

```sql
CREATE TABLE IF NOT EXISTS public.expertises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE,
  categorie text NOT NULL DEFAULT 'Autre',
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_expertises_updated_at
  BEFORE UPDATE ON public.expertises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.expertises ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les utilisateurs authentifiés (la liste alimente AddAgencyDialog côté équipe + agences)
CREATE POLICY "Lecture expertises authentifiés"
  ON public.expertises FOR SELECT TO authenticated USING (true);

-- Écriture : admin uniquement (cohérent avec les autres tables Réglages)
CREATE POLICY "Admin gère expertises"
  ON public.expertises FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

> Note : j'utilise `has_role(..., 'admin')` au lieu de `auth.role() = 'authenticated'` proposé dans le brief — sinon n'importe quel client/agence pourrait modifier la liste, ce qui violerait les contraintes de rôles du projet.

## Étape 2 — Seed des 115 expertises

Migration séparée `INSERT ... ON CONFLICT (nom) DO NOTHING` avec les 115 entrées + catégorie pré-assignée fournies dans le brief (catégories étendues à 11 valeurs : Communication, Relations Presse & Influence, Création & Production, Digital & Web, Data & Performance, IA & Innovation, Événementiel, Production & Fabrication, Formations, Ressources déportées, Autre).

## Étape 3 — Refonte `Réglages → Expertises`

Remplacement complet du contenu de `src/components/settings/AgencyTagsTab.tsx` (le wiring `Settings.tsx` reste — l'onglet garde sa valeur `agency-tags` pour ne pas casser l'URL `/settings?tab=agency-tags`, mais le composant renommé en interne `ExpertisesTab` lit/écrit sur `expertises`).

Fonctionnalités :
1. **Tableau** colonnes : Nom · Catégorie · Actif · Actions
2. **Filtre catégorie** en haut : dropdown `Toutes` + 11 catégories, avec compteur dynamique `Événementiel (20)`
3. **Catégorie inline** : `<Select>` éditable, `UPDATE` Supabase optimiste + toast
4. **Toggle Actif** : `<Switch>` inline, optimiste + toast
5. **Ajouter** : bouton `+ Ajouter une expertise` → `<Dialog>` avec champs Nom (text) + Catégorie (select)
6. **Soft delete** : icône corbeille → `UPDATE actif=false` (pas de `DELETE`) ; les inactives restent visibles avec un style atténué et toggle pour réactiver
7. **Recherche** texte (bonus, peu coûteux) pour retrouver rapidement parmi 115+ entrées
8. Tri par catégorie puis nom alphabétique

Pas de couleur, pas de badge coloré (l'ancien `agency_tags.color` n'est pas repris — design `rounded-none`, no-shadow, accent jaune `#E8FF4C` sur les éléments actifs).

## Étape 4 — Multi-select dans EditAgencyDialog + AddAgencyDialog

Remplacer le champ tags actuel (saisie libre + lecture de `agency_tags`) par un composant `ExpertisesMultiSelect` :

- Charge `expertises` où `actif = true`
- Tri : catégorie alpha → nom alpha
- UI : `Popover` + `Command` (cmdk shadcn) avec `CommandGroup` par catégorie, checkbox par item
- Affichage des sélectionnés : badges supprimables au-dessus du trigger
- **Rétrocompat** : si une valeur de `agency.tags` n'existe pas dans `expertises` (ou est inactive), elle s'affiche quand même comme badge (style "legacy" gris) et reste sauvegardée
- Sauvegarde : `agencies.tags` reste un `text[]` de `expertises.nom` — **aucun breaking change** sur les autres composants qui lisent `agency.tags` (AgencyCard, ProspectDetailDialog, Webflow sync, etc.)

Même composant réutilisé dans `AddAgencyDialog`.

## Détails techniques

**Fichiers créés**
- `supabase/migrations/<ts>_create_expertises.sql` (table + RLS + trigger)
- `supabase/migrations/<ts>_seed_expertises.sql` (115 INSERTs)
- `src/hooks/useExpertises.tsx` (React Query : `useExpertises`, `useActiveExpertises`, mutations create/update/softDelete avec optimistic update)
- `src/components/common/ExpertisesMultiSelect.tsx` (multi-select groupé)

**Fichiers modifiés**
- `src/components/settings/AgencyTagsTab.tsx` → refonte complète sur `expertises`
- `src/components/EditAgencyDialog.tsx` → remplacement du bloc tags par `<ExpertisesMultiSelect>`
- `src/components/AddAgencyDialog.tsx` → idem
- `src/integrations/supabase/types.ts` → régénéré automatiquement

**Inchangé**
- `agencies.tags` (colonne `text[]`) — conservée telle quelle
- `agency_tags` (table actuelle, vide) — conservée pour ne rien casser, plus utilisée par l'UI
- Toute lecture aval de `agency.tags` (cards, Webflow, prospection) — format identique

**Sécurité / RLS**
- Lecture : `authenticated` (nécessaire pour que les agences voient la liste lors de l'édition de leur fiche)
- Écriture : `admin` uniquement via `has_role()`
- Pas de FK → flexibilité conservée comme demandé

**Performance**
- React Query cache `expertises` (staleTime 5 min) — partagé entre Settings et tous les dialogs agences
- Optimistic updates pour toutes les mutations (toggle actif, changement catégorie, ajout, soft-delete)
