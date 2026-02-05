

# Integration SwissTransfer dans le menu lateral

## Contexte

SwissTransfer d'Infomaniak ne dispose pas d'API REST publique pour creer des transferts programmatiquement. L'approche retenue est d'integrer le site SwissTransfer.com dans un popup (Dialog) au sein de l'application, accessible depuis le menu lateral.

## Approche technique

L'integration se fera via un **iframe** embarquant `https://www.swisstransfer.com` dans un composant Dialog plein ecran. Un bouton sera ajoute dans la Sidebar (desktop) et un acces dans le header mobile.

### Fichiers a creer

1. **`src/components/SwissTransferDialog.tsx`** - Nouveau composant contenant :
   - Un composant `Dialog` (plein ecran ou quasi plein ecran) avec un iframe pointant vers `https://www.swisstransfer.com`
   - L'iframe occupera toute la zone disponible du dialog
   - Un bouton de fermeture en haut a droite
   - Le dialog sera controle par un state `open` / `onOpenChange`

### Fichiers a modifier

2. **`src/components/Sidebar.tsx`** - Ajouter un bouton SwissTransfer :
   - Ajouter une icone `ArrowUpFromLine` (ou `Upload`) de lucide-react pour representer le transfert
   - Placer le bouton dans le `SidebarMenu`, entre les items de navigation existants et le bouton "Settings"
   - Au clic, il ouvre le `SwissTransferDialog` au lieu de naviguer vers une route
   - Le bouton sera visible pour tous les roles (admin, team, agency, client)

3. **`src/components/MobileBottomNav.tsx`** ou **`src/components/Layout.tsx`** - Acces mobile :
   - Ajouter un bouton SwissTransfer dans le header mobile (a cote des icones ThemeToggle et NotificationBell)
   - Meme comportement : ouvre le dialog avec l'iframe

## Details d'implementation

### Composant SwissTransferDialog

```text
+--------------------------------------------------+
|  [X]                SwissTransfer                 |
+--------------------------------------------------+
|                                                   |
|          (iframe: swisstransfer.com)              |
|                                                   |
|      Zone de drop / ajout de fichiers             |
|      + formulaire email / lien                    |
|                                                   |
+--------------------------------------------------+
```

- Le Dialog utilisera `max-w-[90vw] max-h-[90vh]` pour occuper la majorite de l'ecran
- L'iframe aura `width: 100%` et `height: 80vh` minimum
- Attributs iframe : `allow="clipboard-write"` pour permettre la copie de liens

### Integration Sidebar

- Le bouton sera un `SidebarMenuItem` stylise de la meme facon que les autres items
- Il utilisera un `button` au lieu d'un `NavLink` car il ne navigue pas vers une route
- Position : juste avant le bouton "Settings" ou en dernier dans la liste principale

### Consideration importante

L'iframe fonctionnera car SwissTransfer.com autorise l'embarquement (pas de header `X-Frame-Options: DENY`). Si toutefois SwissTransfer bloque l'iframe, un fallback ouvrira automatiquement le site dans un nouvel onglet avec `window.open('https://www.swisstransfer.com', '_blank')`.

## Risques et fallback

- **Blocage iframe (X-Frame-Options)** : Si SwissTransfer bloque l'iframe, le composant detectera l'erreur et proposera d'ouvrir dans un nouvel onglet
- **CSP (Content Security Policy)** : Il faudra peut-etre ajuster les headers si le projet a des restrictions strictes

