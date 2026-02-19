# give.fun Redesign Implementation Plan — "Soft Brutalism with a Pulse"

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the give.fun Farcaster mini-app from a generic dark-mode crypto UI into a distinctive Eco-Brutalist aesthetic with concrete textures, botanical elements, and moss/prism reward accents.

**Architecture:** Foundation-first approach. Phase 1 replaces all design tokens (colors, shadows, gradients, typography utilities) in `tailwind.config.ts` and `globals.css`, instantly transforming every page. Phase 2 creates and integrates organic texture/botanical assets. Phase 3 applies targeted layout tweaks to each of the four main pages (Explore, Fundraiser Detail, Launch, Profile).

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 3.4, Framer Motion, Inter font (Bold + Regular), CSS animations for iridescent shimmer.

---

## Task 1: Replace Tailwind Color Tokens & Shadows

**Files:**
- Modify: `packages/app/tailwind.config.ts`

**Context:** The current config uses purple-based accent colors (`#8b5cf6`, `#7c3aed`, `#6d28d9`) with purple glow shadows. We're replacing with the "Engine & Earth" palette: Vibrant Moss (`#3DDC84`), Prism Flare (`#B2FF59`), Obsidian Concrete backgrounds, and Raw Slate for muted elements.

**Step 1: Replace the color, shadow, gradient, and animation values in tailwind.config.ts**

Replace the entire `colors` block inside `theme.extend` with:

```typescript
colors: {
  // Brand palette
  moss: {
    '300': '#6EE7A0',
    '400': '#3DDC84',
    '500': '#2BA866',
    '600': '#1F8A4F',
    '700': '#166B3B',
  },
  prism: {
    '300': '#D4FF99',
    '400': '#B2FF59',
    '500': '#8FCC47',
  },
  slate: {
    '400': '#8E8E8E',
    '500': '#6E6E6E',
    '600': '#4E4E4E',
  },
  concrete: {
    '800': '#1A1A1A',
    '700': '#242424',
    '600': '#2E2E2E',
    '500': '#3A3A3A',
  },
  // Keep semantic colors
  success: {
    '400': '#3DDC84',
    '500': '#2BA866',
    '600': '#1F8A4F',
  },
  warning: {
    '400': '#fbbf24',
    '500': '#f59e0b',
    '600': '#d97706',
  },
  error: {
    '400': '#f87171',
    '500': '#ef4444',
    '600': '#dc2626',
  },
  // CSS variable-based (updated in globals.css)
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  card: {
    DEFAULT: 'hsl(var(--card))',
    foreground: 'hsl(var(--card-foreground))',
  },
  popover: {
    DEFAULT: 'hsl(var(--popover))',
    foreground: 'hsl(var(--popover-foreground))',
  },
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },
  secondary: {
    DEFAULT: 'hsl(var(--secondary))',
    foreground: 'hsl(var(--secondary-foreground))',
  },
  muted: {
    DEFAULT: 'hsl(var(--muted))',
    foreground: 'hsl(var(--muted-foreground))',
  },
  accent: {
    DEFAULT: 'hsl(var(--accent))',
    foreground: 'hsl(var(--accent-foreground))',
  },
  destructive: {
    DEFAULT: 'hsl(var(--destructive))',
    foreground: 'hsl(var(--destructive-foreground))',
  },
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  chart: {
    '1': 'hsl(var(--chart-1))',
    '2': 'hsl(var(--chart-2))',
    '3': 'hsl(var(--chart-3))',
    '4': 'hsl(var(--chart-4))',
    '5': 'hsl(var(--chart-5))',
  },
},
```

Replace the `backgroundImage` block with:

```typescript
backgroundImage: {
  'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  'gradient-glow': 'linear-gradient(135deg, #3DDC84 0%, #2BA866 100%)',
  'gradient-subtle': 'linear-gradient(180deg, rgba(61, 220, 132, 0.05) 0%, transparent 100%)',
  'gradient-reward': 'linear-gradient(135deg, #B2FF59 0%, #3DDC84 100%)',
  'gradient-concrete': 'linear-gradient(180deg, #242424 0%, #1A1A1A 100%)',
},
```

Replace the `boxShadow` block with:

```typescript
boxShadow: {
  'glow': '0 0 20px rgba(61, 220, 132, 0.25)',
  'glow-lg': '0 0 40px rgba(61, 220, 132, 0.35)',
  'glow-sm': '0 0 10px rgba(61, 220, 132, 0.15)',
  'glow-reward': '0 0 30px rgba(178, 255, 89, 0.3)',
  'card': '0 1px 3px rgba(0, 0, 0, 0.3)',
  'card-hover': '0 4px 12px rgba(0, 0, 0, 0.4)',
  'slab': '0 2px 8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
  'input-inset': 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
},
```

Add a new `iridescent-shimmer` animation to the `animation` block:

```typescript
'iridescent': 'iridescent 3s linear infinite',
```

Add the corresponding keyframes:

```typescript
'iridescent': {
  '0%': { backgroundPosition: '0% 50%' },
  '50%': { backgroundPosition: '100% 50%' },
  '100%': { backgroundPosition: '0% 50%' },
},
```

Remove the entire `purple` and `surface` color blocks (no longer needed). Remove the old `primary` numbered shades (`'50'` through `'950'`) — keep only the CSS variable-based `DEFAULT` and `foreground`.

**Step 2: Verify the build compiles**

Run: `cd packages/app && npm run build 2>&1 | head -20`
Expected: `Compiled successfully` (there may be page-level warnings, but no tailwind config errors)

**Step 3: Commit**

```bash
git add packages/app/tailwind.config.ts
git commit -m "feat(redesign): replace color tokens with Eco-Brutalist palette"
```

---

## Task 2: Update CSS Variables & Global Styles

**Files:**
- Modify: `packages/app/app/globals.css`

**Context:** The CSS variables currently define a grayscale/white primary theme. We need to update them to the concrete/moss palette, add new utility classes for the brutalist typography treatment, and update existing utility classes to use the new colors.

**Step 1: Replace the entire globals.css with the new design system**

Replace the `:root` CSS variable block with:

```css
:root {
  /* Eco-Brutalist: Concrete + Moss */
  --background: 0 0% 10%;          /* #1A1A1A Obsidian Concrete */
  --foreground: 0 0% 98%;          /* #FAFAFA */

  --card: 0 0% 14%;                /* #242424 Deep Slab */
  --card-foreground: 0 0% 98%;

  --popover: 0 0% 14%;
  --popover-foreground: 0 0% 98%;

  /* Primary - Vibrant Moss */
  --primary: 149 66% 55%;          /* #3DDC84 */
  --primary-foreground: 0 0% 5%;   /* Dark text on moss */

  --secondary: 0 0% 14%;           /* #242424 */
  --secondary-foreground: 0 0% 98%;

  --muted: 0 0% 18%;               /* #2E2E2E Weathered Stone */
  --muted-foreground: 0 0% 56%;    /* #8E8E8E Raw Slate */

  --accent: 149 66% 55%;           /* Moss accent */
  --accent-foreground: 0 0% 5%;

  --destructive: 0 72% 51%;        /* Red */
  --destructive-foreground: 0 0% 100%;

  --border: 0 0% 20%;              /* Slightly visible border */
  --input: 0 0% 18%;
  --ring: 149 66% 55%;             /* Moss focus ring */

  --radius: 0.5rem;                /* 8px - more brutalist */

  /* Semantic */
  --gain: 149 66% 55%;             /* Moss green */
  --loss: 0 72% 51%;               /* Red */
}
```

Update `html` and `body` base styles:

```css
html {
  @apply bg-concrete-800;
}

body {
  @apply bg-concrete-800 text-foreground;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
  letter-spacing: -0.01em;
}
```

Replace `.token-logo` and `.token-logo-secondary`:

```css
.token-logo {
  @apply w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold;
  background: linear-gradient(135deg, #3DDC84 0%, #2BA866 100%);
}

.token-logo-secondary {
  @apply w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold;
  background: linear-gradient(135deg, #2E2E2E 0%, #1A1A1A 100%);
}
```

Replace `.card-elevated`:

```css
.card-elevated {
  @apply rounded-lg;
  background: #242424;
  border: 2px solid #2E2E2E;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
```

Replace `.list-item:hover`:

```css
.list-item:hover {
  background: rgba(61, 220, 132, 0.04);
}
```

Replace `.change-positive` and `.change-negative`:

```css
.change-positive {
  @apply text-sm tabular-nums;
  color: #B2FF59;
}

.change-negative {
  @apply text-sm tabular-nums;
  color: #ef4444;
}
```

Add new utility classes after the existing ones:

```css
/* Brutalist headline treatment */
.headline-brutal {
  @apply font-bold uppercase;
  letter-spacing: 0.05em;
}

/* Concrete slab card */
.slab {
  background: #242424;
  border: 2px solid #2E2E2E;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.03);
  position: relative;
  overflow: hidden;
}

/* Slab with moss left-border accent */
.slab-accent {
  border-left: 3px solid #3DDC84;
}

/* Recessed input (carved into concrete) */
.input-recessed {
  background: #1A1A1A;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  border: 1px solid #2E2E2E;
}

.input-recessed:focus {
  border-color: #3DDC84;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 0 0 1px #3DDC84;
}

/* Iridescent shimmer for minted tokens */
.shimmer-iridescent {
  background: linear-gradient(90deg, #ffffff, #93C5FD, #F9A8D4, #ffffff);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: iridescent 3s linear infinite;
}

@keyframes iridescent {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Moss glow pedestal (for hero token logos) */
.glow-pedestal {
  box-shadow: 0 8px 30px rgba(61, 220, 132, 0.3), 0 2px 8px rgba(61, 220, 132, 0.15);
}

/* Reward pulse for claim buttons */
.pulse-reward {
  animation: pulse-reward 2s ease-in-out infinite;
}

@keyframes pulse-reward {
  0%, 100% { box-shadow: 0 0 15px rgba(178, 255, 89, 0.2); }
  50% { box-shadow: 0 0 30px rgba(178, 255, 89, 0.5); }
}
```

**Step 2: Verify the build**

Run: `cd packages/app && npm run build 2>&1 | head -20`
Expected: `Compiled successfully`

**Step 3: Commit**

```bash
git add packages/app/app/globals.css
git commit -m "feat(redesign): update CSS variables and add brutalist utility classes"
```

---

## Task 3: Create Organic Texture & Botanical Assets

**Files:**
- Create: `packages/app/public/textures/concrete-dark.svg`
- Create: `packages/app/public/textures/concrete-slab.svg`
- Create: `packages/app/public/botanicals/vine-divider.svg`
- Create: `packages/app/public/botanicals/vine-ring.svg`
- Create: `packages/app/public/botanicals/corner-moss.svg`
- Create: `packages/app/public/botanicals/fern-frond.svg`
- Create: `packages/app/public/botanicals/fern-hero.svg`
- Create: `packages/app/public/botanicals/empty-garden.svg`
- Create: `packages/app/public/botanicals/growth-vine.svg`
- Create: `packages/app/public/botanicals/leaf-prism.svg`

**Context:** All organic assets are SVGs for small file size and scalability. The concrete textures use SVG `<filter>` elements with `feTurbulence` for procedural stone grain. Botanical elements are stylized, minimal vector paths — not photorealistic. The aesthetic is "architectural illustration" not "nature photography".

**Step 1: Create the public directories**

```bash
mkdir -p packages/app/public/textures packages/app/public/botanicals
```

**Step 2: Create each SVG asset**

Create all 10 SVG files. Each should be:
- **Concrete textures**: Use `feTurbulence` with `type="fractalNoise"` for stone grain effect. Dark tones (#1A1A1A to #2E2E2E). Tile seamlessly. Keep under 2KB each.
- **Vine divider**: A horizontal organic vine/tendril path, ~400px wide, ~30px tall. Color: #3DDC84 at varying opacities. Includes small leaf shapes along the path.
- **Vine ring**: A circular vine border, ~100px square. Small leaves and tendrils wrapping around a circle. Color: #3DDC84/#2BA866.
- **Corner moss**: A triangular cluster of small moss/fern fronds, ~80px square. Positioned for top-right corner placement. Colors: #3DDC84, #2BA866 with opacity variation.
- **Fern frond (large)**: A sweeping fern frond, ~300x500px. Single elegant curved stem with alternating leaflets. Color: #3DDC84 at low opacity (built-in).
- **Fern hero**: A lush composition of multiple fern fronds and vine tendrils, ~500x400px. For profile page background. Colors: #3DDC84, #2BA866.
- **Empty garden**: A centered botanical illustration — wilted/dormant plant with potential for growth. ~200x200px. Muted colors (#4E4E4E, #6E6E6E) to convey "not yet grown".
- **Growth vine**: A simple horizontal vine that can be scaled in width via CSS. ~200x20px. Color: #3DDC84.
- **Leaf prism**: A small leaf icon, ~16x16px. Color: #B2FF59 (Prism Flare). Used as a badge icon for donated-earned tokens.

**Step 3: Verify assets are accessible**

Run: `ls -la packages/app/public/textures/ packages/app/public/botanicals/`
Expected: All 10 SVG files listed.

**Step 4: Commit**

```bash
git add packages/app/public/textures/ packages/app/public/botanicals/
git commit -m "feat(redesign): add organic texture and botanical SVG assets"
```

---

## Task 4: Update UI Primitives (Button, Card, Input)

**Files:**
- Modify: `packages/app/components/ui/button.tsx`
- Modify: `packages/app/components/ui/card.tsx`
- Modify: `packages/app/components/ui/input.tsx`

**Context:** The UI primitives need to reflect the brutalist aesthetic. Buttons get moss/prism color variants. Cards become concrete slabs. Inputs get the recessed-into-concrete treatment. These changes cascade to every component using these primitives.

**Step 1: Update button.tsx**

Add two new variants to the `buttonVariants` CVA config:

```typescript
moss: "bg-moss-400 text-concrete-800 font-bold uppercase tracking-wider shadow-glow hover:bg-moss-300 hover:shadow-glow-lg",
prism: "bg-prism-400 text-concrete-800 font-bold uppercase tracking-wider shadow-glow-reward hover:bg-prism-300 pulse-reward",
```

Change the `default` variant from `"bg-primary text-primary-foreground shadow hover:bg-primary/90"` to:

```typescript
default: "bg-moss-400 text-concrete-800 font-bold shadow hover:bg-moss-300",
```

Update `border-radius` in the base class string from `rounded-md` to `rounded-lg` (8px).

**Step 2: Update card.tsx**

Change the `Card` component's default className from:
```
"rounded-xl border bg-card text-card-foreground shadow"
```
to:
```
"slab text-card-foreground"
```

This applies the concrete slab treatment (defined in globals.css Task 2).

**Step 3: Update input.tsx**

Change the Input's default className to use the recessed concrete styling. Replace the entire className string:

From: `"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"`

To: `"flex h-9 w-full rounded-lg input-recessed px-3 py-1 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"`

**Step 4: Verify the build**

Run: `cd packages/app && npm run build 2>&1 | head -20`
Expected: `Compiled successfully`

**Step 5: Commit**

```bash
git add packages/app/components/ui/button.tsx packages/app/components/ui/card.tsx packages/app/components/ui/input.tsx
git commit -m "feat(redesign): update UI primitives with brutalist styling"
```

---

## Task 5: Update NavBar & Token Logo Components

**Files:**
- Modify: `packages/app/components/nav-bar.tsx`
- Modify: `packages/app/components/token-logo.tsx`

**Context:** The NavBar needs the concrete background treatment and moss-green active states. The TokenLogo needs the vine ring border and updated gradient.

**Step 1: Update nav-bar.tsx**

Change the outer `<nav>` background from `bg-zinc-800` to `bg-concrete-800`.

Change the inner `<div>` background from `bg-background` to `bg-concrete-800`. Add a top border: `border-t border-concrete-600`.

Change active icon color from `text-white` to `text-moss-400`.

Change inactive icon color from `text-zinc-500 hover:text-zinc-300` to `text-slate-400 hover:text-slate-300` (using our new slate colors, note: these are our custom `slate` not Tailwind's built-in `slate`).

**Step 2: Update token-logo.tsx**

Change the gradient from `from-emerald-500 to-emerald-700` to `from-moss-400 to-moss-600`.

Add a vine-ring border option. Add an optional `showVineRing` prop (default: `false`). When enabled, wrap the logo in a container that shows the vine-ring SVG behind it:

```tsx
if (showVineRing) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <img
        src="/botanicals/vine-ring.svg"
        alt=""
        className={`absolute ${vineRingSizeClass} pointer-events-none`}
        aria-hidden="true"
      />
      {/* existing logo rendering */}
    </div>
  );
}
```

The vine ring should be slightly larger than the logo (e.g., for `md-lg` (w-10), the ring container is `w-14 h-14`).

**Step 3: Verify the build**

Run: `cd packages/app && npm run build 2>&1 | head -20`
Expected: `Compiled successfully`

**Step 4: Commit**

```bash
git add packages/app/components/nav-bar.tsx packages/app/components/token-logo.tsx
git commit -m "feat(redesign): update NavBar with concrete bg and TokenLogo with vine ring"
```

---

## Task 6: Redesign Explore Page

**Files:**
- Modify: `packages/app/app/explore/page.tsx`

**Context:** The Explore page gets brutalist headers, slab-style sort tabs, concrete-textured card rows with corner moss, a fern background, and moss-colored sparklines.

**Step 1: Update the Explore page**

Changes to make:

1. **Page background**: Change outer `bg-zinc-800` to `bg-concrete-800`. Add the fern frond background image positioned bottom-right at low opacity.

2. **Header**: Change `<h1>` from `text-2xl font-semibold tracking-tight` with text "Explore" to `headline-brutal text-xl` with text "EXPLORE FUNDRAISERS". (The `headline-brutal` class handles uppercase, bold, letter-spacing.)

3. **Search bar**: Change `bg-secondary` to `input-recessed`. Change focus ring from `focus:ring-white/20` to `focus:ring-moss-400/40`. Change placeholder text from "Search coins..." to "Search fundraisers...".

4. **Sort tabs**: Replace the rounded-pill style with chunky slab tabs:
   - Active: `bg-transparent text-foreground border-b-[3px] border-moss-400 rounded-none`
   - Inactive: `bg-transparent text-muted-foreground hover:text-foreground border-b-[3px] border-transparent rounded-none`
   - Remove `rounded-full` from both states.

5. **Sparkline color**: In the `Sparkline` component, change `className="w-16 h-8 text-zinc-400"` to `className="w-16 h-8 text-moss-400"`.

6. **Card rows**: Each row gets:
   - Add a corner moss accent: `<img src="/botanicals/corner-moss.svg" className="absolute -top-1 -right-1 w-8 opacity-40 pointer-events-none" />` (requires wrapping row in `relative` container)
   - Change hover from `hover:bg-white/[0.02]` to `hover:bg-moss-400/[0.04]`

7. **Change indicator colors**: Positive changes use `text-prism-400` class. Keep negative as `text-red-400`.

8. **Empty states**: Replace the icon-only empty state with the botanical empty-garden SVG:
   ```tsx
   <img src="/botanicals/empty-garden.svg" className="w-24 h-24 mb-4 opacity-60" />
   <p className="headline-brutal text-[15px]">No fundraisers found</p>
   ```

9. **Background fern**: Add a decorative fern frond to the page layout, absolutely positioned:
   ```tsx
   <img
     src="/botanicals/fern-frond.svg"
     className="absolute bottom-20 right-0 w-48 opacity-[0.08] pointer-events-none select-none"
     aria-hidden="true"
   />
   ```

**Step 2: Verify the build**

Run: `cd packages/app && npm run build 2>&1 | head -20`
Expected: `Compiled successfully`

**Step 3: Commit**

```bash
git add packages/app/app/explore/page.tsx
git commit -m "feat(redesign): rework Explore page with brutalist aesthetic"
```

---

## Task 7: Redesign Fundraiser Detail Page

**Files:**
- Modify: `packages/app/app/fundraiser/[address]/client-page.tsx`

**Context:** The fundraiser detail page gets a hero section with vine-ring logo and moss-glow pedestal, concrete stat blocks with moss accent borders, a sticky donate CTA bar, and brutalist section headers. The price chart gets moss-colored lines.

**Step 1: Update the client-page.tsx**

Changes to make:

1. **Page background**: Change `bg-zinc-800` to `bg-concrete-800`. Add a background vine/fern decoration at top-left:
   ```tsx
   <img
     src="/botanicals/fern-frond.svg"
     className="absolute top-0 left-0 w-40 opacity-[0.10] pointer-events-none select-none rotate-180"
     aria-hidden="true"
   />
   ```

2. **Hero section** (token name, symbol, logo area at top):
   - Wrap the `TokenLogo` with `showVineRing={true}` and add `glow-pedestal` class to the container
   - Token name/symbol: apply `headline-brutal` to the token symbol display

3. **Stats grid**: Each stat item should be wrapped in a mini slab:
   ```tsx
   <div className="slab p-3">
     <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Market Cap</div>
     <div className="text-[15px] font-bold text-white">{value}</div>
   </div>
   ```
   Key financial stats (price, market cap) get `slab-accent` class for the moss left-border.

4. **Fundraiser-specific stats** (emission, halving, recipient): Group in their own slab section with a vine divider above:
   ```tsx
   <img src="/botanicals/vine-divider.svg" className="w-full h-4 opacity-30 my-4" aria-hidden="true" />
   ```

5. **Section headers**: "Leaderboard" → `<h2 className="headline-brutal text-[16px]">TOP DONORS</h2>`. Similar for other section headers.

6. **Donate button**: Change from white `bg-white text-black` to `bg-moss-400 text-concrete-800 font-bold uppercase tracking-wider`. Make it the dominant CTA.

7. **Claim button** (if claimable tokens): Use `bg-prism-400 text-concrete-800 font-bold uppercase tracking-wider pulse-reward`.

8. **Leaderboard**: Rank badges (#1-3) get `bg-moss-400/20 text-moss-400` styling. "You" badge: `bg-moss-400 text-concrete-800`.

9. **Donation history items**: Add a thin moss left border: `border-l-2 border-moss-400/30 pl-3`.

**Step 2: Verify the build**

Run: `cd packages/app && npm run build 2>&1 | head -20`
Expected: `Compiled successfully`

**Step 3: Commit**

```bash
git add packages/app/app/fundraiser/\[address\]/client-page.tsx
git commit -m "feat(redesign): rework Fundraiser detail page with eco-brutalist layout"
```

---

## Task 8: Redesign Launch Page

**Files:**
- Modify: `packages/app/app/launch/page.tsx`

**Context:** The launch form becomes "stacking slabs" — three distinct concrete sections separated by vine dividers. Form inputs get the recessed treatment, the launch button gets moss styling, and section headers get the brutalist uppercase treatment.

**Step 1: Update the launch page**

Changes to make:

1. **Page background**: Change `bg-zinc-800` to `bg-concrete-800`. Add a corner moss decoration:
   ```tsx
   <img
     src="/botanicals/corner-moss.svg"
     className="absolute top-4 right-4 w-16 opacity-40 pointer-events-none"
     aria-hidden="true"
   />
   ```

2. **Page header**: Change the title from standard styling to `headline-brutal text-xl`. Text: "CREATE A FUNDRAISER". Add subtitle: `<p className="text-slate-400 text-[14px] mt-1">Launch a perpetual funding campaign on Base</p>`.

3. **Form sections**: Wrap each logical group in a `slab` div with vine dividers between them:

   **Slab 1 — Identity**:
   ```tsx
   <div className="slab p-4">
     <h3 className="headline-brutal text-[13px] text-slate-400 mb-4 slab-accent pl-3">TOKEN IDENTITY</h3>
     {/* Logo upload, name, symbol fields */}
   </div>
   ```

   **Vine divider between slabs**:
   ```tsx
   <img src="/botanicals/vine-divider.svg" className="w-full h-4 opacity-30 my-3" aria-hidden="true" />
   ```

   **Slab 2 — Cause**:
   ```tsx
   <div className="slab p-4">
     <h3 className="headline-brutal text-[13px] text-slate-400 mb-4 slab-accent pl-3">YOUR CAUSE</h3>
     {/* Description, recipient, default message */}
   </div>
   ```

   **Slab 3 — Economics** (the advanced/collapsible section):
   ```tsx
   <div className="slab p-4">
     <h3 className="headline-brutal text-[13px] text-slate-400 mb-4 slab-accent pl-3">ECONOMICS</h3>
     {/* Liquidity, emission, halving */}
   </div>
   ```

4. **Logo upload area**: Change from standard dashed border to `border-2 border-dashed border-moss-400/50 rounded-lg bg-concrete-800`. On hover: `hover:border-moss-400 hover:shadow-glow`.

5. **Form input styling**: All `<input>` and `<textarea>` elements should use `input-recessed` class or the updated Input primitive. Labels: add `headline-brutal text-[11px] text-slate-400` treatment.

6. **Launch button**: Change from `bg-white text-black` to:
   ```tsx
   className="w-full py-3 bg-moss-400 text-concrete-800 font-bold uppercase tracking-wider rounded-lg hover:bg-moss-300 hover:shadow-glow transition-all"
   ```

7. **Advanced toggle**: Style the expand/collapse button as a concrete tab: `bg-concrete-600 hover:bg-concrete-500 text-slate-400 rounded-lg px-4 py-2`.

**Step 2: Verify the build**

Run: `cd packages/app && npm run build 2>&1 | head -20`
Expected: `Compiled successfully`

**Step 3: Commit**

```bash
git add packages/app/app/launch/page.tsx
git commit -m "feat(redesign): rework Launch page with stacking slabs layout"
```

---

## Task 9: Redesign Profile Page — "The Impact Garden"

**Files:**
- Modify: `packages/app/app/profile/page.tsx`

**Context:** The most brand-distinctive page. Gets the "Impact Garden" treatment: lush botanical header backdrop, heartbeat ticker for active donations, garden-themed tabs, iridescent shimmer on donated-earned token balances, and botanical empty states.

**Step 1: Update the profile page**

Changes to make:

1. **Page background**: Change `bg-zinc-800` to `bg-concrete-800`.

2. **Profile header backdrop**: Add the fern-hero SVG behind the profile header:
   ```tsx
   <div className="relative">
     <img
       src="/botanicals/fern-hero.svg"
       className="absolute top-0 left-0 w-full h-48 object-cover opacity-[0.12] pointer-events-none select-none"
       aria-hidden="true"
     />
     <div className="relative z-10 px-4 pb-2">
       {/* Header content */}
     </div>
   </div>
   ```

3. **Page title**: Change from `text-2xl font-semibold tracking-tight` with "Profile" to `headline-brutal text-xl` with text unchanged ("PROFILE").

4. **User avatar**: Apply the vine-ring treatment. Increase size from `w-12 h-12` to `w-20 h-20`. If no pfpUrl, use moss gradient: `from-moss-400 to-moss-600` instead of `from-zinc-500 to-zinc-700`.

5. **Portfolio value section**: Wrap in a slab with `slab-accent`:
   ```tsx
   <div className="slab slab-accent p-4 mb-3">
     <div className="headline-brutal text-[11px] text-slate-400 mb-1">PORTFOLIO VALUE</div>
     <div className="text-[28px] font-bold tabular-nums">{value}</div>
   </div>
   ```

6. **Heartbeat ticker** (new component): Add between portfolio stats and tabs:
   ```tsx
   <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
     {holdings.length > 0 ? (
       holdings.map((h) => (
         <Link key={h.unitAddress} href={`/fundraiser/${h.address}`}>
           <div className="w-3 h-3 rounded-full bg-moss-400 animate-pulse-glow flex-shrink-0" title={h.tokenName} />
         </Link>
       ))
     ) : (
       <p className="text-slate-400 text-[13px] italic">Start your garden — donate to a fundraiser</p>
     )}
   </div>
   ```

7. **Tabs**: Change active tab border from `border-white` to `border-moss-400`. Change tab labels from "Holdings" / "Launched" to "YOUR GARDEN" / "YOUR FUNDRAISERS" with `headline-brutal text-[12px]`.

8. **Holdings rows**: For each holding, check if the token was likely earned through donation (we can approximate: if the user has donated to the fundraiser, apply shimmer). For now, apply `shimmer-iridescent` class to the balance number for all holdings (since all tokens in give.fun come from donation). Add a leaf-prism icon:
   ```tsx
   <img src="/botanicals/leaf-prism.svg" className="w-4 h-4 inline mr-1" alt="" />
   <span className="shimmer-iridescent font-semibold">{balance}</span>
   ```

9. **Launched rows**: Add the growth-vine indicator showing relative fundraiser size:
   ```tsx
   <div className="mt-1">
     <img
       src="/botanicals/growth-vine.svg"
       className="h-2 opacity-60"
       style={{ width: `${Math.min(100, (rig.totalRaised / maxRaised) * 100)}%` }}
       alt=""
     />
   </div>
   ```
   (If `totalRaised` data isn't available, use `marketCapUsd` as a proxy.)

10. **Empty states**: Replace icon-based empty states with botanical illustrations:
    ```tsx
    <img src="/botanicals/empty-garden.svg" className="w-20 h-20 mb-3 opacity-60" />
    <p className="headline-brutal text-[15px] mb-1">Your garden is empty</p>
    <p className="text-[13px] text-slate-400 mb-4">Donate to grow it</p>
    ```
    For launched empty state: "Plant your first fundraiser" with moss CTA button.

11. **CTA buttons**: Change from `bg-white text-black` to `bg-moss-400 text-concrete-800 font-bold`. "Explore coins" → "EXPLORE FUNDRAISERS". "Launch a coin" → "PLANT A FUNDRAISER".

12. **Connect wallet / Not connected state**: Update background to `bg-concrete-800`, avatar placeholder gradient to moss, and connect button to `bg-moss-400 text-concrete-800 font-bold uppercase`.

**Step 2: Verify the build**

Run: `cd packages/app && npm run build 2>&1 | head -20`
Expected: `Compiled successfully`

**Step 3: Commit**

```bash
git add packages/app/app/profile/page.tsx
git commit -m "feat(redesign): rework Profile page as Impact Garden"
```

---

## Task 10: Update Remaining Components & Polish

**Files:**
- Modify: `packages/app/components/donate-modal.tsx`
- Modify: `packages/app/components/leaderboard.tsx`
- Modify: `packages/app/components/rig-card.tsx`
- Modify: `packages/app/components/price-chart.tsx`
- Modify: `packages/app/app/info/page.tsx`
- Modify: `packages/app/app/auctions/page.tsx`

**Context:** Final pass to catch all remaining components that still reference the old color scheme. Update modals, leaderboard, rig-card, chart colors, and secondary pages.

**Step 1: Update donate-modal.tsx**

- Change the main "Donate" button from white/black to `bg-moss-400 text-concrete-800 font-bold uppercase`
- Change the "Claim" button to `bg-prism-400 text-concrete-800 font-bold uppercase pulse-reward`
- Update any `bg-zinc-*` backgrounds to appropriate `bg-concrete-*` values
- Change preset amount buttons: active state from white to moss, inactive to concrete-600

**Step 2: Update leaderboard.tsx**

- Section header: `headline-brutal`
- Rank badges: moss-tinted backgrounds (already partially done in earlier commit, verify consistency)
- Share text already updated to "donor" language (done in build-fix commit)

**Step 3: Update rig-card.tsx**

- Change sparkline color from `text-zinc-400` to `text-moss-400`
- Change `bg-zinc-800` fallback logo background to `bg-concrete-700`
- Change `text-zinc-400` muted text to `text-slate-400`
- Change hover from `hover:bg-white/[0.02]` to `hover:bg-moss-400/[0.04]`

**Step 4: Update price-chart.tsx**

- Find the chart line/area color configuration and change to:
  - Line color: `#3DDC84` (Vibrant Moss)
  - Area top color: `rgba(61, 220, 132, 0.15)`
  - Area bottom color: `rgba(61, 220, 132, 0.0)`
  - Grid lines: `#2E2E2E`
  - Background: `#1A1A1A`

**Step 5: Update info/page.tsx and auctions/page.tsx**

- Change any remaining `bg-zinc-800` to `bg-concrete-800`
- Change any `bg-white text-black` buttons to `bg-moss-400 text-concrete-800 font-bold uppercase`
- Apply `headline-brutal` to page headers

**Step 6: Verify the full build**

Run: `cd packages/app && npm run build 2>&1`
Expected: Full build success with no errors.

**Step 7: Commit**

```bash
git add packages/app/components/donate-modal.tsx packages/app/components/leaderboard.tsx packages/app/components/rig-card.tsx packages/app/components/price-chart.tsx packages/app/app/info/page.tsx packages/app/app/auctions/page.tsx
git commit -m "feat(redesign): update remaining components with eco-brutalist styling"
```

---

## Task 11: Final Build Verification & Cleanup

**Files:**
- Possibly modify: any files with remaining `zinc-`, `purple-`, or old color references

**Context:** Final sweep to catch any stale color references, verify the full build, and ensure consistency.

**Step 1: Search for stale color references**

```bash
cd packages/app
grep -rn "zinc-\|purple-\|#8b5cf6\|#7c3aed\|#6d28d9\|bg-white text-black" --include="*.tsx" --include="*.ts" --include="*.css" | grep -v node_modules | grep -v .next
```

Fix any remaining references:
- `bg-zinc-800` → `bg-concrete-800`
- `bg-zinc-900` → `bg-concrete-800`
- `text-zinc-400` → `text-slate-400`
- `text-zinc-500` → `text-slate-400`
- `text-zinc-300` → `text-slate-300` or `text-foreground`
- `bg-white text-black` → `bg-moss-400 text-concrete-800`
- Any purple hex codes → moss equivalents
- `border-zinc-*` → `border-concrete-600`

**Step 2: Full build verification**

Run: `cd packages/app && npm run build 2>&1`
Expected: Complete build success, all 12 routes generated.

**Step 3: Commit any remaining fixes**

```bash
git add -A packages/app/
git commit -m "feat(redesign): final cleanup — remove all stale color references"
```
