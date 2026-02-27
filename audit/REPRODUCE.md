# Reproduce (Contract) Audit Environment

Date: 2026-02-27

## Repository and commit

- Repository: `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo`
- Commit audited: `d2bc5b5`

## Toolchain

- Node.js: `v20.19.6`
- Hardhat: `2.28.6`
- Solidity config pragma: `0.8.19`
- Hardhat compiler config: `solidity 0.8.19`, optimizer `enabled`, `runs: 200`, `viaIR: true`

## Installation

From repository root:

```bash
cd packages/hardhat
yarn install
```

Alternative with npm:

```bash
cd packages/hardhat
npm install
```

## Compile

```bash
cd packages/hardhat
npx hardhat compile
```

Observed output:

```text
Compiled 4 Solidity files successfully (evm target: paris).
```

## Test

```bash
cd packages/hardhat
npx hardhat test
```

Observed output: `177 passing (2s)` with all contract test suites green.

## Static tooling

- `cd packages/hardhat && npx slither .` → command unavailable in this environment (`slither` not found in PATH).
- `cd packages/hardhat && npx semgrep --config=auto --disable-version-check packages/hardhat/contracts` → command unavailable in this environment (`semgrep` not found in PATH).
- `cd packages/hardhat && npx solhint contracts/**/*.sol` → command unavailable in this environment in prior attempts.

Please install local tools in the same environment before rerunning if you want concrete slither/semgrep output files.

## Commands used in this audit

- Compile: `npx hardhat compile`
- Tests: `npx hardhat test`
- Static analysis attempts:
  - `npx slither .`
  - `npx semgrep --config=auto --disable-version-check packages/hardhat/contracts`
- Optional lint: `npx solhint contracts/**/*.sol`
