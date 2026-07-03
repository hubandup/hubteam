## Objectif

Centraliser tout le travail dans la fiche client, sans jamais toucher aux données. Aucune migration SQL, aucune suppression, aucune modification de RLS. Uniquement des changements d'affichage, de navigation et de composition.

## Règle absolue

**100% additif.** Aucun `DROP`, `DELETE`, `TRUNCATE`. Aucun fichier de composant existant supprimé — ils seront désactivés de la nav mais conservés pour préserver leur logique (fetch, mutations, permissions notes privées). Tâches, notes, équipes, documents, métadonnées projet restent intacts.

## 1. Fiche client — nouvel ordre des onglets

Ordre appliqué dans `src/pages/ClientDetails.tsx` (`allTabs`) :

1. **Commercial** (admin uniquement, inchangé)
2. **Infos** (inchangé)
3. **Projets** (existe déjà — `ClientProjectsTab`)
4. **Tâches** (nouveau — agrégation)
5. **Documents** (renommage de l'onglet « kDrive » — libellé déjà « Documents » côté UI, on nettoie la clé `value: 'kdrive'` → `value: 'documents'` en gardant une redirection depuis l'ancienne clé pour ne pas casser les liens sauvegardés)
6. **Factures** (inchangé)

Le badge et les compteurs existants sont conservés.

## 2. Nouvel onglet Tâches (niveau client)

Nouveau composant `src/components/client-details/ClientTasksTab.tsx` :

- Récupère tous les `project_clients` du client → liste de `project_id`.
- Fetch `tasks` filtrées `project_id IN (...)` avec jointure sur `projects(name)` pour afficher le projet d'origine.
- Colonnes : titre, projet d'origine (badge cliquable qui ouvre le projet imbriqué), assigné à, statut, deadline.
- Filtre par projet (dropdown), filtre statut, tri deadline.
- Aucune écriture nouvelle — réutilise les hooks existants (`useTasks`) et respecte les RLS déjà en place.

## 3. Navigation projet imbriquée dans la fiche client

Quand on clique un projet depuis l'onglet Projets ou depuis le badge d'une tâche :

- URL : `/client/:id?tab=projects&project=:projectId&subtab=tasks|notes`
- Pas de rechargement — on reste dans `ClientDetails.tsx`, on ne navigue pas vers `/project/:id`.
- Nouveau composant `src/components/client-details/EmbeddedProjectView.tsx` :
  - En-tête projet complet : nom, description, dates, statut, **équipe (client + agences + membres)**, **métadonnées** — issus de l'ex-onglet Infos + Équipe.
  - Bouton « ← Retour aux projets » qui repasse à `tab=projects` sans `project`.
  - Sous-onglets réduits à **Tâches** et **Notes** uniquement, via `ProjectTasksNotebookTab` et `ProjectNotesTab` existants (aucune modification interne).
- Les composants `ProjectTeamTab`, `ProjectKDriveTab`, `EditProjectInfoDialog` **restent en place** — leurs données remontent simplement dans l'en-tête embarqué. L'accès direct `/project/:id` continue d'exister (route conservée) pour compatibilité liens/notifs.

## 4. Onglet Documents unifié

- Le composant `ClientKDriveTab` gère déjà l'arborescence kDrive du client. On garde son rendu, on renomme uniquement :
  - `value: 'kdrive'` → `value: 'documents'` dans la définition d'onglets.
  - Libellé UI : « Documents » (déjà en place).
  - Redirection : si `?tab=kdrive` est présent dans l'URL, on le mappe vers `documents` au montage pour préserver les anciens liens.
- Aucun déplacement de fichier physique — l'arborescence remonte telle quelle avec un sous-dossier par projet (déjà le cas via la logique kDrive existante).

## 5. Notes privées

Comportement strictement inchangé — `ProjectNotesTab` est réutilisé tel quel, ses filtres de visibilité (auteur + admin) s'appliquent naturellement dans le contexte imbriqué.

## 6. Page /projects transversale

- Aucun changement fonctionnel : liste + Kanban + filtres inchangés.
- Modif du handler de clic sur une carte projet : au lieu de `navigate('/project/:id')`, redirige vers `/client/:clientId?tab=projects&project=:projectId&subtab=tasks` en récupérant le `client_id` depuis `project_clients` (déjà chargé dans `useProjects`).
- Fallback : si un projet n'a pas de client rattaché (edge case), on garde `/project/:id` comme aujourd'hui.

## Critères d'acceptation vérifiés

- Base de données strictement identique avant/après (aucune migration).
- Toutes les tâches et notes existantes restent accessibles depuis la fiche client.
- Onglet Tâches client agrège l'ensemble avec projet d'origine et filtre.
- Onglet unique « Documents », plus aucun libellé « kDrive » dans l'UI.
- Notes privées restreintes comme avant.
- `/projects` fonctionnel, redirige dans le contexte client.
- Navigation projet-dans-client sans rechargement (React state + query params).

## Vérification manuelle post-implémentation

Ouvrir 2-3 clients (dont SEB), confirmer que toutes tâches + notes remontent bien, cliquer sur un projet et vérifier les 2 sous-onglets + l'en-tête équipe/infos.

## Section technique

- **Fichiers créés** : `ClientTasksTab.tsx`, `EmbeddedProjectView.tsx`.
- **Fichiers modifiés** : `ClientDetails.tsx` (tabs + gestion query params `project`/`subtab`), `Projects.tsx` + `ProjectCard.tsx`/`ProjectListView.tsx`/`ProjectKanbanView.tsx` (nouveau handler de clic).
- **Fichiers conservés inchangés mais non montés dans la nouvelle nav projet** : `ProjectTeamTab.tsx`, `ProjectKDriveTab.tsx`, `ProjectAttachmentsTab.tsx`, `EditProjectInfoDialog.tsx` — accessibles via `/project/:id` (route intacte).
- Route `/project/:id` conservée pour compat notifications/deep-links.
- Aucun changement dans `src/hooks/useTasks.tsx`, `useProjects.tsx`, `useNotes` — seuls des consommateurs.
