## Objectif
Refondre la page `src/pages/ClientDetails.tsx` et ses sous-composants pour livrer l'UI décrite : cartes aérées radius 16–18, palette lime/navy, bloc IA "Assistant de relance" repensé, rail droit pipeline/RDV/URLs, onglets Infos & Projets alignés. Aucune modification du back / des données.

## 1. Design tokens (index.css + tailwind.config.ts)
Ajouter/aligner les variables sémantiques HSL :
- `--ink 222 22% 10%` (#0F1420)
- `--navy 222 32% 8%` + `--navy-hover 222 40% 18%`
- `--lime 74 87% 58%` (#CDF03A) — `--lime-foreground` = navy
- `--bg 220 15% 97%`, `--card 0 0% 100%`, `--card-border 220 12% 92%` (#E8EAEE)
- `--muted-fg 222 8% 58%`, `--label 222 10% 40%`
- `--success-fg 154 76% 36%`, `--success-bg 145 55% 93%`
- `--field-border 220 13% 90%`, `--danger 8 58% 51%`
- Radius : `--radius-card: 18px`, `--radius-button: 999px` (déjà pill), `--radius-chip: 999px`, `--radius-field: 12px`

Exposer dans `tailwind.config.ts` : `colors.ink/navy/lime/success`, `borderRadius.card`. Body déjà en Instrument Sans (confirmé mémoire).

## 2. Nouvel en-tête client (`ClientDetails.tsx`)
- Carte blanche unique radius-card, padding 28.
- Logo 56×56 radius 14, bord `--card-border`. Fallback initiale.
- Titre 26/700, badge statut lime (navy text) au lieu du fond jaune actuel.
- Ligne infos avec icônes 14px `text-muted-fg`, gap 20.
- Tags gris pill radius-chip padding 4/10.
- Onglets intégrés en bas de la même carte, border-top ; onglet actif = underline navy 2px + badge navy/lime.

## 3. Onglet Commercial (`CommercialTrackingTab.tsx` + sous-composants)
Grille `grid-cols-[1fr_336px] gap-[22px]`.

### Colonne principale
1. **Assistant de relance** (refonte de `ClientFollowupBanner.tsx`) : carte blanche (plus de fond navy).
   - Header : tuile 36×36 gradient navy + Sparkles lime, titre "Assistant de relance", badge "IA" navy/lime, sous-titre muted.
   - Header droite : pastille verte "Généré à l'instant" si résultat.
   - États :
     - Vide : bloc centré + CTA lime "Générer une relance" (Sparkles).
     - Chargement : 3 skeleton lines animate-pulse + "Rédaction en cours…" + spinner.
     - Résultat : encadré `bg-[hsl(var(--surface-soft))]` radius 12 padding 16 `whitespace-pre-line`. Actions : Copier (toggle vert "Copié" 1.8s), navy "Envoyer par email", lien discret "Régénérer" à droite.
2. **Suivi commercial** : carte, 2 selects côte à côte (Interlocuteur / Statut), séparateur, sous-bloc "Contacts additionnels" (composant existant `ClientContactsManager`).
3. **Qualification du besoin** (`QualificationCollapsible.tsx`) : header cliquable avec barre progression lime (X/10) + chevron rotate. Grille 2 cols labels normal-case. Chips zone géo actives = navy/blanc. Bouton dashed "Ajouter une question".
4. **Comptes rendus** (`CommercialNotesCards.tsx`) : segmented control Tous/Publics/Privés, CTA navy "Ajouter un CR", lignes dépliables.

### Colonne droite (rail sticky `top-4`)
Refonte `ClientCommercialSidebar.tsx` en 3 cartes empilées :
- **Pipeline** : 8 étapes ; actif = fond `lime/10`, gras, puce carrée lime pleine ; autres = puce carrée outline.
- **Étapes de rendez-vous** : MeetingsCompactBlock repensé, pastilles vert/gris + `+`.
- **URLs veille IA** : liste puce lime + bouton retirer + `+` (ScrapeUrlsManagerModal en trigger).

## 4. Onglet Infos (`ClientInfoTab.tsx`)
Grille `md:grid-cols-2 gap-[22px]`.
- Carte "Informations générales" : lignes icône+label+valeur.
- Carte "Statistiques" : tuile navy "CA total" chiffre lime + tuile gris clair "Année fiscale" + badge vert "Actif".

## 5. Onglet Projets (`ClientProjectsTab.tsx`)
Header + CTA navy "Nouveau projet". Grille cartes projet actuelles restylées radius-card, barre progression lime. Ajouter tuile dashed "Créer un nouveau projet" en fin de grille.

## 6. Onglets Tâches / Documents / Factures
Ajouter composant partagé `EmptyState` (icône lime pastel, titre, phrase, CTA lime) et l'utiliser quand liste vide dans `ClientTasksTab`, `ClientKDriveTab`, `ClientInvoicesTab`.

## 7. Fichiers touchés
- `src/index.css` — nouveaux tokens.
- `tailwind.config.ts` — extend colors/radius.
- `src/pages/ClientDetails.tsx` — en-tête + onglets restylés.
- `src/components/client-details/ClientFollowupBanner.tsx` — refonte complète (carte blanche + 3 états).
- `src/components/client-details/CommercialTrackingTab.tsx` — grille + ordre des cartes.
- `src/components/client-details/CommercialNotesCards.tsx` — segmented, CTA navy.
- `src/components/client-details/QualificationCollapsible.tsx` — header progression, labels normal-case, chips zone.
- `src/components/client-details/ClientCommercialSidebar.tsx` — 3 cartes Pipeline/RDV/URLs.
- `src/components/client-details/MeetingsCompactBlock.tsx` — pastilles statut.
- `src/components/client-details/ClientInfoTab.tsx` — 2 cartes.
- `src/components/client-details/ClientProjectsTab.tsx` — CTA + carte dashed.
- `src/components/client-details/ClientTasksTab.tsx`, `ClientKDriveTab.tsx`, `ClientInvoicesTab.tsx` — empty states.
- `src/components/common/EmptyState.tsx` — nouveau.

## Non-inclus
- Sidebar app globale et topbar (déjà en place, conformes) — non retouchées sauf si tu confirmes.
- Aucun changement DB/RLS/permissions.
- Logique fetch et Supabase queries inchangées.

## Vérification
- `bun run build` clean.
- Playwright : capture des 3 onglets (Commercial / Infos / Projets) en 1280×1800 pour comparer au brief.
