
## Contexte

Looker Studio **n'a pas d'API de lecture publique** — impossible d'aspirer un rapport Looker. La bonne approche, que tu as choisie, est de se brancher **directement sur les sources** qui alimentent ton rapport Looker, puis de réagréger côté Scorecard.

Cibles retenues :
- **Google Sheets** (déjà tiré aujourd'hui via fichiers _DATA kDrive)
- **Google Ads** (régie SEA)
- **Meta Ads** (Facebook + Instagram)
- **TikTok Ads**

Fréquence : **hebdo + mensuel** via cron Edge Function.

## Ce qu'on va construire

### 1. Connexions aux 4 sources (via Lovable Connectors)

| Source | Connecteur Lovable | Auth | État |
|---|---|---|---|
| Google Sheets | `google_sheets` (gateway) | OAuth Google compte régie/HubAndUp | à connecter |
| Google Ads | pas de connecteur Lovable | **OAuth maison + Google Ads API** (developer token requis) | à mettre en place |
| Meta Ads | pas de connecteur Lovable | **Meta Marketing API** (Access Token long-lived sur l'app Meta) | à mettre en place |
| TikTok Ads | `tiktok` (gateway, business) | OAuth TikTok Business | à connecter, scopes Ads |

Pour Google Ads et Meta Ads il faudra des secrets dédiés (developer token, app ID/secret, access token long-lived). Je te guiderai pas-à-pas pour chacun au moment de l'implémentation.

### 2. Table de cache Scorecard normalisée

Nouvelle table `lagostina_scorecard_metrics` (clef = `source` + `mois` + `metric`), pour stocker les valeurs déjà agrégées et alimenter directement la Scorecard sans recalculer à chaque affichage.

```text
source   ∈ {google_sheets, google_ads, meta_ads, tiktok_ads}
period   = 'YYYY-MM' (mois fiscal Avr–Mar respecté)
metric   = impressions | clicks | spend | ctr | cpm | reach | views | …
value    = numeric
synced_at= timestamptz
```

### 3. Edge Function `sync-lagostina-scorecard`

Une seule fonction orchestratrice, qui :
- pour chaque source connectée, appelle l'API via la gateway (Sheets, TikTok) ou directement (Google Ads, Meta Ads)
- agrège par mois fiscal (Avr–Mar, conforme à la règle projet)
- upsert dans `lagostina_scorecard_metrics`
- log dans `lagostina_files_sync` (status `synced`/`error`)

### 4. Planification

- **Cron pg_cron** : tous les lundis 6h (hebdo) + 1er du mois 6h (mensuel)
- Header `x-cron-secret` (conforme au standard projet)
- Bouton manuel "Synchroniser Scorecard" sur `/lagostina-admin` à côté du bouton kDrive existant

### 5. Branchement UI

Dans `LagostinaOverview.tsx` (Scorecard), remplacer la lecture des fichiers Excel statiques par une lecture React Query sur `lagostina_scorecard_metrics`. Conserver le fallback Excel pour les colonnes non encore couvertes (ex : Influence/RP qui restent en kDrive).

## Détails techniques

- **Pas de Looker** : aucune API publique de lecture côté Looker Studio → on ignore cette voie.
- **Google Sheets** : connecteur `google_sheets` Lovable existant — gateway `https://connector-gateway.lovable.dev/google_sheets/v4`. Tu me fourniras l'URL du Sheet et le nom de l'onglet.
- **Google Ads** : pas de connecteur Lovable → app OAuth Google Cloud + **developer token Google Ads** (validation Google ~1 semaine). Secrets requis : `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`.
- **Meta Ads** : Graph API v20 `/act_{ad_account_id}/insights`. Secrets : `META_ACCESS_TOKEN` (long-lived), `META_AD_ACCOUNT_ID`.
- **TikTok Ads** : connecteur `tiktok` Lovable (gateway), à reconnecter avec scopes `ads.read`/`reports`. Endpoint `/report/integrated/get/`.
- **Cron** : `pg_cron` + `pg_net` (déjà utilisés dans le projet) avec `x-cron-secret`.
- **Année fiscale** : agrégation Avr→Mars respectée pour rester cohérent avec la mémoire projet.

## Découpage de livraison

1. **Phase 1 — Google Sheets** (rapide, sans validation externe)
   - connexion `google_sheets`, table cache, edge function pour Sheets uniquement, branchement Scorecard, cron hebdo.
2. **Phase 2 — TikTok Ads** (connecteur déjà disponible)
   - reconnexion avec scopes Ads, extension de la fonction.
3. **Phase 3 — Meta Ads** (tu fournis Access Token + Ad Account ID)
   - extension fonction + secrets.
4. **Phase 4 — Google Ads** (le plus long, dépend du developer token Google)
   - extension fonction + OAuth refresh token, après obtention du developer token.

## Ce dont j'aurai besoin de toi pour démarrer la Phase 1

- L'**URL du Google Sheet** alimentant le Scorecard
- Le **nom de l'onglet** et la **plage** à lire (ex. `Scorecard!A1:Z100`)
- Confirmation que le compte Google qui sera connecté a bien accès à ce Sheet

Souhaites-tu démarrer directement par la **Phase 1 (Google Sheets)** pendant qu'on prépare en parallèle les accès Meta / TikTok / Google Ads ?
