
Objectif: corriger l’erreur de synchro partielle sur Lagostina. Le vrai problème n’est pas le fichier Excel ni les logs `content.js`/extensions navigateur. La cause visible dans les logs est claire : `new row violates row-level security policy for table "lagostina_top_keywords"`.

Constat
- Le parsing du fichier médiatisation fonctionne :
  - l’onglet `SEA` est bien lu
  - l’onglet `Top Keywords SEA` est bien détecté
  - les colonnes `clics / impressions / ctr / coût / conversions / cpc_moyen` sont bien reconnues
- L’échec survient au moment du `insert` sur `lagostina_top_keywords`.
- Les politiques RLS actuelles de `lagostina_top_keywords` autorisent seulement les utilisateurs ayant une ligne `lagostina_access(granted = true)`.
- Or, dans l’app, les rôles `admin` et `team` ont un accès Lagostina “par défaut” côté UI, sans forcément avoir de ligne dans `lagostina_access`.
- Résultat : un admin/team peut lancer la synchro, mais l’écriture dans `lagostina_top_keywords` est bloquée par la base.

Plan de correction
1. Corriger les politiques RLS de `lagostina_top_keywords`
- Remplacer les policies `SELECT / INSERT / UPDATE / DELETE` pour autoriser :
  - `admin`
  - `team`
  - ou un utilisateur avec `lagostina_access.granted = true`
- Aligner cette table sur la même logique que les autres tables Lagostina déjà étendues.

2. Vérifier la cohérence lecture/écriture
- S’assurer que la lecture des Top Keywords dans `LagostinaMediatisation.tsx` utilisera exactement la même règle d’accès que l’écriture.
- Éviter le cas où la synchro fonctionnerait mais l’affichage resterait vide pour certains rôles.

3. Renforcer la robustesse du sync média
- Garder `parseMediaFile` en l’état pour le parsing, car la détection du fichier est correcte.
- Ajouter une gestion d’erreur plus explicite autour du bloc Top Keywords pour que, si un souci réapparaît, le message indique clairement que l’échec vient des keywords et non du fichier SEA entier.
- Optionnel mais recommandé : journaliser séparément le nombre de KPI média importés et le nombre de keywords importés.

4. Valider le flux complet
- Relancer une synchronisation depuis kDrive avec un compte `admin/team`.
- Vérifier :
  - absence d’erreur 403 sur `lagostina_top_keywords`
  - disparition du message “Synchronisation partielle”
  - affichage effectif de `CPC / CTR / Budget dépensé`
  - affichage du tableau `Top Keywords SEA`

Détails techniques
- Fichiers concernés :
  - `supabase/migrations/...` : nouvelle migration pour corriger les policies RLS
  - éventuellement `src/lib/lagostina-parsers.ts` : message d’erreur/logging plus précis
- Cause racine :
  ```text
  UI: admin/team = accès automatique
  Base: lagostina_top_keywords = accès seulement via lagostina_access
  => incohérence d’autorisation
  ```
- Les erreurs `content.js`, `runtime/sendMessage`, `optibutton`, etc. ressemblent à du bruit venant d’extensions navigateur et ne sont pas la cause de l’échec de synchronisation.

Résultat attendu après implémentation
- La synchronisation médiatisation devient complète
- Les Top Keywords SEA s’insèrent correctement
- Les KPI SEA associés remontent sans erreur
- Le comportement d’accès Lagostina devient cohérent entre l’interface et la base
