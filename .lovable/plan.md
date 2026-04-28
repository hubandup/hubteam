# Ajout d'une catégorie sur les expertises (agency_tags)

## 1. Migration base de données

Ajouter une colonne `categorie` à la table `agency_tags` :

```sql
ALTER TABLE public.agency_tags
ADD COLUMN categorie text NULL DEFAULT NULL;
```

- Type : `text`
- Nullable : oui
- Défaut : `NULL`
- Pas de contrainte CHECK (les 8 valeurs autorisées seront contrôlées côté UI via le dropdown — plus souple si on veut ajouter une catégorie plus tard).

Aucun trigger ni RLS supplémentaire — les politiques existantes (`Admins can manage agency_tags` / `Everyone can view agency_tags`) couvrent déjà la nouvelle colonne.

## 2. UI — `src/components/settings/AgencyTagsTab.tsx`

Modifications minimales, pas de refonte :

**Constante de catégories** (en tête du fichier) :
```
const CATEGORIES = [
  'Communication',
  'Événementiel',
  'Digital & Web',
  'Création & Production',
  'Data & Performance',
  'Formations',
  'Ressources déportées',
  'Autre',
] as const;
```

**Interface `AgencyTag`** : ajouter `categorie: string | null`.

**Ligne de chaque tag (mode lecture)** : entre le `Badge` et les boutons d'action, insérer un `<Select>` (composant shadcn `@/components/ui/select`) compact (~w-56) avec :
- les 8 options ci-dessus
- une option « — Aucune — » pour repasser à `null`
- `value={tag.categorie ?? ''}`
- `onValueChange` → mise à jour optimiste + `update({ categorie: value || null })` sur `agency_tags` filtré sur `tag.id`, puis toast + refetch léger (mise à jour du state local uniquement, pas besoin de refetch complet).

**Mode édition (nom + couleur)** : laisser le Select visible et fonctionnel à côté également (cohérent avec édition inline déjà existante).

**Formulaire « Ajouter un nouveau tag »** : ajouter un `<Select>` « Catégorie (optionnel) » avant le bouton Ajouter, et passer la valeur dans l'`insert`. Reset après ajout.

## 3. Hors scope (à confirmer si besoin plus tard)

- Pas de regroupement / filtre par catégorie dans la liste pour l'instant.
- Pas d'affichage de la catégorie sur les pages Agences / fiches agence.
- Pas de mise à jour des types Supabase à la main : ils seront régénérés automatiquement après la migration.

## Fichiers touchés

- migration SQL (nouvelle)
- `src/components/settings/AgencyTagsTab.tsx` (édité)
