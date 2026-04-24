## Contexte — ce qui pousse aujourd'hui sur Slack depuis une fiche client

Dans `CommercialTrackingTab.tsx`, **3 actions sur la fiche client** déclenchent automatiquement un message Slack via l'edge function `notify-target-relance` (canal `#hubteam_sales`) :

1. **Changement de statut commercial** vers `to_followup` → Slack + email (avec dédup serveur).
2. **Tout autre changement de statut commercial** → Slack uniquement (`event_type: 'status_change'`, lignes 229-241 et 320-332).
3. **Ajout d'une note / compte rendu** dans l'onglet Commercial → Slack uniquement (`event_type: 'note_added'`, lignes 683-692).

À côté, il existe aussi un **bouton manuel** "Notifier l'équipe sur Slack" (`ManualNotifyButton`, ligne 403+) qui n'est déclenché que sur clic explicite — celui-là, on le garde tel quel.

Les autres flux Slack du projet (`slack-sync` Feed↔Slack, `weekly-slack-excuses` cron Targets) **ne sont pas concernés** : ils ne se déclenchent pas sur des modifs de fiche client.

## Ce que je propose de faire

Couper les **deux notifications Slack automatiques** déclenchées par les modifs de fiche client, et **garder uniquement** :
- Le bouton manuel "Notifier l'équipe sur Slack" (clic explicite).
- La notif Slack + email du passage en statut `to_followup` (workflow Target structurant — dis-moi si tu veux aussi la couper).

### Modifications

**`src/components/client-details/CommercialTrackingTab.tsx`**
- Supprimer l'appel `notifyTeam({ event_type: 'status_change', ... })` dans les deux blocs `updateStatus` (≈ lignes 229-241 et 320-332). Garder l'`update` du statut + le toast "Statut mis à jour".
- Supprimer l'appel `notifyTeam({ event_type: 'note_added', ... })` après l'insertion d'une note (≈ lignes 683-692). Garder l'insert + le toast "Note ajoutée".
- Conserver intacts : bloc `to_followup` (sauf si tu demandes de le couper), `ManualNotifyButton`, helper `notifyTeam` (toujours utilisé par le bouton manuel).

L'edge function `notify-target-relance` reste inchangée — elle continue de fonctionner pour le bouton manuel et pour le passage en `to_followup`.

## Question rapide avant d'exécuter

Pour le passage de statut vers **"À relancer" (`to_followup`)** : c'est aujourd'hui une notif Slack + email automatique avec dédup. Je la **garde** ou je la **coupe aussi** ? (Par défaut je la garde car c'est un événement structurant du workflow Target, pas une "modif" classique.)
