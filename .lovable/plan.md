

## Objectif

Permettre la modification de l'intitulé d'une tâche en cliquant simplement dessus dans la vue Projets > ID > Tâches.

## Analyse de l'existant

Le composant `ProjectTasksNotebookTab.tsx` utilise un sous-composant `SortableTaskItem` pour afficher chaque tâche. Actuellement, le titre est affiché comme un simple paragraphe (`<p>`) non interactif :

```text
<p className={cn("flex-1 text-sm", ...)}>
  {task.title}
</p>
```

## Solution proposée

Transformer l'affichage du titre en un champ éditable inline qui :
1. S'affiche normalement comme du texte par défaut
2. Se transforme en `<Input>` au clic
3. Sauvegarde automatiquement lorsque l'utilisateur appuie sur Entrée ou quitte le champ (blur)
4. Annule les modifications avec Échap

## Modifications techniques

### Fichier : `src/components/project-details/ProjectTasksNotebookTab.tsx`

1. **Ajouter une nouvelle prop au composant `SortableTaskItem`** :
   - `onUpdateTitle: (taskId: string, newTitle: string) => void`

2. **Ajouter un état local dans `SortableTaskItem`** :
   - `isEditingTitle` : booléen pour savoir si on est en mode édition
   - `editedTitle` : valeur temporaire du titre en cours d'édition

3. **Remplacer le paragraphe par un composant conditionnel** :
   - En mode normal : `<p>` cliquable avec curseur texte
   - En mode édition : `<Input>` avec gestion des événements clavier

4. **Ajouter la fonction `handleUpdateTitle` dans le composant parent** :
   - Mise à jour optimiste du titre dans l'état local
   - Appel Supabase pour persister la modification
   - Gestion d'erreur avec rollback

### Comportement utilisateur

| Action | Résultat |
|--------|----------|
| Clic sur le titre | Passage en mode édition, focus automatique |
| Touche Entrée | Sauvegarde et sortie du mode édition |
| Touche Échap | Annulation des modifications |
| Clic ailleurs (blur) | Sauvegarde si le titre a changé |

## Rendu visuel

```text
Mode normal :
┌────────────────────────────────────────────────────────────┐
│ ≡  ☐  Titre de la tâche                     👤  📅  💬  🗑 │
└────────────────────────────────────────────────────────────┘

Mode édition (après clic sur le titre) :
┌────────────────────────────────────────────────────────────┐
│ ≡  ☐  [Titre de la tâche_____________]      👤  📅  💬  🗑 │
└────────────────────────────────────────────────────────────┘
```

## Avantages

- Expérience utilisateur fluide et intuitive
- Pas de dialog/popup : édition directe en place
- Mise à jour optimiste pour une réactivité immédiate
- Cohérent avec le style "notebook" déjà en place (ajout de tâche avec Entrée)

