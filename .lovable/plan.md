## Objectif
Recalculer le **CA prévisionnel M+1 à M+3** avec uniquement :

1. Les devis Facturation.PRO retournés par le filtre **« À facturer »**.
2. Les devis **acceptés** dont le montant HT restant à facturer est positif.
3. Les factures récurrentes dont une échéance tombe réellement dans M+1, M+2 ou M+3.

## Règles de calcul
- Fusionner les devis « À facturer » et acceptés par leur identifiant afin d’éviter tout doublon.
- Calculer chaque solde par : `max(montant HT du devis − montant HT déjà facturé, 0)`.
- Exclure les devis soldés, ignorés, sans solde restant ou non éligibles aux deux statuts demandés.
- Affecter un devis au mois correspondant à sa date Facturation.PRO `term_on`.
- **Exclure du prévisionnel les devis échus**, sans les reporter automatiquement sur M+1.
- Exclure également les devis sans date exploitable ou dont la date est hors de M+1 à M+3.
- Conserver les occurrences futures des factures récurrentes, ventilées sur leur mois réel.

## Interface
- Mettre à jour le texte explicatif sous « Évolution du CA » pour préciser que les devis échus et hors période sont exclus.
- Conserver la ligne distincte du mois courant à 91 371 €, qui repose sur les factures HT déjà émises et ne s’ajoute pas au total M+1 à M+3.

## Validation
- Déployer la fonction de calcul corrigée.
- Relancer le calcul avec les données Facturation.PRO actuelles.
- Vérifier le détail M+1, M+2 et M+3 ainsi que l’égalité entre les composantes et le total affiché.