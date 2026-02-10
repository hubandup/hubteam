

# Suite du plan - Axes restants

## 1. Home : personnalisation par role et MyWeeklySchedule

### Filtrage par role
- Importer `useUserRole` dans `Home.tsx`
- Les utilisateurs avec le role **agency** ne voient pas les cards financieres / CA
- Les utilisateurs avec le role **client** ne voient que les projets auxquels ils sont assignes (filtrer via `project_clients` ou `project_team`)
- Les admins et team voient tout comme actuellement

### Ajout MyWeeklySchedule
- Importer et afficher le composant `MyWeeklySchedule` (deja existant dans `src/components/home/MyWeeklySchedule.tsx`) dans la grille de widgets en bas de Home, a cote de TodoList/QuickNotes/TodayTasks

### Fichier modifie
- `src/pages/Home.tsx`

---

## 2. Dashboard admin : nouveaux KPIs

### 2.1 Taux de conversion prospects
- Compter les clients en stages `projet_valide` + `a_fideliser` (convertis)
- Diviser par le total historique de tous les clients (leads + convertis + sans_suite)
- Afficher en card KPI avec pourcentage et variation

### 2.2 CA mensuel
- Sommer les montants des invoices du mois en cours (table `invoices` ou `client_revenue`)
- Comparer avec le mois precedent, afficher la variation en %
- Card KPI avec fleche haut/bas selon la tendance

### 2.3 Charge equipe (bar chart horizontal)
- Compter les taches `in_progress` et `todo` par `assigned_to`
- Joindre avec `profiles` pour les noms
- Afficher en BarChart horizontal (Recharts, deja installe)

### Fichier modifie
- `src/pages/Dashboard.tsx` (ajout des 3 sections KPI)

---

## 3. Dashboard : filtres temporels

- Ajouter un composant Select en haut du Dashboard avec les options : 30 jours, 90 jours, 6 mois, 1 an
- Le filtre s'applique a : monthlyPerformance, revenueData, et les compteurs KPI
- Les requetes existantes seront enrichies d'un filtre `gte('created_at', dateDebut)` selon la periode selectionnee

### Fichier modifie
- `src/pages/Dashboard.tsx`

---

## 4. Synchronisation optimiste (TodoList et QuickNotes)

### TodoList (`src/components/home/TodoList.tsx`)
- Wrapper les operations add/toggle/delete dans `useMutation` avec `onMutate` pour mise a jour optimiste du cache React Query
- En cas d'erreur, rollback via `onError` + `context.previousData`

### QuickNotes (`src/components/home/QuickNotes.tsx`)
- Meme pattern : `useMutation` + `onMutate` pour add/update/delete de notes
- L'utilisateur voit le changement immediatement, la synchro se fait en arriere-plan

### Fichiers modifies
- `src/components/home/TodoList.tsx`
- `src/components/home/QuickNotes.tsx`

---

## Details techniques

### Fichiers a modifier
- `src/pages/Home.tsx` - Role filtering + MyWeeklySchedule
- `src/pages/Dashboard.tsx` - KPIs (conversion, CA, charge) + filtre temporel
- `src/components/home/TodoList.tsx` - Mutations optimistes
- `src/components/home/QuickNotes.tsx` - Mutations optimistes

### Ordre d'implementation
1. Home : role filtering + MyWeeklySchedule (rapide)
2. Dashboard : nouveaux KPIs + filtre temporel (plus complexe)
3. Synchronisation optimiste TodoList/QuickNotes (independant)

