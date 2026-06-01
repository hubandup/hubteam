# Plan : Création d'utilisateur avec mot de passe provisoire

## Objectif
Permettre à l'admin, lors de la création d'un nouvel utilisateur, de **choisir entre** :
1. **Envoyer une invitation par email** (comportement actuel)
2. **Créer le compte avec un mot de passe provisoire** défini par l'admin, à communiquer manuellement à l'utilisateur

L'utilisateur devra changer ce mot de passe à sa première connexion.

## UX — `InviteUserDialog.tsx`

Ajouter dans le dialog :
- Un **toggle / radio** : « Envoyer une invitation par email » | « Définir un mot de passe provisoire »
- Si "mot de passe provisoire" sélectionné :
  - Champ **Mot de passe provisoire** (avec bouton 👁 afficher/masquer)
  - Bouton **Générer** (génère 12 caractères aléatoires sûrs)
  - Champ **Prénom** et **Nom** (optionnels — utiles puisqu'il n'y aura pas d'étape SetPassword côté utilisateur)
  - Validation : min 8 caractères
- Après création : afficher un **écran de confirmation** dans le dialog avec :
  - Email + mot de passe en clair
  - Bouton **Copier les identifiants**
  - Mention : « Communiquez ces identifiants à l'utilisateur de manière sécurisée. L'utilisateur devra changer son mot de passe à la première connexion. »

## Backend — Edge Function

Étendre `supabase/functions/invite-user/index.ts` pour accepter un nouveau mode :

```ts
{ email, role, mode: 'invite' | 'password', password?, firstName?, lastName? }
```

Si `mode === 'password'` :
- Valider le password (≥ 8 caractères)
- Appeler `supabaseAdmin.auth.admin.createUser({
    email, password,
    email_confirm: true,            // pas de vérification email
    user_metadata: { role, first_name, last_name, must_change_password: true }
  })`
- Le trigger `handle_new_user()` existant assignera le rôle automatiquement
- **Ne pas** envoyer d'email Brevo
- Retourner `{ success: true, mode: 'password' }`

Le mode `invite` (par défaut) reste inchangé.

## Forcer le changement de mot de passe à la 1re connexion

- Le flag `must_change_password: true` est stocké dans `user_metadata` à la création
- Dans `useAuth.tsx` (listener `onAuthStateChange`, événement `SIGNED_IN`) :
  - Si `session.user.user_metadata.must_change_password === true` → `navigate('/auth/set-password?forceChange=1')`
- Dans `SetPassword.tsx` :
  - Détecter le mode `forceChange` (via query param ou metadata)
  - Adapter le titre : « Vous devez définir un nouveau mot de passe »
  - Empêcher la sortie tant que le mot de passe n'est pas changé
  - À la soumission : `updateUser({ password, data: { must_change_password: false } })`

## Sécurité
- Garde admin existante (vérif role) déjà en place — réutilisée
- Rate limit existant (10/h par admin) — appliqué aux deux modes
- Mot de passe jamais loggé côté serveur
- Mot de passe affiché côté client uniquement après création réussie, dans le dialog

## Fichiers modifiés
- `src/components/settings/InviteUserDialog.tsx` — UI à 2 modes + écran de confirmation
- `supabase/functions/invite-user/index.ts` — branche `mode === 'password'`
- `src/hooks/useAuth.tsx` — redirection si `must_change_password`
- `src/pages/SetPassword.tsx` — gestion du mode "force change"

## Hors scope
- Pas d'envoi automatique du mot de passe par email (volontairement — l'admin le communique de manière sécurisée hors-canal)
- Pas de modification du schéma DB (le flag vit dans `user_metadata`)
