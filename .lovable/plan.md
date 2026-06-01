## Pourquoi le ROAS TikTok est à 0

Dans les fichiers TikTok fournis, **`ROAS des achats` = 0 sur toutes les lignes** (compte global + 114 contenus pub) — TikTok ne traque pas l'événement "Purchase" côté Lagostina. En revanche :

- `ROAS des finalisations de paiement` = **0.27** au niveau compte (du signal exploitable)
- `Conversion` (finalisations de paiement) = 38, `CPA` = 177,93 $, `CVR` = 0,17 %
- `Coût` total = 6 761,52 $ pour 13 M d'impressions

Donc le ROAS "vrai achat" n'existe pas côté TikTok aujourd'hui. Deux options à choisir (question posée ci-dessous).

## Ce que je propose d'ajouter à l'onglet TikTok

L'onglet ne montre aujourd'hui que 6 KPI agrégés (reach, completion, engagement_rate, cpv, cpc, roas). Les fichiers contiennent beaucoup plus de matière exploitable :

### 1. KPIs additionnels au niveau compte
- **CTR** (taux de clics)
- **CPM** (coût pour mille impressions)
- **CPA** (coût par finalisation de paiement)
- **CVR** (taux de conversion)
- **Conversions** (finalisations de paiement, en volume)
- **Dépense totale** ($)

### 2. Top contenus / créas publicitaires (fichier 004)
Tableau "Top 10 contenus" trié par impressions ou par ROAS, avec colonnes :
- Nom du support publicitaire + miniature/URL
- Impressions, Clics, CTR
- Conversions, CPA
- Dépense
- ROAS finalisations

Permet de voir **quel post performe** — c'est aujourd'hui ce qui manque le plus.

### 3. Données par jour (fichier 001 = 152 jours)
Mini-graph d'évolution sur la période :
- Dépense / jour
- Impressions / jour
- Conversions / jour

### 4. Campagnes
Les fichiers fournis ne contiennent **pas** de niveau "campagne" (uniquement compte + supports publicitaires + produits). Pour ajouter une vue Campagnes, il faudrait soit :
- Demander un export TikTok au niveau Campagne, soit
- Attendre la connexion API TikTok (J+3) qui exposera `campaign_id` / `campaign_name`

## Plan d'implémentation

### Étape 1 — Mettre à jour les données mensuelles existantes
Recalculer March → June 2026 avec **`ROAS finalisations de paiement`** (et plus `ROAS achats`) → la valeur "roas" du scorecard remontera enfin.

Ajouter aussi en `lagostina_media_kpis` les nouveaux KPI mensuels : `ctr`, `cpm`, `cpa`, `cvr`, `conversions`, `spend`.

### Étape 2 — Étendre la liste TIKTOK_KPIS
Dans `LagostinaMediatisation.tsx`, passer de 6 à ~10 cartes KPI (ajouter ctr, cpm, cpa, conversions, spend).

### Étape 3 — Nouveau bloc "Top contenus publicitaires"
Sous les cartes KPI, un tableau lisant une nouvelle table légère `lagostina_tiktok_top_ads` (nom du contenu, impressions, clics, conv, CPA, ROAS, dépense). Alimenté depuis les fichiers 004 maintenant + via cron quand l'API sera branchée.

### Étape 4 — (optionnel) Mini-graph quotidien
Sparkline 90 jours dépense + conversions, alimentée par `lagostina_tiktok_daily` (nouvelle table) depuis le fichier 001.

### Étape 5 — Mettre à jour l'edge function `sync-tiktok-ads`
Une fois l'API approuvée, basculer en mode lecture API en remplissant les mêmes tables.

## Questions avant de coder

1. **ROAS** : on remplace bien le ROAS affiché par "ROAS des finalisations de paiement" (0,27 actuellement) ? Ou on laisse le ROAS achats et on affiche les deux ?
2. **Quelle granularité supplémentaire** : (a) seulement +KPIs compte, (b) +Top contenus, (c) +Top contenus + sparkline quotidien ?
3. **Vue Campagnes** : on attend l'API TikTok pour la créer, ou tu peux ré-exporter un fichier au niveau Campagne maintenant ?
