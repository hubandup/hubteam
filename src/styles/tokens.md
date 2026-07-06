# Hub+Up Design Tokens

Reference for the design system. **Never hardcode colors or radii in components** — always use these tokens via Tailwind classes or CSS variables.

## Colors

| Token | Tailwind class | CSS var | Light | Dark | Usage |
|---|---|---|---|---|---|
| Ink | `text-ink` `bg-ink` | `--ink` | #0F1420 | #F0F2F5 | Main text |
| Navy | `bg-navy` `text-navy` | `--navy` | #000C1F | #000C1F | Sidebar, dark buttons |
| Navy hover | `hover:bg-navy-hover` | `--navy-hover` | #1A2540 | — | Dark button hover |
| Lime | `bg-lime` `text-lime` | `--lime` | #CDF03A | #CDF03A | Accent, primary CTA, active |
| App bg | `bg-app-bg` | `--app-bg` | #F5F6F8 | #0B1220 | Page background |
| Card | `bg-card` | `--card` | #FFFFFF | #131C30 | Card surfaces |
| Border | `border-border` | `--border` | #E8EAEE | — | Card/section borders |
| Field | `border-field` | `--field-border` | #E2E5EA | — | Input borders |
| Label | `text-label` | `--label` | #5C6270 | — | Form labels |
| Muted | `text-muted-foreground` | `--muted-foreground` | — | — | Secondary text |

### Status pills
Use the `<StatusPill tone="…">` component instead of raw classes.

| Tone | Foreground | Background |
|---|---|---|
| `success` | #17A06B | #E7F6EE |
| `warning` | #8A6D00 | #FFF7D6 |
| `danger`  | #C9503F | #FDECEA |
| `info` / `neutral` | #5C6270 | #F1F3F5 |

## Radii

| Token | Tailwind class | Value | Usage |
|---|---|---|---|
| Input / Button | `rounded-input` `rounded-button` | 10px / 9999px | Inputs · buttons (pill) |
| Card | `rounded-card` | 18px | All cards, sections |
| Pill / Badge | `rounded-pill` `rounded-badge` | 9999px | Pills, chips, badges |

## Typography

Single family: **Instrument Sans** (400/500/600/700) applied to `body`.

| Role | Size | Weight |
|---|---|---|
| Display | 28–32px | 700 |
| H1 | 24px | 700 |
| H2 | 18px | 600 |
| H3 | 16px | 600 |
| Body | 14px | 400–500 |
| Label | 13px | 500 |
| Caption | 12–13px | 400 |

- Labels de formulaire en **casse normale** (jamais uppercase).
- Sur-titres de section : uppercase 10–11px, letter-spacing léger, `text-muted-foreground`. Utilisation parcimonieuse.

## Spacing

- Base 4px grid.
- Section gaps: **18–24px**.
- Card padding: **20–28px**.
- Border-radius: field/button **10**, card **16–18**, pill **9999**.

## Motion

- Transitions: **150–350 ms**.
- Skeleton pulse for loading states.
- No emojis in UI — use Lucide icons.

## Primitives

| Component | Path |
|---|---|
| `<StatusPill>` | `@/components/ui/status-pill` |
| `<SegmentedControl>` | `@/components/ui/segmented` |
| `<Chip>` | `@/components/ui/chip` |
| `<StatTile>` | `@/components/ui/stat-tile` |
| `<IconButton>` | `@/components/ui/icon-button` |
| `<EmptyState>` | `@/components/common/EmptyState` |
| `<AssistantCard>` | `@/components/ai/AssistantCard` |

Existing shadcn primitives (`Button`, `Card`, `Input`, `Textarea`, `Select`, `Tabs`, `Progress`, `Dialog`, `Sheet`, `Tooltip`, `Toast`) already respect the tokens.
