# give.fun App Redesign — "Soft Brutalism with a Pulse"

## Summary

Retheme + targeted layout tweaks across all four main pages of the give.fun Farcaster mini-app. The visual identity shifts from generic dark-mode crypto app to a distinctive **Eco-Brutalist** aesthetic: raw concrete structures layered with lush organic botanical elements and iridescent reward accents.

## Decisions

| Decision | Choice |
|----------|--------|
| Scope | Retheme + layout tweaks on all 4 main pages |
| Organic elements | Full organic imagery (moss, stone textures, botanical SVG/PNG) |
| Typography | Inter Bold + all-caps for headlines (no second font) |
| Iridescence | CSS gradient shimmer for holographic reward elements |
| Pages to rework | Explore, Fundraiser Detail, Launch, Profile |
| Approach | Foundation-First (tokens first, then assets, then pages) |

---

## Phase 1: Design Tokens

### Color Palette — "The Engine & The Earth"

| Token | Hex | Purpose |
|-------|-----|---------|
| `--background` (Obsidian Concrete) | `#1A1A1A` | Body background |
| `--card` (Deep Slab) | `#242424` | Card surfaces |
| `--border` | `#8E8E8E` at 20% opacity | Borders, dividers |
| `--muted` (Weathered Stone) | `#2E2E2E` | Inactive surfaces |
| `--muted-foreground` (Raw Slate) | `#8E8E8E` | Secondary text, labels |
| `--foreground` | `#FAFAFA` | Primary text (unchanged) |
| Primary action (Vibrant Moss) | `#3DDC84` | Donate buttons, active states, success |
| Reward action (Prism Flare) | `#B2FF59` | Claim buttons, reward highlights |
| Token logo gradient | `#3DDC84` to `#2BA866` | Moss 400 to 600 |

### Shadows

| Name | Value | Use |
|------|-------|-----|
| `glow` | `0 0 20px rgba(61, 220, 132, 0.25)` | Hover states, active cards |
| `glow-lg` | `0 0 40px rgba(61, 220, 132, 0.35)` | Hero elements |
| `glow-reward` | `0 0 30px rgba(178, 255, 89, 0.3)` | Claim buttons, reward elements |
| `card` | `0 1px 3px rgba(0, 0, 0, 0.3)` | Standard card elevation |

### Gradients

| Name | Value | Use |
|------|-------|-----|
| `gradient-glow` | `#3DDC84` to `#2BA866` | Primary moss gradient |
| `gradient-reward` | `#B2FF59` to `#3DDC84` | Prism to moss for rewards |
| `gradient-iridescent` | Animated `white > #93C5FD > #F9A8D4 > white` | Holographic shimmer on minted tokens |

### Typography

- **Headlines**: Inter Bold, `uppercase`, `letter-spacing: 0.05em`
- **Body**: Inter Regular, `letter-spacing: -0.01em` (unchanged)
- New utility class: `.headline-brutal` — applies all-caps bold treatment

---

## Phase 2: Organic Assets & Textures

### Asset Inventory

| Asset | Type | Location | Usage |
|-------|------|----------|-------|
| Concrete texture (dark) | Tiling PNG | `/public/textures/concrete-dark.png` | Body background at 5-8% opacity |
| Concrete texture (lighter) | Tiling PNG | `/public/textures/concrete-slab.png` | Card surfaces |
| Corner moss cluster | PNG sprite | `/public/botanicals/corner-moss.png` | Card corners, decorative |
| Vine divider | SVG | `/public/botanicals/vine-divider.svg` | Section separators |
| Vine border ring | SVG | `/public/botanicals/vine-ring.svg` | Around token logos |
| Fern frond (large) | SVG/PNG | `/public/botanicals/fern-frond.png` | Page backgrounds at 8-10% opacity |
| Fern hero (lush) | PNG | `/public/botanicals/fern-hero.png` | Profile header backdrop at 15% opacity |
| Moss growth indicator | SVG | `/public/botanicals/growth-vine.svg` | Profile "launched" cards |
| Empty state botanical | SVG | `/public/botanicals/empty-garden.svg` | Empty list states |

**Total asset budget**: ~200-300KB

### Where NOT to use organics

- Inside modals (keep clean, transaction-focused)
- On the price chart (data clarity)
- On form inputs (readability)

### Implementation Pattern

```tsx
<div className="relative">
  {/* Concrete texture overlay */}
  <div className="absolute inset-0 bg-concrete opacity-[0.06] pointer-events-none" />
  {/* Botanical accent */}
  <img src="/botanicals/corner-moss.png" className="absolute -top-2 -right-2 w-16 opacity-60 pointer-events-none" />
  {/* Actual content */}
  <div className="relative z-10">...</div>
</div>
```

---

## Phase 3: Page Layouts

### Explore Page

**Header:**
- `EXPLORE FUNDRAISERS` in headline-brutal
- Search bar: concrete-textured background, Vibrant Moss focus ring
- Sort tabs (Bump / New / Top): chunky slab-style — thick bottom border in Vibrant Moss when active, Raw Slate when inactive. Squared-off, not rounded pills.

**Fundraiser cards:**
- Concrete slab background with stone texture, `border-2` with `#2E2E2E`, `rounded-lg` (8px — more brutalist)
- Corner moss accent top-right
- Token logo with vine border ring
- Sparkline chart in Vibrant Moss
- Positive changes: Prism Flare. Negative: muted red.
- Hover: moss `glow` shadow

**Background:**
- Full-page concrete texture at low opacity
- Large faded fern frond SVG anchored bottom-right, ~40% page height, ~8% opacity

**Empty state:**
- Botanical illustration + "No fundraisers found" in headline-brutal

---

### Fundraiser Detail Page

**Hero section:**
- Token name/symbol in headline-brutal
- Token logo: `w-16 h-16` with vine ring, moss-glow pedestal shadow beneath
- Background: sprawling vine/fern at ~10% opacity, anchored top-left

**Stats grid:**
- Individual concrete stat blocks with stone texture
- Labels: Raw Slate, uppercase, 10px. Values: white bold.
- Key stats (price, market cap): 3px solid Vibrant Moss left-border accent
- Fundraiser-specific stats (emission, halving, recipient): grouped slab with vine divider

**Price chart:**
- Clean dark background (no texture)
- Line color: Vibrant Moss. Area fill: Vibrant Moss at 10% opacity gradient to transparent.

**Donate CTA:**
- Full-width Vibrant Moss button, uppercase bold, concrete texture overlay on button
- Sticky bottom bar with dark concrete slab background, subtle top-border vine accent
- Claimable tokens: secondary Prism Flare "Claim" button with `glow-reward` shadow, `pulse-glow` animation

**Leaderboard:**
- `TOP DONORS` in headline-brutal
- Rank badges (#1-3): moss-tinted backgrounds
- "You" badge: Vibrant Moss background, dark text

**Donation history:**
- Thin vine-accent left border per entry
- Timestamps in Raw Slate, amounts in white

---

### Launch Page

**Header:**
- `CREATE A FUNDRAISER` in headline-brutal
- Subtitle in Raw Slate: "Launch a perpetual funding campaign on Base"
- Moss cluster accent top-right

**Form structure — "Stacking Slabs":**
- Three distinct concrete slab sections separated by vine/fern divider SVGs:
  - **Slab 1: Identity** — Logo upload, token name, symbol
  - **Slab 2: Cause** — Description, recipient address, default message
  - **Slab 3: Economics** — Liquidity, emission config, epoch duration
- Slab headers: uppercase bold with Vibrant Moss left-border accent

**Logo upload:**
- Concrete square with dashed Vibrant Moss border
- Hover: moss glow shadow
- Uploaded preview: vine-ring treatment

**Form inputs:**
- Background: `#242424` (Deep Slab) with subtle inner shadow (recessed-into-concrete)
- Focus ring: Vibrant Moss
- Labels: uppercase, 11px, Raw Slate, `letter-spacing: 0.05em`

**Advanced parameters:**
- Collapsible, toggle styled as raw concrete tab
- Same input styling inside

**Launch button:**
- Full-width, Vibrant Moss background, uppercase bold
- Concrete texture overlay on surface
- Loading state: shimmer animation in moss to prism gradient

---

### Profile Page — "The Impact Garden"

**Profile header:**
- User avatar: `w-20 h-20` with vine-ring border
- Username in headline-brutal
- Background: lush fern/vine composition at ~15% opacity, filling top third — the "garden" backdrop

**Heartbeat ticker:**
- Horizontal strip below header showing active perpetual donations as pulsing dots
- Each dot: Vibrant Moss, `pulse-glow` animation, one per active fundraiser
- Tap dot: navigates to that fundraiser
- No donations: "Start your garden — donate to a fundraiser" in Raw Slate italic

**Portfolio stats:**
- USDC balance and total value in large concrete stat blocks
- Vibrant Moss left-border accent on primary value

**Holdings tab — "Your Garden":**
- Each token: concrete slab card with vine-ring logo
- Tokens earned via donation: Prism Flare leaf icon + `gradient-iridescent` shimmer on balance number (holographic minted token effect)
- Current USDC value below

**Launched tab — "Your Fundraisers":**
- Each fundraiser card shows: total raised (headline), donor count
- Growth indicator: small vine SVG that scales in length based on total raised

**Empty states:**
- No holdings: botanical illustration + "Your garden is empty — donate to grow it"
- No fundraisers: "Plant your first fundraiser" with moss CTA button

---

## Components Affected

| Component | Changes |
|-----------|---------|
| `tailwind.config.ts` | Complete color/shadow/gradient overhaul |
| `globals.css` | CSS variables, new utility classes, texture backgrounds |
| `ui/button.tsx` | Moss/Prism color variants, concrete texture variant |
| `ui/card.tsx` | Stone texture background, squared corners |
| `ui/input.tsx` | Recessed slab styling, moss focus ring |
| `nav-bar.tsx` | Concrete background, moss active states |
| `rig-card.tsx` | Slab styling, moss accents, corner botanicals |
| `token-logo.tsx` | Vine ring border, moss gradient |
| `donate-modal.tsx` | Moss CTA, prism claim button |
| `leaderboard.tsx` | Moss rank badges, headline-brutal headers |
| `price-chart.tsx` | Moss chart colors |
| `explore/page.tsx` | Slab tabs, botanical background, new card layout |
| `fundraiser/.../client-page.tsx` | Stat blocks, hero section, sticky CTA bar |
| `launch/page.tsx` | Stacking slabs form, vine dividers |
| `profile/page.tsx` | Impact Garden, heartbeat ticker, garden tiles |

## Assets to Create

All placed in `/public/textures/` and `/public/botanicals/`. Estimated ~200-300KB total. SVG vines can be procedurally generated. PNG textures sourced or created.
