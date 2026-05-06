## Diagnostic

Le cron `weekly-slack-excuses-wednesday` (jobid 57) **a bien tourné ce mercredi** à 08:00 UTC, mais l'edge function a renvoyé **401 Unauthorized**. Aucune relance n'a donc été postée sur Slack.

Deux problèmes distincts identifiés :

### 1. Mauvais secret (cause du 401)
La commande SQL du cron passe le header ainsi :
```
'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
```
Or `app.cron_secret` n'est **pas défini** au niveau de la base → le header est envoyé **vide**, et l'edge function rejette avec 401 (`Unauthorized`).

Tous les autres crons du projet utilisent le secret en clair dans le SQL :
```
'x-cron-secret':'7NaesFsguJx2kNEyn3@uqvLm5B9Le@9rjDmS0eS2'
```
C'est ce pattern qu'il faut appliquer ici aussi.

### 2. Mauvaise plage horaire
Le schedule actuel est `0 8 * * 3` = **10h00 Paris** (heure d'été) au lieu de la fenêtre 3h–5h Paris demandée dans `.lovable/plan.md`. Il faut repasser à `0 3 * * 3` UTC (≈ 4h–5h Paris selon saison).

## Plan de correction

1. `cron.unschedule('weekly-slack-excuses-wednesday')`
2. Recréer le job avec :
   - Schedule : `0 3 * * 3` (mercredi 4h–5h Paris)
   - Header `x-cron-secret` en dur (même valeur que les autres crons du projet)
   - Header `Authorization: Bearer <anon key>` conservé
3. Vérifier après coup avec `SELECT jobname, schedule FROM cron.job WHERE jobid = ...`
4. Optionnel : déclencher manuellement une exécution maintenant via `net.http_post` (ou via le bouton `TestSlackExcuses` déjà présent dans Réglages) pour que tu reçoives ton Slack du jour sans attendre mercredi prochain.

## Hors périmètre

- Aucune modification de l'edge function `weekly-slack-excuses` (logique OK).
- Aucune modif du composant `TestSlackExcuses.tsx`.
- Aucun autre cron touché.

## Question

Veux-tu que je **redéclenche manuellement** la génération maintenant (en plus de réparer le cron), pour que le Slack arrive aujourd'hui ?