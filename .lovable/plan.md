## Préparer l'infrastructure TikTok Ads (en attendant l'approbation)

Objectif : tout coder maintenant pour qu'il ne reste plus qu'à injecter le token et l'`advertiser_id` une fois TikTok ayant validé l'app dans 3 jours.

### 1. Base de données
Créer la table `lagostina_tiktok_ads_kpis` (même structure que `lagostina_media_kpis` pour Google Ads / Meta) :
- `date` (jour)
- `impressions`, `clicks`, `spend`, `ctr`, `cpc`, `cpm`
- `conversions`, `conversion_rate`, `cost_per_conversion`
- `video_views`, `video_view_rate` (spécifique TikTok)
- `campaign_id`, `campaign_name`, `adgroup_id`, `adgroup_name`
- RLS : lecture admin + utilisateurs autorisés Lagostina (même politique que les autres tables `lagostina_*`)
- GRANT pour `authenticated` + `service_role`

### 2. Secrets (préparés, vides pour l'instant)
- `TIKTOK_ACCESS_TOKEN` — long-lived token (à injecter après approbation)
- `TIKTOK_ADVERTISER_ID` — ID du compte publicitaire Lagostina

### 3. Edge Function : `sync-tiktok-ads`
- Appelle l'API TikTok Business `/v1.3/report/integrated/get/` (rapport quotidien)
- Récupère les KPIs des 30 derniers jours
- Upsert dans `lagostina_tiktok_ads_kpis`
- Auth via `x-cron-secret` (standard du projet)
- Gère le cas "token manquant" → log warning, ne plante pas

### 4. Cron job
- Planifié à 6h00 chaque jour (après Google Ads à 5h)
- Désactivé tant que `TIKTOK_ACCESS_TOKEN` est vide (early return dans l'edge function)

### 5. UI — Scorecard Lagostina
- Ajouter colonne "TikTok Ads" dans l'onglet Médiatisation
- Mêmes KPIs affichés que Google Ads / Meta (impressions, clics, CTR, CPC, dépense, conversions)
- Ajouter ligne "Vues vidéo" spécifique TikTok
- État vide propre : "Données disponibles après activation TikTok Ads"

### Détails techniques
- Endpoint TikTok : `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`
- Headers : `Access-Token: {TIKTOK_ACCESS_TOKEN}`
- Métriques demandées : `impressions, clicks, spend, ctr, cpc, cpm, conversion, conversion_rate, cost_per_conversion, video_play_actions, video_views_p100`
- Dimensions : `stat_time_day, campaign_id, adgroup_id`

### Ce qu'il restera à faire après approbation TikTok
1. Coller le `TIKTOK_ACCESS_TOKEN` dans les secrets
2. Coller le `TIKTOK_ADVERTISER_ID` dans les secrets
3. Tester l'edge function manuellement
4. Le cron prendra le relais automatiquement le lendemain matin
