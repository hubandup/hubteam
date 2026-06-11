
## Pourquoi Hub Team affiche 12 720 € au lieu de ~232 128 €

### Chaîne actuelle de remontée du CA
```text
Facturation.pro API
        │
        ▼
sync-facturation-pro-invoices  ──► table public.invoices
        │  (skip si client non mappé via facturation_pro_id)
        ▼
calculate-client-revenue       ──► clients.revenue_current_year
                                   (somme des invoices du 1er avril → 31 mars)
        │
        ▼
Page Finances : SUM(clients.revenue_current_year) WHERE active = true
```

### Ce que j'observe en base (exercice 04/2026 → 03/2027)

| Source | Montant | Détail |
|---|---|---|
| Facturation.pro (ton chiffre) | **232 128,32 € HT** | Vérité terrain |
| `invoices` locales sur la période | **37 080 €** | 18 factures, dernière le 10/04/2026 |
| `clients.revenue_current_year` (actifs) | **12 720 €** | Affiché dans Finances |
| Écart actif / total invoices | 24 360 € | CA porté par des clients `active = false` |
| Dernier `created_at` dans `invoices` | **11/04/2026** | Plus rien depuis 2 mois |
| Dernier `updated_at` dans `invoices` | 22/04/2026 | Idem |

### 4 causes cumulées identifiées

1. **La synchro des factures ne tourne plus depuis ~10 avril 2026.** `sync-facturation-pro-clients` continue (clients synchronisés hier) mais `sync-facturation-pro-invoices` n'a rien inséré depuis. Il manque ~195 000 € de factures avril → juin.
2. **Les factures dont le `customer_id` Facturation.pro n'est pas mappé sur un `clients.facturation_pro_id` sont silencieusement ignorées** (`skippedInvoices`). Aucune alerte UI, juste un log. 112 clients sur ~220 ont un `facturation_pro_id` aujourd'hui.
3. **Finances filtre `active = true`.** Tout client passé inactif sort du total même si ses factures sont sur l'exercice en cours (24 360 € perdus de cette façon).
4. **Risque HT/TTC.** La fonction stocke `parseFloat(fpInvoice.total)`. Sur l'API Facturation.pro, `total` = TTC alors que ton chiffre référence est HT (`total_pre_tax`). À confirmer mais ça ajoute un biais.

### Plan de correction

**1. Remettre en route la synchro factures**
- Vérifier le cron `pg_cron` planifiant `sync-facturation-pro-invoices` (job probablement désactivé ou en erreur) et le réarmer.
- Forcer un run immédiat pour rattraper avril-juin.

**2. Corriger l'unité (HT vs TTC)**
- Lire à la fois `total_pre_tax` (HT) et `total` (TTC) depuis l'API.
- Stocker `amount_ht` + conserver `amount` (TTC) sur `invoices` (ajout colonne via migration).
- Indiquer explicitement "HT" partout dans Finances pour aligner avec Facturation.pro.

**3. Ne plus perdre les factures orphelines**
- Quand un `customer_id` Facturation.pro n'a pas de client local : auto-créer une fiche client minimale (nom récupéré via API `customers/{id}.json`) plutôt que `continue`.
- Logguer dans une nouvelle table `facturation_sync_log` (date, factures synchro, ignorées, IDs manquants, erreur) pour visibilité.

**4. Aligner le calcul du CA affiché**
- Sur Finances, calculer le CA fiscal directement à partir de `invoices` (`SUM(amount_ht) WHERE invoice_date BETWEEN fy_start AND fy_end`), sans dépendre de `clients.revenue_current_year` ni du flag `active`. Cela garantit une parité exacte avec Facturation.pro.
- Conserver `revenue_current_year` uniquement pour le tri/affichage par client.

**5. UI : panneau "Santé de la synchro Facturation.pro"**
- Bloc en haut de Finances : dernière exécution OK, nombre de factures synchronisées, nombre ignorées (avec liste cliquable des `customer_id` orphelins), montant total Facturation.pro vs montant local, et bouton "Relancer la synchro".

### Détails techniques

- Fichiers à modifier : `supabase/functions/sync-facturation-pro-invoices/index.ts`, `supabase/functions/calculate-client-revenue/index.ts`, `src/pages/Finances.tsx`.
- Migration : ajouter `amount_ht numeric(12,2)` sur `public.invoices` + table `facturation_sync_log` (id, ran_at, synced, skipped, missing_customer_ids jsonb, total_ht numeric, total_ttc numeric, error text) avec GRANT + RLS admin-only.
- Cron : remettre `sync-facturation-pro-invoices` toutes les heures via pg_cron + `x-cron-secret`, et enchaîner `calculate-client-revenue` à la fin (déjà fait dans le code).
- Rattrapage immédiat après déploiement : déclenchement manuel via le bouton du nouveau bloc santé.

Veux-tu que j'embarque les 5 points d'un coup, ou qu'on commence par 1+4 (remettre la synchro + recoller l'affichage sur les invoices réelles) pour rétablir le bon chiffre tout de suite, et 2+3+5 dans une seconde itération ?
