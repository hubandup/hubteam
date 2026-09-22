# Migrer le module Achats de HubTeam vers Project Hub

Project Hub est une application séparée, avec sa propre base de données et une technologie différente (pas la même façon de construire les pages ni le même type de fonctions serveur). Je peux lire son code depuis ici, mais pas le modifier.

La bascule se fait donc en deux temps : **HubTeam produit un dossier de migration complet**, puis **on l'ouvre dans Project Hub** qui l'installe. HubTeam garde son module Achats en l'état pendant la transition, comme demandé.

## Ce que je prépare ici

Un dossier de migration téléchargeable contenant :

**1. La base de données**
Un fichier d'installation qui recrée à l'identique, dans Project Hub : fournisseurs, catégories d'achat, taux de TVA, réglages de société (dont les CGA et leur version), bons de commande et leur historique d'événements, ainsi que la numérotation automatique des bons de commande (PO-AAAA-000NN-HU) et les règles d'accès réservées aux administrateurs.

**2. Les données actuelles**
Un fichier de reprise avec le contenu réel d'aujourd'hui : 7 fournisseurs, 3 catégories, 2 taux de TVA, les réglages de société, 13 bons de commande et leurs 144 événements d'historique. Les identifiants et les numéros de commande sont conservés, ainsi que les liens déjà établis avec la comptabilité (fournisseurs et achats déjà rattachés côté facturation.pro). Les PDF ne sont pas copiés : ils se régénèrent à la demande depuis chaque fiche.

**3. Le code de référence**
Une copie des écrans (annuaire fournisseurs, liste et fiche des bons de commande, bloc de synthèse et alertes, réglages achats) et de toute la logique métier : génération du PDF avec les CGA en page 2, envoi au fournisseur par e-mail, lien avec la comptabilité (devis, création d'achat, synchronisation du statut), rapprochement quotidien des achats et indicateurs d'écarts, import et export.

**4. La marche à suivre**
Un mode d'emploi listant, dans l'ordre : installation de la base, reprise des données, clés d'accès à recréer dans Project Hub (comptabilité facturation.pro et service d'envoi d'e-mails), tâche automatique quotidienne de rapprochement, et contrôle final.

## Ce qu'il faudra faire dans Project Hub

Ouvrir le projet Project Hub et lui demander d'installer ce dossier. Comme la technologie y est différente, les écrans y seront reconstruits avec ses propres composants : le dossier sert de référence fonctionnelle exacte, pas de copier-coller. Je vous donnerai le message précis à y coller.

## Points d'attention

- Les auteurs des événements (qui a créé ou envoyé un bon de commande) sont des comptes HubTeam : les comptes correspondants dans Project Hub sont rapprochés par e-mail, et à défaut l'historique conserve le nom en texte.
- Les clés d'accès à la comptabilité et à l'envoi d'e-mails ne peuvent pas être transférées : elles devront être ressaisies dans Project Hub.
- Pendant la période de coexistence, ne créer les nouveaux bons de commande que dans un seul des deux outils, pour éviter deux numéros identiques.

## Détails techniques

- Export généré sous `/mnt/documents/migration-achats-project-hub/` : `01-schema.sql`, `02-donnees.sql`, `03-cron.sql`, `LISEZ-MOI.md`, `code/`.
- `01-schema.sql` : types `purchase_order_status`, `purchase_order_event_type`, `purchase_order_sync_status`, `supplier_sync_status` ; tables `suppliers`, `purchase_categories`, `vat_rates`, `company_settings`, `purchase_orders`, `purchase_order_events`, `po_sequences` ; fonctions `next_po_number`, `prevent_po_number_change`, `log_purchase_order_event`, `handle_updated_at` ; GRANT `authenticated` / `service_role` puis RLS via `public.is_admin()` (convention Project Hub) au lieu de `has_role(auth.uid(),'admin')`.
- `02-donnees.sql` : `INSERT ... ON CONFLICT (id) DO NOTHING` généré depuis les tables actuelles, y compris `facturation_pro_id`, `facturation_pro_purchase_id`, `terms_version`, `po_sequences` réaligné sur le dernier numéro.
- `code/` : `src/pages/achats/*`, `src/components/achats/*`, `src/hooks/usePurchasing.tsx`, `usePurchaseOrders.tsx`, `src/lib/purchasing.ts`, `po-export.ts`, `po-pdf-service.ts`, et les fonctions `generate-purchase-order-pdf`, `send-purchase-order`, `sync-supplier-facturation`, `sync-purchase-order-facturation`, `create-purchase-facturation`, `reconcile-purchases-facturation`, `facturation-pro-categories`, `facturation-pro-quote-lookup`, `import-suppliers-facturation`, `_shared/facturation-pro.ts`.
- Côté Project Hub, ces edge functions Deno deviennent des `createServerFn` avec le middleware `requireSupabaseAuth` (et `cron-auth` pour le rapprochement quotidien) ; secrets à recréer : `FACTURATION_PRO_API_ID`, `FACTURATION_PRO_API_KEY`, `FACTURATION_PRO_FIRM_ID`, `BREVO_API_KEY`.
- `03-cron.sql` : planification quotidienne du rapprochement (équivalent du cron 6h05 actuel), à adapter à l'URL d'appel de Project Hub.
