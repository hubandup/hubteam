

# Mise a jour du LINKEDIN_ORG_ID

## Contexte
L'ID organisation actuellement configure (`231157227`) est l'ID de l'application LinkedIn Developer, pas celui de la page entreprise. Le bon ID est `76490251`.

## Action requise

1. Mettre a jour le secret `LINKEDIN_ORG_ID` avec la valeur `76490251`
2. Redeploy de la fonction `fetch-linkedin-posts` pour prendre en compte le changement
3. Test de l'autorisation OAuth via le lien : `https://ytjxeypquqkrmbmhzfqi.supabase.co/functions/v1/linkedin-oauth-callback`
4. Test de recuperation des posts une fois autorise

