## Objectif

Alimenter automatiquement les KPIs **SEA** (ROAS, CPC, CTR, Impressions, Conversions, Budget dépensé, Budget alloué) de la **Scorecard** et de l'onglet **Médiatisation › SEA** depuis Google Ads, via un Google Sheet que tu programmes côté Google Ads, lu chaque jour par le back.

## Architecture choisie

```text
Google Ads ──(rapport programmé quotidien)──> Google Sheet
                                                   │
                                                   │ lecture via connecteur Google Sheets
                                                   ▼
                                          Edge Function sync-google-ads-sea
                                                   │
                                                   ▼
                                    table lagostina_media_kpis (channel='sea')
                                                   │
                                                   ▼
                                Scorecard + LagostinaMediatisation › SEA
```

Pas de Google Ads API officielle : pas de developer token, pas de validation Google, pas de gestion OAuth utilisateur. Le Google Sheet sert de "buffer" alimenté par Google Ads lui-même.

## Étape 1 — Côté Google Ads (toi)

Tu fais ça une fois dans l'UI Google Ads :
1. Rapports › créer un rapport avec colonnes : **Mois**, Impressions, Clics, CTR, CPC moyen, Coût (= budget dépensé), Budget (= budget alloué), Conversions, Valeur conv. (pour ROAS = Valeur conv. / Coût).
2. Granularité : segmenter par **Mois** + une ligne **Total** (avril N–1 → mars N, année fiscale).
3. "Programmer" → export vers Google Sheets, fréquence **quotidienne**.
4. Tu partages le Sheet avec le compte Google connecté à Lovable (étape 2).
5. Tu colles l'URL du Sheet dans un nouveau champ admin (étape 4).

## Étape 2 — Connecteur Google Sheets

J'utilise le connecteur natif `google_sheets` de Lovable (passe par le gateway, gère le refresh OAuth automatiquement). Lien à créer via `standard_connectors--connect`.

## Étape 3 — Schéma DB

Pas de nouvelle table : on réutilise `lagostina_media_kpis` qui contient déjà `channel`, `kpi_name`, `week`, `actual`, `objective`, `budget_spent`, `budget_allocated`. On ajoute une convention `week` = `'YYYY-MM'` pour le mensuel et `week = 'TOTAL'` pour la ligne globale fiscale.

Nouvelle petite table de config :

```sql
CREATE TABLE public.lagostina_google_ads_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id text NOT NULL,
  sheet_name text NOT NULL DEFAULT 'Sheet1',
  range text NOT NULL DEFAULT 'A1:Z200',
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  updated_at timestamptz DEFAULT now()
);
-- GRANTs + RLS : admin/team uniquement (lecture+écriture), pas d'anon
```

## Étape 4 — UI admin (LagostinaAdmin)

Petit bloc "Google Ads SEA" :
- Champ URL du Google Sheet (l'edge function extrait le spreadsheetId).
- Champ nom d'onglet + range (optionnels, valeurs par défaut).
- Bouton **Synchroniser maintenant** (déclenche l'edge function).
- Affichage `last_synced_at` + statut succès/erreur.

## Étape 5 — Edge Function `sync-google-ads-sea`

`supabase/functions/sync-google-ads-sea/index.ts`
- Auth : accepte JWT admin/team **ou** header `x-cron-secret` (cron quotidien).
- Lit la config dans `lagostina_google_ads_config`.
- Appelle `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/{id}/values/{range}` avec `LOVABLE_API_KEY` + `GOOGLE_SHEETS_API_KEY`.
- Parse les colonnes (mapping par header) → calcule ROAS si absent (`conv_value / cost`), CTR si absent (`clicks / impressions`).
- Pour chaque ligne (mois ou TOTAL) : upsert dans `lagostina_media_kpis` avec `channel='sea'`, une ligne par KPI × période :
  - `kpi_name` ∈ `roas | cpc_moyen | ctr | impressions | conversions | budget_ratio`
  - `week` = `'YYYY-MM'` ou `'TOTAL'`
  - `actual` = valeur, `budget_spent` / `budget_allocated` pour la ligne `budget_ratio`
  - `objective` : préservé si déjà saisi en DB (on ne l'écrase pas).
- Met à jour `last_synced_at` / `last_sync_status` / `last_sync_error`.

## Étape 6 — Cron quotidien

`pg_cron` + `pg_net`, 6 h du matin (Europe/Paris) :

```sql
select cron.schedule(
  'sync-google-ads-sea-daily',
  '0 5 * * *',  -- 05:00 UTC = 06:00 Paris hiver / 07:00 été
  $$ select net.http_post(
      url:='https://<ref>.supabase.co/functions/v1/sync-google-ads-sea',
      headers:='{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
      body:='{}'::jsonb) $$
);
```

## Étape 7 — Front (lecture)

`LagostinaMediatisation.tsx` (onglet SEA) et la Scorecard lisent déjà `lagostina_media_kpis`. Vérifs/ajustements légers du mapping `SEA_KPIS` pour inclure `budget_ratio` (déjà présent) et s'assurer que la période mensuelle s'affiche. Ajout d'un petit indicateur "Synchronisé le …" sous le titre SEA, lu depuis `lagostina_google_ads_config.last_synced_at`.

## Sécurité

- Edge function : JWT admin/team OU `x-cron-secret` (pattern projet existant).
- Pas d'exposition publique du spreadsheetId côté client (lecture limitée admin/team).
- Validation Zod du body et de la config.
- Pas de SQL dynamique.

## Hors scope

- API Google Ads officielle (rejetée — setup trop lourd).
- Granularité par campagne (rejetée — tu as choisi global + mensuel).
- META / TikTok (inchangés, alimentés par kDrive comme aujourd'hui).

## Pré-requis utilisateur avant build

1. **Tu** configures le rapport programmé Google Ads → Google Sheet (étape 1).
2. **Je** déclenche `standard_connectors--connect` pour le connecteur Google Sheets — tu choisis le compte Google qui a accès au Sheet.
3. **Tu** colles l'URL du Sheet dans l'UI admin une fois déployée.

## Fichiers touchés

- Migration : `lagostina_google_ads_config` + GRANTs/RLS.
- Nouveau : `supabase/functions/sync-google-ads-sea/index.ts` (+ entrée `verify_jwt = false` dans `supabase/config.toml`).
- Nouveau composant admin : `src/components/lagostina/GoogleAdsSeaConfig.tsx`, intégré à `src/pages/LagostinaAdmin.tsx`.
- Cron : insertion SQL `cron.schedule` (via tool insert, pas migration).
- Léger : `LagostinaMediatisation.tsx` (indicateur de dernière sync sur l'onglet SEA).
