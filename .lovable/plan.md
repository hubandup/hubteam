## Refonte page Targets — vue commerciale par urgence

### Objectif
Transformer la grille de cards uniformes actuelle en une vue priorisée où l'urgence saute aux yeux, avec en-tête redesigné, filtres rapides et nouvelle card commerciale.

### Mapping données (réutilise champs existants `clients`)
Aucune modification DB nécessaire. Mapping :

| Concept demandé      | Champ Supabase utilisé                                      |
|----------------------|--------------------------------------------------------------|
| name                 | `company`                                                    |
| logo_url             | `logo_url`                                                   |
| contact_name         | `first_name + last_name`                                     |
| contact_email        | `email`                                                      |
| contact_phone        | `phone`                                                      |
| status (3 buckets)   | dérivé de `kanban_stage` (voir mapping ci-dessous)           |
| next_deadline        | `follow_up_date`                                             |
| last_contact_at      | `last_contact`                                               |
| ca                   | `revenue_current_year` (fallback `revenue`)                  |
| is_pinned            | présence dans `client_targets` (déjà géré par `useTargets`)  |

Mapping `kanban_stage` → bucket UI :
- **Prospect** : `prospect`, `rdv_a_prendre`, `rdv_hub_date`, `rdv_pris`
- **Client actif** : `reco_en_cours`, `projet_valide`, `a_fideliser`
- **À relancer** : `a_relancer`, OU n'importe quel stage avec `follow_up_date < today`
- (`sans_suite` → considéré comme "À relancer" jusqu'à filtrage manuel, mais reste visible dans "Tous")

### Fichiers touchés
1. **`src/pages/Targets.tsx`** — refonte complète (en-tête, filtres, regroupement, grid)
2. **`src/components/targets/TargetCard.tsx`** — NOUVEAU composant card dédié (n'altère pas `ClientCard.tsx` utilisé ailleurs dans le CRM)
3. **`src/components/targets/targetUtils.ts`** — NOUVEAU (helpers : urgence, mapping statut, fallback logo, format date FR, palette pastel)

### Détail des modifications

#### `Targets.tsx`
- Fond page `#F5F5F2` ajouté au conteneur racine.
- En-tête : carré 40×40 fond `#E8FF4C` avec icône `Star` (Lucide 18, fill `#0f1422`), titre `Targets` en `font-display` bold 30px, sous-titre dynamique `Vos prospects et clients prioritaires (N)`.
- À droite : toggle vue (List/Columns3/LayoutGrid) — actif `bg-[#0f1422] text-white`, inactif fond blanc bordure `neutral-200`. Défaut **LayoutGrid**.
- Bouton **Ajouter un target** : ouvre le dialog existant `AddClientDialog`, et après création, épingle automatiquement via `useToggleTarget` (mutation chainée sur le client créé).
- Barre recherche+filtres : conteneur blanc bordure 1px, icône Search 14, input plein largeur. À droite : 4 pastilles mutuellement exclusives `Tous (N) / Prospects (N) / Clients actifs (N) / À relancer (N)`. Compteurs calculés sur la base **avant** filtre actif (pour rester stables).
- Filtre temps réel : recherche sur `company`, `first_name`, `last_name`.
- Calcul urgence par target → 4 buckets `late | week | month | none` (basé sur `follow_up_date`).
- Sections empilées **uniquement quand non vides** : EN RETARD (#DC2626) / CETTE SEMAINE (#EA580C) / À VENIR / SANS ÉCHÉANCE (#94A3B8). Header section : barre 4×20 + titre `font-display` uppercase tracking-wider + compteur `bg-[#0f1422] text-white`.
- Tri intra-section : `follow_up_date` ascendant ; les `none` à la fin de la section "À venir".
- Grille : `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`.
- État vide filtré : bloc blanc bordure neutral-200 padding 48px centré.
- Pagination : si > 50 targets après filtres → afficher 50 puis bouton **Charger plus** (+ 50). Sinon tout afficher.
- Vues `list` et `kanban` conservées telles quelles (rendent toujours `ClientListView` / `ClientKanbanView`).

#### `targets/TargetCard.tsx` (nouveau)
Props : `client`, `onClick`. Réutilise `useToggleTarget` pour le "Désépingler".
Structure :
- Card `bg-white border border-neutral-200 hover:border-neutral-400 group relative`.
- **A. Badge urgence** (top, conditionnel) : `px-4 pt-3 pb-2 text-[11px] font-semibold` + `AlertCircle` 12. Couleurs : late `#DC2626`, week `#EA580C`, month `#65748B`. Texte FR : `Aujourd'hui` / `En retard de Xj` / `Dans Xj` / `Dans X semaines` (>14j).
- **B. Header** : logo 56×56 (`<img loading="lazy" object-contain p-1.5 border bg-white>` ou fallback pastel déterministe basé sur `charCodeAt(0) % 8` — palette des 8 couleurs spécifiée, 2 premières lettres en `font-display` bold). `onError` bascule vers fallback via state local. À droite : nom entreprise `font-display font-bold text-sm truncate`, contact `text-xs neutral-600 truncate`. Bouton `MoreHorizontal` (opacity-0 group-hover:opacity-100) → `DropdownMenu` shadcn avec : Voir la fiche / Modifier (ouvre `EditClientDialog`) / Désépingler (ouvre `AlertDialog` de confirmation).
- **C. Statut pipeline** : tag `inline-flex px-2 py-0.5 text-[10px] uppercase tracking-wider` + puce `rounded-full w-1.5 h-1.5`. Couleurs Prospect/Client actif/À relancer per spec.
- **D. Infos contact** : `space-y-1 text-xs neutral-600` — Mail (toujours), Phone (uniquement si présent).
- **E. Footer** : `pt-3 border-t border-neutral-100 flex justify-between text-[11px]`.
  - Gauche : `Clock` 10 + label `Contact` neutral-400 + date `font-semibold neutral-600`. Format date-fns `d MMM` locale `fr` (ex `6 nov.`), avec année si différente de l'année courante. Sinon `Jamais contacté` italic.
  - Droite : CA — uniquement si bucket = "Client actif" ET `revenue_current_year > 0`. Format `7 295 €` + label `CA` neutral-400. Sinon rien.
- Suppression : plus d'étoile dans la card, plus de bouton "Retirer" permanent, plus de bloc "0 € Année fiscale", plus de dates `jj/mm/aaaa`.

#### `targets/targetUtils.ts` (nouveau)
- `getUrgency(followUpDate)` → `{bucket, daysDiff, label}` (ex `late`, 5, `En retard de 5j`).
- `getStatusBucket(kanbanStage, followUpDate)` → `'prospect' | 'client' | 'relancer'`.
- `getStatusStyle(bucket)` → `{bg, text, dot, label}`.
- `getLogoFallback(name)` → `{bg, text, initials}` (palette 8 pastels).
- `formatShortFrDate(date)` → `6 nov.` ou `12 nov. 24` si année différente.
- `formatCa(n)` → `7 295 €` (Intl `fr-FR`).

### Contraintes respectées
- **Coins carrés** : aucun `rounded-*` sauf `rounded-full` sur les puces 6×6 et le carré logo fallback (qui reste carré).
- **Polices** : `font-display` (Instrument Sans, déjà configuré dans Tailwind config) sur titres, défaut Roboto sur le corps.
- **Fond page** : `#F5F5F2` appliqué sur le conteneur racine de Targets uniquement (n'affecte pas les autres pages).
- **Realtime** : conservé via `useTargets` + invalidation existante sur `clients`.
- **Accessibilité** : `aria-label` sur boutons icône, `loading="lazy"` sur images.

### Risques / notes
- Le bouton "Ajouter un target" suppose que créer un client puis l'épingler est l'intention voulue. Si tu préfères qu'il ouvre un sélecteur parmi les clients existants non-épinglés, dis-le-moi avant impl.
- Le bucket "À relancer" inclut auto les clients dont `follow_up_date` est dépassée, en plus du `kanban_stage = 'a_relancer'`. Cela évite qu'un client en retard soit catégorisé "Prospect".
- `ClientCard.tsx` original n'est PAS modifié (utilisé dans CRM, Targets vue grid actuelle, vues partagées). La nouvelle card vit dans `src/components/targets/`.
