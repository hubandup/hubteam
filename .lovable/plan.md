

# Plan d'amelioration globale de Hub Team

Ce plan couvre quatre axes majeurs : accessibilite/UX, mode hors-ligne PWA, enrichissement du Dashboard admin, et d'autres ameliorations generales.

---

## 1. Accessibilite et UX

### 1.1 Aria-labels et roles semantiques
- Ajouter des `aria-label` manquants sur tous les boutons icones (NotificationBell, HeaderUserProfile, boutons de fermeture des dialogues, boutons d'action dans les cards Kanban)
- Ajouter `role="status"` sur les badges de compteurs (MobileBottomNav, NotificationBell)
- Ajouter `aria-live="polite"` sur les zones de chargement et les messages toast

### 1.2 Navigation clavier dans le Kanban
- Ajouter la gestion du `tabIndex` et des `onKeyDown` (Enter/Space) sur les cartes Kanban (ClientKanbanView, ProjectKanbanView, ProspectKanbanView)
- S'assurer que les colonnes Kanban sont navigables avec Tab et que le focus est visible

### 1.3 Gestion du focus dans les modales
- Verifier que les dialogues (AddClientDialog, AddProjectDialog, etc.) restaurent le focus sur l'element declencheur a la fermeture (Radix le fait nativement, verifier que rien ne l'empeche)
- Ajouter `autoFocus` sur le premier champ de saisie dans chaque dialogue d'ajout/edition

### 1.4 Retours d'erreur reseau ameliores
- Creer un composant `ErrorRetry` reutilisable affichant un message d'erreur avec un bouton "Reessayer"
- L'integrer dans les pages principales (Home, Dashboard, CRM, Projects) en remplacement des gestions d'erreur actuelles (certaines ne montrent qu'un toast puis rien)

### 1.5 Skip-to-content
- Ajouter un lien "Aller au contenu principal" en haut du Layout, visible uniquement au focus clavier

---

## 2. Mode hors-ligne (PWA)

### 2.1 Cache strategique des donnees critiques
- Configurer le `queryClient` (dans `src/lib/queryClient.ts` deja existant mais non utilise dans App.tsx) pour activer `gcTime` et `staleTime` plus agressifs sur les entites critiques
- Remplacer le `new QueryClient()` inline dans App.tsx par l'import depuis `src/lib/queryClient.ts` pour centraliser la configuration

### 2.2 Runtime caching Workbox ameliore
- Ajouter des regles de cache Workbox supplementaires dans `vite.config.ts` :
  - Cache `StaleWhileRevalidate` pour les requetes Supabase REST (lecture de clients, projets, taches) avec un TTL de 1h
  - Cache `CacheFirst` pour les avatars et images statiques
- Ajouter `/~oauth` au `navigateFallbackDenylist` (manquant actuellement)

### 2.3 Indicateur de statut reseau
- Creer un composant `OfflineBanner` qui detecte `navigator.onLine` et affiche une banniere discrete en haut de l'ecran quand l'utilisateur est hors connexion
- L'integrer dans le Layout

### 2.4 Synchronisation optimiste
- Pour les actions critiques (TodoList, QuickNotes), utiliser `useMutation` avec `onMutate` pour des mises a jour optimistes qui fonctionnent meme brievement hors-ligne avant la resynchronisation

---

## 3. Enrichir le Dashboard admin

### 3.1 Nouveaux KPIs
- **Taux de conversion prospects** : calculer le ratio clients en stages "projet_valide"/"a_fideliser" par rapport au total des prospects historiques
- **CA mensuel** : deja partiellement implemente via les invoices, ajouter une card KPI avec le CA du mois en cours vs mois precedent (variation en %)
- **Charge equipe** : compter les taches "in_progress" et "todo" par membre d'equipe, afficher en bar chart horizontal

### 3.2 Optimisation des requetes Dashboard
- Le Dashboard fait actuellement des boucles N+1 pour les statistiques par utilisateur (lignes 386-476 : une requete par utilisateur pour projets, taches, et taches completees). Remplacer par :
  - Une seule requete groupee avec `group by` via une vue SQL ou un appel RPC
  - Cela reduira potentiellement 30+ requetes a 3 requetes

### 3.3 Filtres temporels
- Ajouter un selecteur de periode (30j, 90j, 6 mois, 1 an) en haut du Dashboard pour filtrer dynamiquement toutes les donnees affichees

---

## 4. Autres ameliorations

### 4.1 Recherche globale - ameliorations
- Ajouter la navigation par raccourcis dans les resultats de recherche (fleches, Enter)
- Ajouter des raccourcis d'actions rapides dans le Cmd+K (ex: "Nouveau projet", "Nouveau client") en plus de la recherche

### 4.2 Home page - personnalisation par role
- Filtrer les donnees de la Home selon le role : les clients ne voient que leurs projets assignes, les agences ne voient pas les donnees financieres
- Ajouter le composant `MyWeeklySchedule` (deja existant mais pas utilise dans Home.tsx)

---

## Details techniques

### Fichiers a creer
- `src/components/common/ErrorRetry.tsx` - Composant reutilisable erreur + retry
- `src/components/common/OfflineBanner.tsx` - Indicateur de statut reseau
- `src/components/common/SkipToContent.tsx` - Lien d'accessibilite

### Fichiers a modifier
- `src/App.tsx` - Utiliser queryClient depuis lib, ajouter SkipToContent
- `src/components/Layout.tsx` - Integrer OfflineBanner et SkipToContent
- `src/components/MobileBottomNav.tsx` - Ajouter aria-labels et roles
- `src/components/notifications/NotificationBell.tsx` - Ajouter aria-label
- `src/components/ClientKanbanView.tsx` - Keyboard navigation
- `src/components/ProjectKanbanView.tsx` - Keyboard navigation
- `src/components/prospection/ProspectKanbanView.tsx` - Keyboard navigation
- `src/pages/Dashboard.tsx` - Nouveaux KPIs, optimisation requetes, filtres
- `src/pages/Home.tsx` - Filtrage par role, ajout MyWeeklySchedule
- `src/components/GlobalSearch.tsx` - Actions rapides
- `vite.config.ts` - Regles Workbox ameliorees, navigateFallbackDenylist
- `src/lib/queryClient.ts` - Configuration cache optimisee

### Migration SQL (optionnelle)
- Creer une vue ou fonction RPC `dashboard_user_stats` pour agreger projets/taches par utilisateur en une seule requete au lieu de N+1

### Ordre d'implementation recommande
1. Centraliser queryClient + PWA Workbox (fondations)
2. Dashboard KPIs et optimisation requetes
3. Composants accessibilite (ErrorRetry, OfflineBanner, SkipToContent)
4. Navigation clavier Kanban + aria-labels
5. Ameliorations Home et GlobalSearch

