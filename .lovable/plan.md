## Fix point 5 — Planification CRON `weekly-slack-excuses`

### Constat

- L'edge function `weekly-slack-excuses` existe déjà et fait correctement le travail (3 idées par client Target, basées sur URLs surveillées + 3 derniers CR + fiche client + projets associés, post Slack sur `#hubteam_sales`, exclusion des clients sans CR ni URL).
- Le déclenchement manuel depuis Réglages est déjà en place via `TestSlackExcuses.tsx`.
- **Problème** : le cron actuel est planifié à `0 9 * * 3` (mercredi 9h UTC = 10h ou 11h Paris), au lieu de la fenêtre demandée **entre 3h00 et 5h00**.

### Correction

Reprogrammer le cron `weekly-slack-excuses-wednesday` pour qu'il s'exécute le **mercredi entre 3h00 et 5h00 (heure de Paris)**.

Choix d'horaire : **mercredi 4h00 Paris** = `0 3 * * 3` en UTC en heure d'hiver (CET, UTC+1) et `0 2 * * 3` en heure d'été (CEST, UTC+2). pg_cron ne supporte pas les fuseaux horaires : on choisit un créneau qui reste **toujours dans la fenêtre 3h–5h Paris** quelle que soit la saison.

→ On planifie à `0 3 * * 3` UTC, ce qui donne :
- Heure d'hiver : 4h00 Paris ✅
- Heure d'été : 5h00 Paris ✅ (limite haute, dans la fenêtre)

### Implémentation

1. Supprimer l'ancien cron via `cron.unschedule('weekly-slack-excuses-wednesday')`.
2. Recréer le cron avec la nouvelle expression `0 3 * * 3` (en gardant le header `x-cron-secret` et l'appel POST vers la fonction edge).
3. Ne pas modifier l'edge function ni `TestSlackExcuses.tsx` — leur logique correspond déjà à ce qui est demandé.

### Détails techniques

- Mise à jour via `supabase--insert` (le cron contient des données spécifiques au projet, pas une migration).
- Vérifier après coup avec `SELECT jobname, schedule FROM cron.job` que le job est bien `0 3 * * 3`.

### Hors périmètre

- Aucune modification sur la logique de génération (URLs + 3 derniers CR + fiche client + projets associés est déjà implémenté dans `loadTargets` et `generateRelanceIdeas`).
- Aucune modification sur le bouton manuel `TestSlackExcuses` — déjà fonctionnel.