

# Integration LinkedIn API officielle dans le Feed

## Prérequis : Créer une App LinkedIn Developer

Avant de coder, vous devez créer une app sur **developer.linkedin.com** :

1. Aller sur [developer.linkedin.com](https://developer.linkedin.com/) et vous connecter
2. Cliquer sur **"Create App"**
3. Remplir les informations (nom, page LinkedIn Hub and Up, logo)
4. Une fois l'app créée, aller dans l'onglet **"Products"** et demander l'accès à **"Share on LinkedIn"** et **"Marketing APIs"**
5. Dans l'onglet **"Auth"**, noter le **Client ID** et **Client Secret**
6. Ajouter une URL de redirection OAuth (ex: `https://ytjxeypquqkrmbmhzfqi.supabase.co/functions/v1/linkedin-oauth-callback`)
7. Vérifier la page entreprise Hub and Up dans l'onglet **"Products" > "Verify"**

### Permissions nécessaires
- `r_organization_social` : lire les posts de la page organisation
- `rw_organization_admin` ou `r_organization_admin` : accéder aux infos de l'organisation

### Tokens OAuth
L'API LinkedIn utilise OAuth 2.0 avec des tokens qui expirent (60 jours). Il faudra :
- Un flow initial pour obtenir le token
- Un mécanisme de refresh (ou re-auth manuelle périodique)

## Architecture

```text
+-------------------+     +------------------------+     +------------------+
|  LinkedIn API     | --> | Edge Fn: fetch-linkedin | --> | linkedin_posts   |
|  /rest/posts      |     | (cron toutes les h.)   |     | (table existante)|
+-------------------+     +------------------------+     +------------------+
                                                                  |
                          +------------------------+               |
                          | Edge Fn: linkedin-     |               |
                          | oauth-callback         |               |
                          | (flow OAuth initial)   |               |
                          +------------------------+               |
                                                                   v
                          +------------------------+     +------------------+
                          | useLinkedInPosts hook   | <-- | Feed.tsx         |
                          +------------------------+     +------------------+
```

## Etapes d'implementation

### 1. Table pour stocker le token OAuth

Nouvelle table `linkedin_tokens` pour persister le token d'accès :
- `id` (uuid, PK)
- `access_token` (text, encrypted)
- `expires_at` (timestamptz)
- `refresh_token` (text, nullable)
- `created_at` (timestamptz)

RLS : aucun accès public (service_role uniquement).

### 2. Edge function `linkedin-oauth-callback`

Gere le callback OAuth LinkedIn :
- Recoit le code d'autorisation
- Echange contre un access_token via `https://www.linkedin.com/oauth/v2/accessToken`
- Stocke le token dans `linkedin_tokens`

### 3. Edge function `fetch-linkedin-posts` (remplace fetch-linkedin-rss)

- Lit le token depuis `linkedin_tokens`
- Appelle `GET https://api.linkedin.com/rest/posts?q=author&author=urn:li:organization:{ORG_ID}`
- Headers requis : `LinkedIn-Version: 202505`, `Authorization: Bearer {token}`
- Parse la reponse JSON et upsert dans `linkedin_posts` (table deja creee)
- Gere l'expiration du token (log warning si expire)

### 4. Secrets necessaires

3 secrets a configurer :
- `LINKEDIN_CLIENT_ID` : Client ID de l'app LinkedIn
- `LINKEDIN_CLIENT_SECRET` : Client Secret de l'app LinkedIn  
- `LINKEDIN_ORG_ID` : ID de l'organisation Hub and Up sur LinkedIn

### 5. Hook `useLinkedInPosts`

- Query React Query sur `linkedin_posts` (table existante)
- Tri par `published_at` descendant

### 6. Composant `LinkedInPostItem`

Carte dediee avec :
- Icone LinkedIn + badge "LinkedIn"
- Contenu du post (texte tronque + "Voir plus")
- Image si disponible
- Lien "Voir sur LinkedIn" ouvrant un nouvel onglet
- Date de publication

### 7. Integration dans Feed.tsx

Fusion des 3 sources (posts utilisateurs, activites systeme, posts LinkedIn) triees par date.

### 8. Cron job

Appel automatique de `fetch-linkedin-posts` toutes les heures via config.toml.

## Details techniques

- **API endpoint** : `GET https://api.linkedin.com/rest/posts?q=author&author=urn:li:organization:{ORG_ID}&count=20`
- **Version header** : `LinkedIn-Version: 202505`
- **Token expiration** : les tokens LinkedIn expirent apres 60 jours, un mecanisme d'alerte sera mis en place
- **Deduplication** : utilisation du champ `linkedin_id` (URN du post) avec `ON CONFLICT DO UPDATE`
- **Securite** : le token OAuth est stocke en base avec acces service_role uniquement, jamais expose cote client

## Ordre d'implementation

1. Configurer les secrets (Client ID, Client Secret, Org ID)
2. Creer la table `linkedin_tokens`
3. Creer l'edge function `linkedin-oauth-callback`
4. Creer l'edge function `fetch-linkedin-posts`
5. Creer le hook `useLinkedInPosts` + composant `LinkedInPostItem`
6. Integrer dans Feed.tsx
7. Configurer le cron job

