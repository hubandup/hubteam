# Transférer une fois les données CRM vers Project Hub

Oui, c'est faisable. Les deux applications ont chacune leur propre base de données, et je ne peux pas écrire directement dans celle de Project Hub depuis HubTeam. Le transfert se fait donc en deux temps : HubTeam produit un fichier de transfert, Project Hub le lit et crée les fiches.

## Ce que je fais côté HubTeam

Ajouter dans le CRM un bouton « Transférer vers Project Hub » qui génère un dossier compressé contenant :

- un fichier de données au format attendu par Project Hub (fiches clients, contacts, comptes rendus et notes transformés en commentaires) ;
- un dossier `logos` avec l'image de chaque société.

Les données sont déjà mises en forme pour le CRM de Project Hub : une fiche par contact principal, avec société, secteur, nom/prénom, fonction, email, téléphone, chiffre d'affaires, prochaine action et sa date. Les contacts supplémentaires deviennent des fiches rattachées à la même société. Les comptes rendus et notes commerciales deviennent des commentaires datés avec le nom de leur auteur.

## Ce qu'il faudra faire dans Project Hub

Une fois ce fichier prêt, il faut ouvrir le projet Project Hub et y ajouter un écran d'import qui lit le dossier compressé et crée les fiches, les commentaires et les logos. Je ne peux pas le faire depuis ici : je peux seulement lire le code de Project Hub, pas le modifier. Je vous indiquerai précisément quoi demander là-bas.

## Points d'attention

- Les auteurs des comptes rendus n'existent pas forcément dans Project Hub : leur nom sera conservé en texte au début du commentaire.
- Les étapes du pipeline de Project Hub sont une liste courte et différente des statuts HubTeam : je fais une correspondance par libellé et je crée l'étape manquante si besoin.
- C'est une action unique : après le transfert, les deux CRM évoluent indépendamment.

## Détails techniques

- Nouveau `src/lib/crm-hub-export.ts` : charge `clients`, `client_contacts`, `meeting_notes`, `commercial_tracking` + `commercial_notes` / `commercial_meetings` / `commercial_contacts`, et les profils auteurs ; produit un JSON aligné sur le schéma de Project Hub (`crm_contacts`, `crm_comments`, `crm_stages`), avec `logo_file` référençant le fichier dans le dossier `logos`.
- Réutilisation de la logique ZIP déjà présente dans `ExportButton.tsx` (jszip + téléchargement des logos, noms nettoyés, gestion des collisions).
- Ajout d'une entrée « Transférer vers Project Hub » dans le menu d'export de `CRM.tsx`, sur `filteredClients`.
- Côté Project Hub (à faire dans ce projet) : écran d'import lisant le ZIP, upsert dans `crm_contacts` / `crm_comments` (RLS admin uniquement), upload des logos dans le bucket utilisé par `crm-logo.tsx`.
