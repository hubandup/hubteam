Apply a consistent design system to the Lagostina page, with the Editorial luxury dashboard direction as reference: a large rounded main container, rounded inner cards, and consistent radius on tables and controls. Use the Hub & Up palette (navy #0C1320, lime #DDF247) and Instrument Sans typography that the user selected.

Scope: only the Lagostina page and its tab components. No data or route changes.

Changes:

1. `src/pages/Lagostina.tsx`
   - Wrap the page content in a white rounded card (`rounded-3xl`, 24 px) with a subtle border and shadow, inside the existing app background.
   - Keep the existing header, tabs, and actions; only adjust spacing and radius.
   - Use navy/lime tokens for the active tab underline and the weekly badge.

2. `src/components/lagostina/ScorecardRECC.tsx`
   - Add `rounded-2xl` to the main scorecard table container.
   - Ensure the current-month highlight stays readable inside the rounded frame.
   - Keep the sticky first column and existing data logic.

3. `src/components/lagostina/LagostinaBudget.tsx`
   - Add `rounded-2xl` to the two KPI cards and the detail tables.
   - Keep the budget progress bars and warning badges.

4. `src/components/lagostina/LagostinaInfluenceRP.tsx`
   - Add `rounded-2xl` to KPI cards, chart cards, and tables.
   - Preserve the conditional left-border color logic.

5. `src/components/lagostina/LagostinaMediatisation.tsx`
   - Add `rounded-2xl` to KPI cards and chart/table containers.

6. `src/components/lagostina/LagostinaOverview.tsx`, `LagostinaContenus.tsx`, `ActivationPersonas.tsx`
   - Apply the same `rounded-2xl` radius to card containers if visible in the tabs.

Verification:
- Build the app (`bun run build`) to catch TypeScript/Tailwind errors.
- Capture a desktop screenshot of `/lagostina` to confirm the main container and inner cards have consistent radius and no visual regressions.
