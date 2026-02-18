# give.fun Adaptation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adapt farplace-monorepo into givedotfun-monorepo by forking the repo, removing Mine/Spin rig types, keeping only the Fund (renamed to Fundraiser), and rebranding everything to give.fun.

**Architecture:** Fork & Strip - clone farplace-monorepo contents into givedotfun-monorepo, surgically remove all Mine/Spin code from contracts, subgraph, and frontend, rename Fund→Fundraiser throughout, rebrand Farplace→give.fun, and prepare for fresh deploy on Base.

**Tech Stack:** Solidity 0.8.19, Hardhat, The Graph (AssemblyScript), Next.js 16, React 19, wagmi/viem, TailwindCSS, Farcaster Mini-App SDK

---

### Task 1: Clone farplace-monorepo contents into givedotfun-monorepo

**Files:**
- Create: All files from farplace-monorepo into givedotfun-monorepo

**Step 1: Clone farplace into temp and copy contents**

```bash
cd /Users/hishamel-husseini/givedotfun-monorepo
git clone https://github.com/Heesho/farplace-monorepo /tmp/farplace-monorepo-fresh
# Copy everything except .git
rsync -av --exclude='.git' /tmp/farplace-monorepo-fresh/ .
rm -rf /tmp/farplace-monorepo-fresh
```

**Step 2: Verify structure exists**

```bash
ls packages/
```
Expected: `app  hardhat  subgraph`

**Step 3: Commit the import**

```bash
git add -A
git commit -m "Import farplace-monorepo as starting point for give.fun"
```

---

### Task 2: Strip Mine contracts

**Files:**
- Delete: `packages/hardhat/contracts/rigs/mine/` (entire directory)
- Delete: `packages/hardhat/contracts/mocks/MockEntropy.sol` (only needed by Mine/Spin VRF)
- Delete: `packages/hardhat/tests/mine/` (entire directory if it exists)

**Step 1: Delete Mine contract directory**

```bash
rm -rf packages/hardhat/contracts/rigs/mine/
```

**Step 2: Delete MockEntropy (Pyth VRF mock, unused by Fund)**

```bash
rm -f packages/hardhat/contracts/mocks/MockEntropy.sol
```

**Step 3: Delete Mine tests**

```bash
rm -rf packages/hardhat/tests/mine/
```

**Step 4: Commit**

```bash
git add -A
git commit -m "Remove MineRig contracts, mocks, and tests"
```

---

### Task 3: Strip Spin contracts

**Files:**
- Delete: `packages/hardhat/contracts/rigs/spin/` (entire directory)
- Delete: `packages/hardhat/tests/spin/` (entire directory if it exists)

**Step 1: Delete Spin contract directory**

```bash
rm -rf packages/hardhat/contracts/rigs/spin/
```

**Step 2: Delete Spin tests**

```bash
rm -rf packages/hardhat/tests/spin/
```

**Step 3: Commit**

```bash
git add -A
git commit -m "Remove SpinRig contracts and tests"
```

---

### Task 4: Rename Fund contracts to Fundraiser

**Files:**
- Rename: `packages/hardhat/contracts/rigs/fund/FundRig.sol` → `Fundraiser.sol`
- Rename: `packages/hardhat/contracts/rigs/fund/FundCore.sol` → `FundraiserCore.sol`
- Rename: `packages/hardhat/contracts/rigs/fund/FundMulticall.sol` → `FundraiserMulticall.sol`
- Rename: `packages/hardhat/contracts/rigs/fund/interfaces/IFundRig.sol` → `IFundraiser.sol`
- Rename: `packages/hardhat/contracts/rigs/fund/interfaces/IFundCore.sol` → `IFundraiserCore.sol`
- Rename: directory `packages/hardhat/contracts/rigs/fund/` → `packages/hardhat/contracts/rigs/fundraiser/`
- Modify: All Solidity files - update contract names, imports, references

**Step 1: Rename directory**

```bash
mv packages/hardhat/contracts/rigs/fund/ packages/hardhat/contracts/rigs/fundraiser/
```

**Step 2: Rename files**

```bash
cd packages/hardhat/contracts/rigs/fundraiser/
mv FundRig.sol Fundraiser.sol
mv FundCore.sol FundraiserCore.sol
mv FundMulticall.sol FundraiserMulticall.sol
mv interfaces/IFundRig.sol interfaces/IFundraiser.sol
mv interfaces/IFundCore.sol interfaces/IFundraiserCore.sol
```

**Step 3: Update contract names and references inside each file**

In `Fundraiser.sol`:
- Change `contract FundRig` → `contract Fundraiser`
- Change `import "./interfaces/IFundCore.sol"` → `import "./interfaces/IFundraiserCore.sol"`
- Change all `IFundCore` → `IFundraiserCore`
- Change all event names from `FundRig__` prefix to `Fundraiser__`
- Change all error names from `FundRig__` prefix to `Fundraiser__`

In `FundraiserCore.sol`:
- Change `contract FundCore` → `contract FundraiserCore`
- Change import of `FundRig` → `Fundraiser`
- Change `new FundRig(...)` → `new Fundraiser(...)`
- Change all event names from `FundCore__` prefix to `FundraiserCore__`
- Change all error names from `FundCore__` prefix to `FundraiserCore__`
- Update interface imports

In `FundraiserMulticall.sol`:
- Change `contract FundMulticall` → `contract FundraiserMulticall`
- Change import of `IFundRig` → `IFundraiser`
- Change all `IFundRig` → `IFundraiser`

In `IFundraiser.sol`:
- Change `interface IFundRig` → `interface IFundraiser`
- Update event/error prefixes

In `IFundraiserCore.sol`:
- Change `interface IFundCore` → `interface IFundraiserCore`
- Update event/error prefixes

**Step 4: Update Registry.sol references**

In `packages/hardhat/contracts/Registry.sol`:
- Update any "farplace" comments to "givedotfun"
- The Registry is generic enough that no code changes are needed beyond comments

**Step 5: Verify compilation**

```bash
cd /Users/hishamel-husseini/givedotfun-monorepo/packages/hardhat
npx hardhat compile
```
Expected: Successful compilation with no errors

**Step 6: Commit**

```bash
git add -A
git commit -m "Rename Fund contracts to Fundraiser"
```

---

### Task 5: Update deploy scripts

**Files:**
- Modify: `packages/hardhat/scripts/deploy.js`

**Step 1: Remove Mine deploy functions**

Remove these functions from deploy.js:
- `deployMineCore()` (around line 167)
- `deployMineMulticall()` (around line 289)
- Any Mine-specific configuration
- The Mine deploy calls in the main execution block (around lines 1165-1167)

**Step 2: Remove Spin deploy functions**

Remove these functions:
- `deploySpinCore()` (around line 200)
- `deploySpinMulticall()` (around line 300)
- Any Spin-specific configuration
- The Spin deploy calls in the main execution block (around lines 1170-1172)

**Step 3: Rename Fund references to Fundraiser**

- `deployFundCore()` → `deployFundraiserCore()` - change contract name from "FundCore" to "FundraiserCore"
- `deployFundMulticall()` → `deployFundraiserMulticall()` - change contract name from "FundMulticall" to "FundraiserMulticall"
- Update the main execution block to only call Fundraiser deploys
- Remove Entropy/VRF address references (not needed by Fundraiser)

**Step 4: Verify deploy script syntax**

```bash
node -c packages/hardhat/scripts/deploy.js
```
Expected: No syntax errors

**Step 5: Commit**

```bash
git add -A
git commit -m "Update deploy scripts for Fundraiser-only deployment"
```

---

### Task 6: Update Fund contract tests

**Files:**
- Modify: `packages/hardhat/tests/fund/testCharityRig.js` - update contract references
- Modify: `packages/hardhat/tests/fund/testCore.js` - update contract references
- Modify: `packages/hardhat/tests/fund/testInvariants.js` - update contract references
- Rename: `packages/hardhat/tests/fund/` → `packages/hardhat/tests/fundraiser/`

**Step 1: Rename test directory**

```bash
mv packages/hardhat/tests/fund/ packages/hardhat/tests/fundraiser/
```

**Step 2: Update contract references in all test files**

In all test files, replace:
- `"FundRig"` → `"Fundraiser"`
- `"FundCore"` → `"FundraiserCore"`
- `"FundMulticall"` → `"FundraiserMulticall"`
- Any `FundRig__` event references → `Fundraiser__`
- Any `FundCore__` event references → `FundraiserCore__`

**Step 3: Run tests**

```bash
cd /Users/hishamel-husseini/givedotfun-monorepo/packages/hardhat
npx hardhat test tests/fundraiser/
```
Expected: All tests pass

**Step 4: Commit**

```bash
git add -A
git commit -m "Update and rename Fund tests to Fundraiser"
```

---

### Task 7: Strip Mine/Spin from subgraph schema

**Files:**
- Modify: `packages/subgraph/schema.graphql`

**Step 1: Remove Mine entities**

Remove these entity definitions from schema.graphql:
- `MineRig` entity
- `MineSlot` entity
- `MineAction` entity
- `MineClaim` entity

**Step 2: Remove Spin entities**

Remove these entity definitions:
- `SpinRig` entity
- `Spin` entity

**Step 3: Rename Fund entities to Fundraiser**

- `FundRig` → `Fundraiser`
- `FundRecipient` → `Recipient`
- `FundDayData` → `FundraiserDayData`
- `FundDonor` → `Donor`
- `FundDayDonor` → `DayDonor`
- `FundClaim` → `Claim`

**Step 4: Simplify the generic Rig entity**

The `Rig` entity currently has nullable links to `mineRig`, `spinRig`, `fundRig`. Since there's only one type now, either:
- Remove the `Rig` entity and merge its fields into `Fundraiser`
- Or keep `Rig` but remove `mineRig`/`spinRig` fields and `rigType`

Recommended: Keep `Rig` as a thin wrapper (it stores shared fields like unit, launcher, auction, revenue) but remove `mineRig`/`spinRig` fields and rename `fundRig` → `fundraiser`.

**Step 5: Update Protocol entity**

In the `Protocol` entity, update the `id` description to mention "givedotfun" instead of "farplace".

**Step 6: Commit**

```bash
git add -A
git commit -m "Strip Mine/Spin entities, rename Fund to Fundraiser in subgraph schema"
```

---

### Task 8: Update subgraph.yaml

**Files:**
- Modify: `packages/subgraph/subgraph.yaml`

**Step 1: Remove Mine data source and template**

Remove:
- `MineCore` data source (contract address, ABI, handlers)
- `MineRig` template (events, handlers)

**Step 2: Remove Spin data source and template**

Remove:
- `SpinCore` data source
- `SpinRig` template

**Step 3: Rename Fund references**

- `FundCore` data source → `FundraiserCore`
- Update ABI file reference to `FundraiserCore.json`
- Update handler file reference to `fundraiserCore.ts`
- Update event names from `FundCore__Launched` to `FundraiserCore__Launched`
- `FundRig` template → `Fundraiser`
- Update all event names from `FundRig__` to `Fundraiser__`
- Update handler reference to `fundraiser.ts`

**Step 4: Update contract address placeholder**

Replace the existing FundCore address with a placeholder (fresh deploy):
```
address: "0x0000000000000000000000000000000000000000"
```
Add a comment: `# TODO: Update with deployed FundraiserCore address`

**Step 5: Update ABI references**

Rename ABI files:
```bash
mv packages/subgraph/abis/FundCore.json packages/subgraph/abis/FundraiserCore.json
mv packages/subgraph/abis/FundRig.json packages/subgraph/abis/Fundraiser.json
rm packages/subgraph/abis/MineCore.json packages/subgraph/abis/MineRig.json
rm packages/subgraph/abis/SpinCore.json packages/subgraph/abis/SpinRig.json
```

**Step 6: Commit**

```bash
git add -A
git commit -m "Update subgraph.yaml for Fundraiser-only indexing"
```

---

### Task 9: Update subgraph handler files

**Files:**
- Delete: `packages/subgraph/src/cores/mineCore.ts`
- Delete: `packages/subgraph/src/cores/spinCore.ts`
- Delete: `packages/subgraph/src/rigs/mineRig.ts`
- Delete: `packages/subgraph/src/rigs/spinRig.ts`
- Rename: `packages/subgraph/src/cores/fundCore.ts` → `fundraiserCore.ts`
- Rename: `packages/subgraph/src/rigs/fundRig.ts` → `fundraiser.ts`
- Modify: `packages/subgraph/src/constants.ts` - update PROTOCOL_ID, remove Mine/Spin types
- Modify: `packages/subgraph/src/helpers.ts` - remove Mine/Spin references

**Step 1: Delete Mine/Spin handlers**

```bash
rm packages/subgraph/src/cores/mineCore.ts
rm packages/subgraph/src/cores/spinCore.ts
rm packages/subgraph/src/rigs/mineRig.ts
rm packages/subgraph/src/rigs/spinRig.ts
```

**Step 2: Rename Fund handlers**

```bash
mv packages/subgraph/src/cores/fundCore.ts packages/subgraph/src/cores/fundraiserCore.ts
mv packages/subgraph/src/rigs/fundRig.ts packages/subgraph/src/rigs/fundraiser.ts
```

**Step 3: Update constants.ts**

```typescript
export const PROTOCOL_ID = "givedotfun";
// Remove RIG_TYPE_MINE and RIG_TYPE_SPIN
export const RIG_TYPE_FUND = "fund"; // Keep as "fund" for backward compat or change to "fundraiser"
```

**Step 4: Update fundraiserCore.ts**

- Update imports for renamed entities (FundRig → Fundraiser, etc.)
- Update entity creation code
- Update event class imports to match renamed ABI

**Step 5: Update fundraiser.ts**

- Update all entity imports (FundRig → Fundraiser, FundDayData → FundraiserDayData, etc.)
- Update entity.save() calls with new entity names
- Update ID generation patterns

**Step 6: Update helpers.ts**

- Remove any Mine/Spin-specific helper functions
- Update entity references

**Step 7: Verify subgraph builds**

```bash
cd /Users/hishamel-husseini/givedotfun-monorepo/packages/subgraph
npx graph codegen
npx graph build
```
Expected: Successful build

**Step 8: Commit**

```bash
git add -A
git commit -m "Update subgraph handlers for Fundraiser-only indexing"
```

---

### Task 10: Strip Mine/Spin from frontend - components

**Files:**
- Delete: `packages/app/components/mine-modal.tsx`
- Delete: `packages/app/components/spin-modal.tsx`
- Delete: `packages/app/components/mine-history-item.tsx`
- Delete: `packages/app/components/spin-history-item.tsx`
- Rename: `packages/app/components/fund-modal.tsx` → `donate-modal.tsx`

**Step 1: Delete Mine/Spin components**

```bash
rm packages/app/components/mine-modal.tsx
rm packages/app/components/spin-modal.tsx
rm packages/app/components/mine-history-item.tsx
rm packages/app/components/spin-history-item.tsx
```

**Step 2: Rename fund-modal**

```bash
mv packages/app/components/fund-modal.tsx packages/app/components/donate-modal.tsx
```

**Step 3: Update donate-modal.tsx internals**

- Rename component from `FundModal` to `DonateModal`
- Update any internal references

**Step 4: Commit**

```bash
git add -A
git commit -m "Strip Mine/Spin components, rename FundModal to DonateModal"
```

---

### Task 11: Strip Mine/Spin from frontend - hooks

**Files:**
- Delete: `packages/app/hooks/useRigType.ts` (no longer needed - only one type)
- Delete: `packages/app/hooks/useSpinRigState.ts`
- Rename: `packages/app/hooks/useFundRigState.ts` → `useFundraiserState.ts`
- Modify: `packages/app/hooks/useRigState.ts` → update to only handle Fundraiser

**Step 1: Delete unnecessary hooks**

```bash
rm packages/app/hooks/useRigType.ts
rm packages/app/hooks/useSpinRigState.ts
```

**Step 2: Rename fund hook**

```bash
mv packages/app/hooks/useFundRigState.ts packages/app/hooks/useFundraiserState.ts
```

**Step 3: Update useFundraiserState.ts**

- Update multicall contract reference from `fundMulticall` to `fundraiserMulticall`
- Update ABI references

**Step 4: Update useRigState.ts**

- Remove Mine/Spin multicall references
- Only reference FundraiserMulticall
- Simplify the hook since there's only one rig type

**Step 5: Commit**

```bash
git add -A
git commit -m "Strip Mine/Spin hooks, rename to Fundraiser"
```

---

### Task 12: Update frontend - contracts and ABIs

**Files:**
- Modify: `packages/app/lib/contracts.ts` - remove Mine/Spin addresses, update names
- Update/create: ABI files for Fundraiser contracts

**Step 1: Update contracts.ts**

Remove all Mine/Spin contract addresses and ABIs:
- Remove `mineCore`, `spinCore` addresses
- Remove `mineMulticall`, `spinMulticall` addresses
- Rename `fundCore` → `fundraiserCore`
- Rename `fundMulticall` → `fundraiserMulticall`
- Set all addresses to placeholder `"0x0000000000000000000000000000000000000000"` with TODO comments

**Step 2: Update ABI imports**

- Remove Mine/Spin ABI imports
- Rename Fund ABI imports to Fundraiser

**Step 3: Commit**

```bash
git add -A
git commit -m "Update contract addresses and ABIs for Fundraiser-only"
```

---

### Task 13: Update frontend - subgraph queries

**Files:**
- Modify: `packages/app/lib/subgraph-launchpad.ts`

**Step 1: Remove Mine/Spin types and queries**

- Remove `SubgraphMineEvent` type definition
- Remove `SubgraphSpin` type definition
- Remove `mineRig` and `spinRig` fields from `SubgraphRig` type
- Rename `fundRig` → `fundraiser` in `SubgraphRig`

**Step 2: Update GraphQL query strings**

- Remove Mine/Spin fields from all GraphQL query strings
- Update `protocol(id: "farplace")` → `protocol(id: "givedotfun")`
- Rename `fundRig` → `fundraiser` in all queries
- Remove `rigType` filtering (only one type now)

**Step 3: Update helper functions**

- Remove any Mine/Spin-specific data transformation functions
- Update function names and types

**Step 4: Commit**

```bash
git add -A
git commit -m "Update subgraph queries for Fundraiser-only"
```

---

### Task 14: Update frontend - pages

**Files:**
- Modify: `packages/app/app/explore/page.tsx` - remove type filters
- Modify: `packages/app/app/launch/page.tsx` - remove type selection, Fund-only
- Rename: `packages/app/app/rig/[address]/` → `packages/app/app/fundraiser/[address]/`
- Modify: `packages/app/app/fundraiser/[address]/page.tsx` - remove type switching
- Modify: `packages/app/app/fundraiser/[address]/client-page.tsx` - Fund-only rendering
- Modify: `packages/app/app/page.tsx` - redirect to /explore

**Step 1: Update explore page**

- Remove rig type filter/tabs if any
- Update listing to show "Fundraisers" instead of "Rigs"
- Update imports for renamed components

**Step 2: Simplify launch page**

- Remove `RigType` type and type selection UI
- Remove `BOUNDS` and `DEFAULTS` for mine/spin
- Only show Fund launch form
- Update labels: "Launch Fundraiser" instead of "Launch Rig"

**Step 3: Rename rig route to fundraiser**

```bash
mv packages/app/app/rig/ packages/app/app/fundraiser/
```

**Step 4: Update fundraiser detail page**

- Remove `useRigType` hook usage (no type detection needed)
- Remove conditional rendering for Mine/Spin
- Only render DonateModal (formerly FundModal)
- Update imports

**Step 5: Update client-page.tsx**

- Remove Mine/Spin modal imports
- Only render donate-modal
- Remove rig type switching logic

**Step 6: Update root redirect**

In `packages/app/app/page.tsx`, ensure redirect goes to `/explore`.

**Step 7: Commit**

```bash
git add -A
git commit -m "Update pages: simplify launch, rename rig to fundraiser route"
```

---

### Task 15: Update frontend - navigation and branding

**Files:**
- Modify: `packages/app/components/nav-bar.tsx` - update links and labels
- Modify: `packages/app/app/layout.tsx` - rebrand metadata
- Modify: `packages/app/public/.well-known/farcaster.json` - rebrand manifest
- Modify: `packages/app/app/info/page.tsx` - update content

**Step 1: Update nav-bar.tsx**

- Change `/rig/` links to `/fundraiser/`
- Update labels if visible (Explore, Launch, etc.)

**Step 2: Update layout.tsx metadata**

```tsx
export const metadata: Metadata = {
  title: "give.fun",
  description: "The crypto GoFundMe. Perpetual funding for charities, projects, people, and agents on Base.",
  // Update OG images
};
```

**Step 3: Update farcaster.json**

```json
{
  "miniapp": {
    "name": "give.fun",
    "tagline": "Fund anything, forever",
    "description": "The crypto GoFundMe. Perpetual funding for charities, projects, people, and agents on Base.",
    "iconUrl": "https://give.fun/media/icon.png",
    "homeUrl": "https://give.fun/",
    "splashImageUrl": "https://give.fun/media/splash.png",
    "splashBackgroundColor": "#000000",
    "heroImageUrl": "https://give.fun/media/hero.png",
    "requiredChains": ["eip155:8453"],
    "primaryCategory": "finance",
    "tags": ["funding", "charity", "base", "donations"]
  }
}
```

**Step 4: Update info page**

Rewrite content to describe give.fun instead of Farplace.

**Step 5: Update package.json name**

```bash
# In packages/app/package.json
# Change "name": "farplace-miniapp" to "name": "givedotfun-app"
```

**Step 6: Commit**

```bash
git add -A
git commit -m "Rebrand to give.fun: update nav, metadata, manifest, info page"
```

---

### Task 16: Update root configs and monorepo settings

**Files:**
- Modify: Root `package.json` - update name, description
- Modify: Root `CLAUDE.md` if exists - update project description
- Modify: Root `README.md` if exists - update documentation

**Step 1: Update root package.json**

- Change name to `givedotfun-monorepo`
- Update description

**Step 2: Update or create CLAUDE.md**

Write a CLAUDE.md describing the givedotfun project structure, commands, and conventions.

**Step 3: Commit**

```bash
git add -A
git commit -m "Update root configs for givedotfun monorepo"
```

---

### Task 17: Fix all import chains and verify full build

**Files:**
- All files with broken imports due to renames

**Step 1: Search for stale references**

```bash
# Find all remaining references to old names
grep -r "FundRig\|FundCore\|FundMulticall\|MineRig\|MineCore\|SpinRig\|SpinCore\|farplace\|Farplace" packages/ --include='*.ts' --include='*.tsx' --include='*.sol' --include='*.json' --include='*.yaml' --include='*.graphql' -l
```

**Step 2: Fix any remaining references**

Update every file found in Step 1 that still has old references.

**Step 3: Verify smart contracts compile**

```bash
cd packages/hardhat && npx hardhat compile
```

**Step 4: Verify subgraph builds**

```bash
cd packages/subgraph && npx graph codegen && npx graph build
```

**Step 5: Verify frontend builds**

```bash
cd packages/app && npm run build
```

**Step 6: Run contract tests**

```bash
cd packages/hardhat && npx hardhat test tests/fundraiser/
```

**Step 7: Fix any issues found and re-verify**

**Step 8: Commit**

```bash
git add -A
git commit -m "Fix all import chains, verify full build passes"
```

---

### Task 18: Install dependencies and verify dev environment

**Step 1: Install root dependencies**

```bash
cd /Users/hishamel-husseini/givedotfun-monorepo
yarn install
```

**Step 2: Verify each package**

```bash
cd packages/hardhat && npx hardhat compile
cd ../subgraph && npx graph codegen && npx graph build
cd ../app && npm run dev  # Verify dev server starts
```

**Step 3: Final commit**

```bash
git add -A
git commit -m "Verify dev environment, all packages build successfully"
```
