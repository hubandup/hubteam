# Basculer les « Excuses de relance » sur Claude (Anthropic)

## Objectif
Remplacer Gemini par Claude d'Anthropic dans les deux surfaces qui génèrent des idées de relance commerciale :
1. **Fiche client → onglet Commercial → « Excuses de relance »** (edge function `suggest-followup`, actuellement `google/gemini-3-flash-preview`)
2. **Paramètres → Test Slack + cron hebdo #hubteam_sales** (edge function `weekly-slack-excuses`, actuellement `google/gemini-2.5-flash`)

Aucune autre fonction IA de l'app n'est modifiée (scraping, notifications, etc. restent sur leurs modèles actuels).

## Pré-requis à votre charge
Il faut créer une clé API chez Anthropic (Claude n'est pas dans le catalogue Lovable AI Gateway, donc pas d'accès « sans clé » possible) :

1. Aller sur https://console.anthropic.com/
2. Créer un compte / se connecter
3. Onglet **API Keys** → **Create Key**
4. Ajouter du crédit dans **Billing** (min ~5 €)
5. Copier la clé (`sk-ant-...`)

Je vous ouvrirai un formulaire sécurisé pour la coller (secret `ANTHROPIC_API_KEY`, stocké côté serveur, jamais exposé au navigateur).

## Choix du modèle Claude
Je propose **`claude-sonnet-4-5`** (dernier Sonnet, excellent rapport qualité/prix, très bon en rédaction FR nuancée — équivalent GPT-5 mini). Alternatives possibles à la demande : `claude-opus-4-1` (qualité max, ~5× plus cher) ou `claude-haiku-4-5` (économique).

## Ce qui change

### `supabase/functions/suggest-followup/index.ts`
- Retirer l'appel à `https://ai.gateway.lovable.dev/v1/chat/completions` avec header `Lovable-API-Key`
- Appeler `https://api.anthropic.com/v1/messages` avec headers `x-api-key: ${ANTHROPIC_API_KEY}` + `anthropic-version: 2023-06-01`
- Adapter le corps de requête au format Anthropic : `system` en champ séparé (pas dans `messages`), `max_tokens` obligatoire, réponse dans `content[0].text`
- Conserver TOUT le reste inchangé : prompt système, contexte (URLs scrappées, 3 derniers CR, cache Hub & Up + Google Alerts), parsing des 3 idées, stockage en base, gestion d'erreurs 429/402→surface UI

### `supabase/functions/weekly-slack-excuses/index.ts`
- Même bascule vers l'API Anthropic
- Conserver toute la logique : filtre clients Target, skip si ni CR ni URL, post Slack par client sur `#hubteam_sales`, x-cron-secret pour le cron

### Gestion d'erreurs Anthropic
- `401` → clé invalide (toast clair « Vérifiez ANTHROPIC_API_KEY »)
- `429` → rate limit (retry / message user)
- `529` (overloaded) → même traitement que 429
- Solde épuisé → message clair pointant vers console.anthropic.com/billing

## Détails techniques

Format Anthropic (référence : https://docs.anthropic.com/en/api/messages) :

```ts
const resp = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemPrompt,        // séparé, pas dans messages
    messages: [{ role: "user", content: userPrompt }],
  }),
});
const data = await resp.json();
const text = data.content?.[0]?.text ?? "";
```

Différences clés vs OpenAI-compatible qui étaient utilisées avant :
- `system` = champ top-level, pas un message role=system
- `max_tokens` obligatoire (mettre 1024, largement suffisant pour 3 idées courtes)
- Pas de `response_format` JSON natif — on garde le parsing texte actuel qui fonctionne déjà

## Vérification après implémentation
1. Sur la fiche client SEB (Target avec CR + URLs) → cliquer « Générer des excuses de relance » → 3 idées apparaissent
2. Paramètres → « Tester maintenant » sur `TestSlackExcuses` → au moins un client Target génère un message Slack
3. Consulter les logs de la fonction pour vérifier l'appel Anthropic (statut 200, latence)

## Coût indicatif
Claude Sonnet 4.5 : ~3 $ / M tokens input, ~15 $ / M tokens output. Un appel « excuse de relance » ≈ 2-5k tokens input + 300 tokens output ≈ **0,01 à 0,02 € par génération**. Volume actuel très faible → coût négligeable.

## Étapes d'exécution
1. Vous approuvez ce plan → passage en build mode
2. Je vous demande la clé `ANTHROPIC_API_KEY` via formulaire sécurisé
3. Une fois la clé confirmée, je modifie les deux edge functions
4. Test manuel via le bouton « Tester maintenant » + sur la fiche SEB
