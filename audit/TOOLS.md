# Analysis Tooling

## Commands executed

Primary automated checks attempted from `packages/hardhat`:

- `cd packages/hardhat && npx hardhat compile`
- `cd packages/hardhat && npx hardhat test`
- `cd packages/hardhat && npx slither .` -> failed (binary not found)
- `cd packages/hardhat && npx semgrep --config=auto --disable-version-check contracts` -> failed (binary not found)
- `cd packages/hardhat && npx solhint contracts/**/*.sol` -> failed (binary not found)

## Environment outcome

- `node -v`: `v20.19.6`
- `npx hardhat --version`: `2.28.6`
- `npx hardhat compile`: `Compiled 4 Solidity files successfully (evm target: paris).`
- `npx hardhat test`: `177 passing (2s)`.

Automated coverage of findings with slither/semgrep output files was not possible in this environment due tooling availability.

## Tool availability in sandbox

The runtime only had local compiler/runtime tooling for hardhat; the static analyzers were not installed and could not be pulled due network restrictions.

Commands:

```bash
cd /Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat
which slither  # -> not found
which semgrep # -> not found
which solhint # -> not found
```

## Manual follow-up required due tool gaps

- Manual line-by-line audit and invariants review should be considered the primary result for this environment.
- No automated Slither/Semgrep findings are available to confirm/dismiss from this run; attempted outputs are recorded as command failures in `audit/slither.txt` and `audit/semgrep.txt`.

## Output artifacts

- `audit/slither.txt`
- `audit/semgrep.txt`
