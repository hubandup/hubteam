# Design System Hub+Up — Plan de mise en œuvre

Objectif : établir un langage visuel unique et réutilisable, puis y aligner progressivement toutes les pages. Le travail est **découpé en 4 lots** pour livrer de la valeur par étapes et éviter une régression massive.

---

## Lot 1 — Fondations (tokens + Tailwind config)

Un seul commit qui pose les bases pour tous les composants suivants.

**`src/index.css`** — refonte des variables (light + dark) :
- `--ink` `--navy` `--navy-hover` `--lime` `--bg` `--card` `--border` `--field-border` `--focus` `--muted` `--label`
- Statuts : `--success` / `--success-bg`, `--warning` / `--warning-bg`, `--danger` / `--danger-bg`, `--info` / `--info-bg`
- Rayons : `--radius-input` (10), `--radius-card` (18), `--radius-pill` (999)
- Dark mode : `--bg #0B1220`, `--card #131C30`, texte clair, lime conservé

**`tailwind.config.ts`** :
- `fontFamily.sans = ['Instrument Sans', ...]` (déjà chargée)
- Étendre `colors` avec les tokens ci-dessus (ink, navy, lime, muted, label, success, warning, danger, info)
- Étendre `borderRadius` (input, card, pill)
- Échelle typo custom : `display`, `h1`, `h2`, `h3`, `body`, `label`, `caption`

**Règle d'or** : plus aucun `bg-black`, `text-white`, `bg-[#…]` en dur dans les composants. Tout via tokens.

---

## Lot 2 — Bibliothèque de primitives

Nouveaux composants dans `src/components/ui/` (ou révision des shadcn existants via variantes CVA). Un seul style par primitive, utilisé partout ensuite.

| Composant | Fichier | Notes |
|---|---|---|
| Button (primary/dark/outline/ghost/danger, sm/md, loading) | `ui/button.tsx` (variantes CVA étendues) | Primary = lime/navy · Dark = navy/blanc |
| Card (+ CardHeader collapsible) | `ui/card.tsx` | radius 18, padding 20–28, header optionnel |
| Input / Textarea / Select | déjà shadcn, on aligne les tokens | focus ring = ink |
| Chips sélectionnables | `ui/chip.tsx` (nouveau) | mono/multi, actif navy |
| SegmentedControl | `ui/segmented.tsx` (nouveau) | conteneur muted, actif blanc + shadow |
| Badge / StatusPill | `ui/status-pill.tsx` (nouveau) | success/warning/danger/info/neutral + puce |
| Tabs | `ui/tabs.tsx` (révision) | underline navy 2px + badge compteur |
| ProgressBar | `ui/progress.tsx` (révision) | remplissage lime |
| StatTile | `ui/stat-tile.tsx` (nouveau) | variante navy (chiffre lime) + claire |
| IconButton | `ui/icon-button.tsx` (nouveau) | carré 38px, hover muted |
| Breadcrumb | `ui/breadcrumb.tsx` (nouveau) | dernier segment gras |
| EmptyState | `common/EmptyState.tsx` (nouveau) | tuile icône lime pastel + titre + phrase + CTA |
| DatePill | `ui/date-pill.tsx` (nouveau) | pill neutre avec icône calendrier |
| AI Assistant Card | `ai/AssistantCard.tsx` (nouveau) | tuile dégradé navy + étincelle lime, états vide/loading/résultat, actions Copier/Envoyer/Régénérer |

Le `ClientFollowupBanner` actuel sera migré vers `AssistantCard` (mêmes props).

---

## Lot 3 — Shell applicatif

Ajuster ce qui existe déjà (`Sidebar`, `Topbar`, layout racine) pour matcher exactement la spec :

- **Sidebar** 250px, fond navy, logo HUB+UP, item actif = pill lime/navy gras (déjà proche), inactif #8A92A3, hover navy clair, « Déconnexion » séparée par bordure haute.
- **Topbar** 66px blanche : toggle sidebar (gauche), recherche + FR + thème + cloche (pastille lime) + avatar chevron (droite). Boutons icônes = IconButton 38px.
- **Zone contenu** : `max-w-[1240px] mx-auto px-7 py-8`, Breadcrumb en tête de chaque page, `← Retour` sur sous-pages.

---

## Lot 4 — Déclinaison écran par écran (progressif)

Après validation des lots 1-3, on décline dans cet ordre (une PR par écran) :

1. **CRM — fiche client** (déjà en cours) : finaliser Commercial, puis Infos, Projets, Tâches, Documents, Factures avec les primitives.
2. **CRM — liste clients** : header (titre + compteur + CTA), filtres + SegmentedControl, table stylée, EmptyState.
3. **Projets** (liste + détail) : mêmes patterns.
4. **Prospection**, **Agences**, **Targets**, **Factures** : pages liste alignées.
5. **Accueil / Activité / Finances / Comptabilité** : dashboards (StatTile navy + graphes + listes).
6. **FAQ / Paramètres** : formulaires en cartes, actions ancrées bas.

Chaque écran reçoit ses 4 états : normal / loading (skeleton) / vide (EmptyState) / erreur.

---

## Détails techniques

- **Aucune migration DB** ni changement de logique métier dans ces lots — 100 % présentation.
- Les composants shadcn existants sont **révisés** (variantes CVA, tokens) plutôt que remplacés, pour ne pas casser les imports.
- Un fichier `src/styles/tokens.md` documentera les tokens et leur usage (référence pour futurs écrans).
- Le mode sombre est câblé dès le lot 1 mais testé écran par écran au lot 4.
- Les emojis sont retirés partout où l'UI les utilise encore (ex. `TYPE_EMOJI` dans `CommercialNotesCards`) et remplacés par des icônes Lucide.

---

## Ordre de livraison proposé

**Turn 1** (ce prochain message si tu valides) : Lot 1 + Lot 2 (tokens + primitives). Aucune page ne change encore visuellement de façon massive — les composants existants continuent de fonctionner car ils passent par les mêmes tokens.

**Turn 2** : Lot 3 (shell) + migration de la fiche client CRM entièrement sur les primitives (finition du travail en cours).

**Turns 3+** : les autres écrans, un par un, dans l'ordre listé — tu valides après chaque écran.

---

## Ce que je te demande de confirmer

1. **OK pour la découpe en 4 lots** livrés progressivement (plutôt qu'un big-bang qui casserait tout d'un coup) ?
2. **Ordre des écrans au lot 4** : commencer par finir CRM (fiche + liste), puis Projets, puis dashboards ? Ou tu préfères un autre ordre (ex. Accueil d'abord car vitrine) ?
3. **Mode sombre** : je le câble en tokens dès le lot 1, mais est-ce que je le teste / débogue écran par écran (temps supplémentaire) ou on le remet à plus tard ?
