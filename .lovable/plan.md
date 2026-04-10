

# Fusion des onglets "Par Levier" et "Full Détail"

## Analyse actuelle

- **Par Levier** : 5 blocs (Media One Video + Social, Media VOL, Media Social, Media SEA, Media Affiliation), chacun avec ses KPIs, colonnes Objectif/Semaines/Complétion/Statut
- **Full Détail** : 3 blocs funnel (Awareness, Considération, Purchase) avec KPIs + agrégats mensuels, puis 2 blocs supplémentaires (Influence, Social Media)

Les deux vues partagent la même donnée scorecard mais l'organisent différemment (par canal vs par étape du funnel).

## Design proposé : Vue unifiée "Détail par levier"

Un seul onglet qui reprend la structure **par levier** (le regroupement le plus naturel pour un pilotage opérationnel) mais enrichi avec les éléments du **Full détail** :

```text
┌─────────────────────────────────────────────────────────┐
│  [Synthèse]  [Détail par levier]          [Learnings]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ▪ Media One Video + Social                             │
│  ┌───────┬─────────┬──────┬──────┬──────┬──────┬──────┐ │
│  │ KPI   │ Objectif│ S14  │ S15  │ S16  │ Avr  │ Comp.│ │
│  │ Reach │  2M     │ 1.2M │ 1.5M │ ...  │ 1.4M │  72% │ │
│  │ ...   │         │      │      │      │      │      │ │
│  └───────┴─────────┴──────┴──────┴──────┴──────┴──────┘ │
│                                                         │
│  ▪ Media VOL                                            │
│  ┌─── ... ──────────────────────────────────────────┐   │
│  ...                                                    │
│                                                         │
│  ▪ Influence                                            │
│  ┌─── ... ──────────────────────────────────────────┐   │
│                                                         │
│  ▪ Social Media                                         │
│  ┌─── ... ──────────────────────────────────────────┐   │
└─────────────────────────────────────────────────────────┘
```

### Ce qui change concrètement

1. **Fusion des structures** : on combine `PAR_LEVIER_STRUCTURE` et les sections Influence/Social Media du Full détail en une seule liste de blocs
2. **Colonnes enrichies** : chaque tableau de levier affiche désormais : KPI, Objectif, Semaines (avec toggle +/-), **agrégats mensuels** (du Full détail), Complétion, Statut
3. **Sections funnel supprimées** : les blocs Awareness/Considération/Purchase disparaissent car leurs KPIs sont déjà distribués dans les leviers correspondants
4. **2 sous-onglets au lieu de 3** : `Synthèse` + `Détail par levier`

### Modifications techniques

- **Fichier** : `src/components/lagostina/ScorecardRECC.tsx`
  - Supprimer `FULL_DETAIL_SECTIONS` et le tab `full_detail`
  - Renommer `par_levier` → `detail` avec label "Détail par levier"
  - Ajouter les colonnes d'agrégats mensuels dans les tableaux par levier
  - Intégrer les sections Influence et Social Media à la fin de la vue détail
  - Mettre à jour `scorecardSubTabs` pour n'avoir que 2 entrées

