
# Export Design System HubTeam — Format Figma-like

Objectif : produire un kit réutilisable dans Figma (via plugins type "Tokens Studio" / "Variables Import") + une documentation lisible.

## Livrables (déposés dans `/mnt/documents/`)

1. **`hubteam-design-tokens.json`** — Format **W3C Design Tokens** (compatible Tokens Studio for Figma, Style Dictionary, et l'import natif Variables Figma)
   - `color/` — primitives (neutrals, neon yellow `#E8FF4C`, status) + sémantiques (background, foreground, primary, accent, destructive, muted, border, ring) en light & dark
   - `typography/` — familles (Instrument Sans, Roboto), tailles (H1 28, H2 32, body 15…), weights, line-heights
   - `spacing/` — échelle Tailwind utilisée (0, 1, 2, 3, 4, 5, 6, 8, 10, 12…)
   - `radius/` — `0` (règle projet : no border-radius)
   - `shadow/` — sm → xl (valeurs réelles du projet)
   - `motion/` — durées (150/200/300ms) + easings + keyframes (fade-in, slide-in)
   - `badges/status/` — variantes admin/team/client/agency + status projets

2. **`hubteam-design-system.md`** — Documentation Figma-like
   - Sections : Foundations (Color, Type, Spacing, Radius, Shadow, Motion), Components (Button, Card, Input, Badge, Dialog, SectionTitle, Widget), Patterns, Règles strictes (no radius, no serif, contrastes mobiles, safe areas)
   - Pour chaque composant : variants, tailles, états, specs px exactes, exemples d'usage

3. **`hubteam-figma-styles.json`** — Format **Figma Variables API** (import direct via plugin "Variables Import") avec collections `Color/Light`, `Color/Dark`, `Typography`, `Effects`

4. **`hubteam-tailwind-reference.css`** — Snippet des variables CSS HSL prêtes à recopier (pour designers qui veulent voir les vraies valeurs).

## Méthode

1. Relire `src/index.css`, `tailwind.config.ts` et 2-3 composants UI (Button, Card, Badge) pour extraire valeurs exactes (pas de devinette).
2. Convertir les HSL Tailwind → HEX dans le JSON (Figma travaille en HEX/RGB).
3. Générer les 4 fichiers en parallèle via un script Node.
4. QA : vérifier que le JSON Tokens Studio parse correctement (validation schema W3C).
5. Présenter les artifacts avec `<presentation-artifact>` pour téléchargement direct.

## Import côté Figma (instructions incluses dans le .md)

- **Option A (recommandée)** : plugin *Tokens Studio for Figma* → Import `hubteam-design-tokens.json`
- **Option B** : plugin *Variables Import* (Figma natif) → `hubteam-figma-styles.json`
- **Option C** : copier-coller manuel depuis le `.md`

## Hors scope

- Pas de génération de composants Figma `.fig` (impossible sans Figma API write — connecteur Figma local lecture seule).
- Pas de modification de code projet.
