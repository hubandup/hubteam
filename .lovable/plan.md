

# Integration des posts LinkedIn Hub & Up dans le Feed via RSS

## Approche

Utiliser un service de conversion RSS (comme RSS.app, Nitter, ou un équivalent) pour transformer le flux LinkedIn de la page Hub & Up en flux RSS, puis créer une edge function qui parse ce RSS et le stocke en base pour l'afficher dans le Feed.

## Architecture

L'intégration se décompose en 3 parties :

1. **Table `linkedin_posts`** - Stockage des posts LinkedIn récupérés
2. **Edge function `fetch-linkedin-rss`** - Récupération et parsing du flux RSS
3. **Hook `useLinkedInPosts`** + composant `LinkedInPostItem`** - Affichage dans le Feed

## Etapes d'implementation

### 1. Configuration du flux RSS

Avant de coder, vous devrez obtenir une URL RSS de votre page LinkedIn Hub & Up via un service comme :
- **rss.app** (payant, fiable)
- **RSS Bridge** (gratuit, auto-hébergé)
- **PhantomBuster** (payant, populaire)

L'URL RSS sera stockée comme secret (`LINKEDIN_RSS_URL`).

### 2. Table `linkedin_posts`

Nouvelle table pour stocker les posts LinkedIn avec dédoublication :

- `id` (uuid, PK)
- `linkedin_id` (text, unique) -- identifiant du post dans le RSS (guid)
- `title` (text)
- `content` (text)
- `link` (text) -- lien vers le post LinkedIn
- `image_url` (text, nullable)
- `published_at` (timestamptz)
- `created_at` (timestamptz, default now)

RLS : lecture seule pour les utilisateurs authentifiés.

### 3. Edge function `fetch-linkedin-rss`

- Lit le secret `LINKEDIN_RSS_URL`
- Fetch le flux RSS
- Parse le XML pour extraire les posts (titre, contenu, lien, image, date)
- Upsert dans `linkedin_posts` (dédoublication par `linkedin_id`)
- Peut être appelée manuellement ou via un cron (ex: toutes les heures)

### 4. Hook `useLinkedInPosts`

- Query React Query sur la table `linkedin_posts`
- Souscription realtime pour actualisation automatique

### 5. Composant `LinkedInPostItem`

- Carte dédiée avec :
  - Logo LinkedIn + badge "LinkedIn"
  - Contenu du post (texte tronqué + "Voir plus")
  - Image si disponible
  - Lien "Voir sur LinkedIn" qui ouvre dans un nouvel onglet
  - Date de publication

### 6. Integration dans Feed.tsx

- Fusion des 3 sources (posts utilisateurs, activités système, posts LinkedIn) triées par date
- Nouveau type `'linkedin'` dans le merge sort existant

## Details techniques

- **Parsing RSS** : utilisation de regex ou DOMParser côté Deno pour extraire les items du XML
- **Dédoublication** : `ON CONFLICT (linkedin_id) DO UPDATE` pour éviter les doublons
- **Cache** : les posts sont stockés en base, pas de fetch RSS côté client
- **Cron** : possibilité d'appeler l'edge function via un cron Supabase (pg_cron) toutes les heures
- **Fallback** : si le flux RSS est indisponible, les posts existants restent affichés depuis la base

