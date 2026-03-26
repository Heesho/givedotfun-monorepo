# give.fun — Design System v2

> Canonical visual design reference for give.fun. All design and implementation decisions should reference this document.

## Direction

**give.fun should feel like a premium, glass-forward financial interface with organic character.**

### Creative Thesis

**Core idea:** _Liquid glass over dark earth._

Every surface uses glassmorphism — frosted blur, transparency, and soft luminous borders. The app sits on a deep dark-brown canvas with cream text and green accents. It feels like a premium trading terminal designed by someone who loves nature.

### Product Personality

Emotional mix:
- 60% premium / refined / glassy
- 40% organic / alive / green

### Design Principles

1. Make value movement obvious in under one second.
2. Funding and mining come before speculation.
3. Every surface is glass — blur, transparency, soft borders.
4. Reserve bright semantic color for meaning, not decoration.
5. Use rounded corners (0.625rem) everywhere — nothing is sharp.
6. Animations are smooth, spring-based, and purposeful.
7. Typography is clean, modern, and uses title case (not ALL CAPS).

---

## Color System

### Base Palette

| Role | Token | Value | Usage |
|---|---|---|---|
| App background | `--background` | `hsl(50, 12%, 4%)` | Dark brown canvas |
| Primary text | `--foreground` | `hsl(30, 9%, 89%)` | Cream text, light fills |
| Surface | `--surface` | `hsl(0, 0%, 7%)` | Card/panel base (used with opacity) |
| Muted text | `--muted-foreground` | `hsl(30, 6%, 62%)` | Secondary text, labels |

### Brand Accents

| Role | Token | Value | Usage |
|---|---|---|---|
| Primary / positive | `--primary` | `hsl(142, 72%, 59%)` / `#4BE182` | Green — CTAs, gain, active states |
| Primary foreground | `--primary-foreground` | `hsl(135, 56%, 9%)` | Dark text on green backgrounds |
| Negative / loss | `--tertiary` | `hsl(62, 100%, 40%)` | Yellow — loss states, sell actions |
| Negative foreground | `--tertiary-foreground` | `hsl(60, 100%, 7%)` | Dark text on yellow backgrounds |

### Semantic Color Rules

- Primary green is for CTAs, positive movement, and active UI states.
- Yellow (tertiary) is for negative movement and sell/loss states.
- Always pair gain/loss color with a sign (+/−) and numeric value.
- For near-flat change (±0.50% or less), use muted-foreground instead of forcing green or yellow.
- `text-primary` for green text. `bg-primary` for green backgrounds.
- `text-[hsl(var(--tertiary))]` for yellow/loss text.

---

## Material System

### Glass Panel (`.slab-panel`, `.glass-panel`)

The default surface treatment. All cards, sections, and containers use this.

```css
background: hsl(var(--foreground) / 0.06);
backdrop-filter: blur(20px);
border: 1px solid hsl(var(--foreground) / 0.1);
border-radius: var(--radius); /* 0.625rem */
box-shadow: 0 8px 32px hsl(var(--primary-foreground) / 0.08);
```

### Glass Inset (`.slab-inset`)

For recessed areas inside panels — input containers, nested sections.

```css
background: hsl(var(--foreground) / 0.04);
border: 1px solid hsl(var(--outline-variant) / 0.1);
border-radius: var(--radius);
backdrop-filter: blur(8px);
```

### Data Row (`.data-row`)

For list items, transaction rows, leaderboard entries.

```css
background: hsl(var(--foreground) / 0.03);
border: 1px solid hsl(var(--foreground) / 0.06);
border-radius: var(--radius);
/* Hover: background 0.06, border 0.1 */
```

---

## Typography

### Font Stack

- **Headings / display / UI:** Metropolis
- **Body:** Metropolis
- **Data / monospace:** JetBrains Mono

### Text Casing Rules

**CRITICAL: Title case everywhere. No ALL CAPS except:**
- Ticker symbols (e.g., MLDY, PEPE, RNBW)
- Abbreviations (e.g., LP, USDC, ETH)

Everything else uses title case:
- ✅ "Explore" not "EXPLORE"
- ✅ "Recent Funding" not "RECENT FUNDING"
- ✅ "Today's Mining Pool" not "TODAY'S MINING POOL"
- ✅ "Your Position" not "YOUR POSITION"
- ✅ "Enter App" not "ENTER APP"
- ✅ "Buy" / "Sell" / "Mine" not "BUY" / "SELL" / "MINE"

### Type Scale

| Role | Size / Weight | Class |
|---|---|---|
| Page title | 2rem / 600 | `.page-title` |
| Section title | 1.125rem / 600 | Manual |
| Primary value | 1.75–2rem / 700 | Manual |
| Card value | 0.9375–1.0625rem / 600 | Manual |
| Label / metadata | 0.6875–0.8125rem / 500 | Manual |
| Kicker / category | 0.625rem / 500, tracking-[0.24em] | `.section-kicker` |

---

## Shape & Spacing

### Border Radius

- `var(--radius)` = `0.625rem` (10px) for everything
- User avatars: fully circular (`rounded-full`)
- Token logos: `rounded-[var(--radius)]`

### Borders

- Use `hsl(var(--foreground) / 0.1)` for panel borders (soft, luminous)
- Use `hsl(var(--foreground) / 0.06)` for subtle dividers
- Never use hard opaque borders

### Shadows

- Soft box-shadows for depth: `0 8px 32px hsl(var(--primary-foreground) / 0.08)`
- Button hover shadows for lift effect
- No hard drop shadows

### Spacing

- Tight vertical rhythm is good
- Breathing room around charts, hero values, and action bars
- Touch targets: 44px minimum

---

## Component Rules

### Buttons

- **Primary CTA (`.slab-button`):** Green fill, dark text, rounded, hover lift + glow
- **Loss/Sell (`.slab-button-loss`):** Yellow fill, dark text, rounded
- **Ghost (`.slab-button-ghost`):** Glass background with blur, frosted border
- **Liquid Glass (`.btn-liquid-glass`):** Frosted glass gradient, blur, hover lift
- **All buttons:** `border-radius: var(--radius)`, hover `translateY(-2px)`, `whileTap={{ scale: 0.98 }}`
- **Text:** Title case, NOT uppercase. "Buy" not "BUY". Exception: ticker symbols in buttons.

### Chips / Filters

- Active: `bg-primary text-primary-foreground`, rounded
- Inactive: glass background (`hsl(var(--foreground) / 0.06)`), rounded
- All: `border-radius: var(--radius)`

### Inputs (`.field-input`, `.input-liquid-glass`)

- Glass background with blur
- Rounded corners
- Focus: green border glow (`hsl(var(--primary) / 0.5)`)
- Placeholder: `text-muted-foreground`

### Charts

- Background: transparent over page background
- Up/positive: `hsl(var(--primary))` (green)
- Down/negative: `hsl(var(--tertiary))` (yellow)
- Flat: muted foreground

### Navigation

- **GlobalNav:** Fixed top bar with logo left, hamburger right
- **Landing page:** Transparent background, white hamburger lines, white logo text
- **Inner pages:** White background, black hamburger lines, black logo text
- **Menu overlay:** White background, black text, staggered slide-in animation
- **Active page:** Green text in menu
- **No bottom dock on desktop** — hamburger menu handles all navigation
- **Mobile:** Bottom dock may be used for quick access

### Modals / Sheets

- Glass panel background (`.glass-panel` or `.slab-panel`)
- Rounded corners
- Backdrop blur
- `position: fixed` with `overflow: hidden` on body to prevent scroll
- Content should NOT cause parent page to scroll

### Cards (Explore grid)

- Glass panel treatment
- Rounded corners on image and card
- Hover: subtle lift (`translateY(-2px)`) and border brightening

---

## Motion

### Easing

- Default: `cubic-bezier(0.16, 1, 0.3, 1)` — smooth deceleration
- Spring: `type: "spring", stiffness: 300, damping: 30`
- Button press: `whileTap={{ scale: 0.98 }}`

### Page Transitions

- Content slides up and fades in on mount (`y: 40 → 0, opacity: 0 → 1`)
- Duration: 700ms with stagger for child elements
- Nav menu: full-screen overlay with staggered link animation

### Scroll Animations

- `whileInView` for cards and sections
- Threshold: 0.1–0.2
- `triggerOnce: true`

---

## Accessibility

- Maintain 4.5:1 contrast for text
- Never rely on green/yellow alone — add sign, arrow, and copy
- Touch targets: 44px minimum
- Respect `prefers-reduced-motion`

---

## Screen Guidance

### Landing Page

- Full-screen video background (looping, muted, autoplay)
- Rotating blurb text (single sentence, fades between messages)
- "Enter App" button navigates to `/explore`
- Transparent nav overlaying video

### Explore

- Page title: "Explore" (title case)
- Glass card grid with images, sparklines, prices
- Search bar with glass input styling
- Filter chips: Bump / New / Top

### Fundraiser Detail

- Glass panels for Mining Pool, Your Position, About sections
- Chart with time range chips
- Buy/Sell buttons in title case
- Recent Funding as ledger list with data-row styling

### Launch

- Glass form panels
- All inputs use `.field-input` or `.input-liquid-glass`
- Image upload with glass inset treatment

### Profile

- Holdings list with data-row styling
- Portfolio value prominent
- Glass panel sections

### About

- Editorial layout with glass sections
- Larger spacing, calmer typography

---

## Decision Checklist

For any new component or screen:

1. Does it use glass panels with blur and soft borders?
2. Is the border-radius `var(--radius)` (0.625rem)?
3. Is all text in title case (no ALL CAPS except tickers/abbreviations)?
4. Are buttons rounded with hover lift animations?
5. Does it use `hsl(var(--foreground) / opacity)` for glass backgrounds?
6. Are gain/loss semantics preserved (green = gain, yellow = loss)?
7. Does it feel premium and refined, not raw or industrial?

When in doubt, use glass panel + title case + rounded corners.
