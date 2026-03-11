# give.fun — Design System

> Canonical visual design reference for give.fun. All design and implementation decisions should reference this document.

## Direction

**give.fun should feel like a permanent concrete market for living communities.**

### Creative Thesis

**Core idea:** _Concrete infrastructure overgrown with community._

Pure ecobrutalism. No glass, no blur, no translucency. Every surface is matte, structural, and opaque. The app is built from slabs, borders, and earth tones.

### Product Personality

The app should feel like public infrastructure, living capital, shared construction — credible but not sterile.

Emotional mix:
- 50% raw / industrial
- 50% organic / regenerative

### Design Principles

1. Make value movement obvious in under one second.
2. Funding and mining come before speculation.
3. Use bold structure, not decorative clutter.
4. Reserve bright semantic color for meaning, not general decoration.
5. Every surface is opaque and matte. No glass, no blur.
6. Keep the app dense, but never cramped.
7. Straight edges everywhere. Only avatars remain circular.

---

## Color System

### Base Palette

| Role | Name | Hex | Usage |
|---|---|---|---|
| App background | Basalt | `#151712` | Main background, deep surfaces |
| Primary text / light fill | Fog | `#E9E4DA` | Primary text, bright cards, primary CTA fill |
| Secondary surface | Wet Concrete | `#B7B0A2` | Separators, muted blocks, card accents |
| Brand accent | Moss | `#708B45` | Badges, active accents, supportive highlights |
| Cool secondary accent | Pond | `#5D7A73` | Depth, cool contrast, restrained chart/utility accents |

### Semantic Movement Colors

| Semantic | Name | Hex | Usage |
|---|---|---|---|
| Positive / up | Moss | `#708B45` | Price up, positive yield, successful claim states, upward sparkline |
| Negative / down | Storm | `#6B7A8E` | Price down, negative movement, failed/warning financial outcomes |

### Semantic Color Rules

- **Do not** use Moss as the default CTA color.
- **Do not** use Storm for generic destructive UI unless the action truly destroys value.
- Always pair gain/loss color with a sign (+/−), directional copy or arrow, and numeric value.
- For near-flat change (±0.50% or less), use neutral stone/zinc instead of forcing green or red.

### CSS Token Mapping

```css
--background: #151712;
--foreground: #E9E4DA;
--surface-muted: #B7B0A2;
--accent-moss: #708B45;
--accent-pond: #5D7A73;
--gain: #708B45;
--loss: #6B7A8E;
```

---

## Material System

### 1. Slab Surface (default)

Warm dark surface with straight edges, strong borders, quiet depth, concrete/stone tonality, architectural sectioning.

Use for: everything. Page backgrounds, stat cards, form sections, chart area backdrop, profile holdings rows, info sections, leaderboard containers, navigation, modals, controls.

### 2. Moss Surface

Restrained organic accent surface.

Use for: highlighted callouts, funding pool emphasis, selected "good" states (not price movement), recipient/mission emphasis.

Should feel earthy, not neon.

---

## Typography

### Font Stack

- **Headings / display:** Archivo
- **Body / UI:** Inter
- **Data / token values / addresses:** IBM Plex Mono

### Type Behavior

- Headings should feel compact, bold, and structural.
- Labels should be small, calm, and slightly spaced.
- Numbers must use tabular figures.
- Price, market cap, funded, and mined values should feel mechanically precise.

### Scale

| Role | Size / Weight |
|---|---|
| Screen title | 28 / 700 |
| Section title | 18 / 600 |
| Primary value | 28–32 / 700 |
| Card value | 15–17 / 600 |
| Label / metadata | 11–13 / 500 |

---

## Shape, Spacing, and Borders

### Radius

- `0px` for everything: cards, panels, buttons, inputs, chips, images
- Only user avatars remain circular

### Borders

- Use borders more than shadows.
- Prefer 1px to 1.5px visible outlines on surfaces.
- Strong structural dividers between sections.

### Shadows

- Avoid shadows almost entirely.
- If depth is needed, use border contrast and background color steps.

### Spacing

- Tight vertical rhythm is good.
- Preserve breathing room around charts, hero values, and action bars.
- Dense lists should still have obvious touch targets (44px minimum).

---

## Component Rules

### Buttons

- **Primary CTA:** Fog fill + Basalt text, 0px radius
- **Secondary CTA:** slab outline, 0px radius
- **Positive result state:** Moss text or tint, not full green fill everywhere

### Chips

- **Active filters:** solid Fog fill with Basalt text, 0px radius
- **Inactive filters:** subdued slab, 0px radius
- **Tags / addresses / external links:** concrete or secondary slab
- **Status pills:** semantic tint plus icon/text, 0px radius

### Charts

- Default background: transparent over slab
- Up chart: Moss
- Down chart: Storm
- Flat chart: neutral zinc / concrete
- Hover tooltip: opaque slab, not glass

### Navigation

- Bottom nav: opaque slab surface with strong top border
- Active icon: Fog or Moss
- Inactive icon: muted foreground

### Modals / Sheets

- Fully opaque slab surfaces
- Strong border separation
- No blur or translucency

### Token Logos

- Square with 0px radius
- Preferred fallback: Fog letter on Moss badge, square

---

## Motion

- Target 120–180ms for micro-interactions
- Use spring only where physicality helps
- Price changes can briefly tint the value background (Moss wash for up, Storm wash for down)
- Respect reduced motion everywhere

---

## Accessibility

- Maintain 4.5:1 contrast for text
- Never rely on green/red alone — add sign, arrow, and copy to change indicators
- Keep touch targets at or above 44px

---

## Screen-by-Screen Guidance

### Explore

**Intent:** A trading/feed hybrid for discovering live fundraising markets.

- Search bar: slab surface, 0px radius, strong border.
- List rows: concrete strips with border dividers.
- Sparklines use Moss (up), Storm (down), neutral stone (flat).
- Market cap stays neutral. Percentage change gets the semantic color.
- Active sort chip: solid Fog fill. Inactive chips: slab/subdued.
- Token logos: square, 0px radius.

**Mood:** "Market board installed in a greenhouse."

### Launch

**Intent:** A ritual, not a generic form.

- Main form sits on a brutalist canvas.
- Upload tile should feel like an inset opening in concrete.
- All inputs: 0px radius, strong borders.
- Primary action: Fog fill with Basalt text, not green.

**Mood:** "Casting a permanent object into the protocol."

### Fundraiser Detail

**Intent:** The strongest expression of the brand.

- Hero price + chart on a severe, quiet backdrop.
- Timeframe selector: slab chips, 0px radius.
- "Today's Mining Pool" should feel like a structural readout.
- "Your position" should feel dense and ledger-like.
- Action menu: opaque slab with strong borders.
- About / Stats / Recent Funding / Leaderboard: slab-based sections.

**Mood:** "Concrete finance with living momentum."

### Profile

**Intent:** Personal holdings and creator identity.

- Portfolio value: large and calm.
- Holdings rows: utilitarian and list-like.
- Slab-based tab controls.
- Launched fundraisers should feel like owned structures in the system.

### Info / About

**Intent:** Explain the protocol in a more editorial way.

- Slab sections throughout.
- Use larger spacing and calmer type than Explore.
- This page can carry more of the "ecological public infrastructure" narrative.

---

## Implementation Priority

1. `globals.css` semantic color variables
2. Button and chip utilities
3. Chart colors
4. Nav shell
5. Action menu / modal chrome
6. Fallback logo treatment

### Utility Classes

```
.surface-slab
.surface-slab-muted
.surface-moss
.chart-up
.chart-down
.text-gain
.text-loss
```

### What to Keep

- Mobile-first frame
- Dense route structure
- List-heavy market view
- Fixed bottom navigation
- Chart-centric fundraiser detail
- Clear launch flow

### What to Change

- Replace current grayscale semantic movement colors
- Stop using pure white buttons everywhere as the whole identity
- Introduce warm neutrals instead of cold generic black/zinc everywhere
- Make charts and price deltas semantically colored
- Make the app feel more architectural and less generic crypto dashboard
- Remove all border radius (except user avatars)
- Remove all glass/blur/translucency

---

## Decision Checklist

For any new component or screen:

1. Is the radius 0px? (Only avatars get circles)
2. Does the screen still read as a funding market first?
3. Are gain/loss semantics preserved and not diluted into branding?
4. Is the route dense but still scannable on mobile?
5. Are charts and hero values immediately legible?
6. Are all surfaces opaque and matte?
7. Does the result feel architectural instead of generic?

When in doubt, default to slab with strong borders and keep semantics neutral.
