# Proposed Fixes and Regression Plan

This document contains patch proposals and tests only (no contract edits were applied yet).

## Patch 1 — Reconcile received amounts in `Fundraiser.fund`

### File
`/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Fundraiser.sol`

### Target
`fund(address account, uint256 amount, string calldata _uri)`

### Proposed changes

- Measure pre/post `quote` token balance in the fundraiser.
- Reject if observed `receivedAmount < MIN_DONATION`.
- Use `receivedAmount` for fee splits and all accounting updates.
- Emit the actual amount in `Fundraiser__Funded`.

```diff
diff --git a/packages/hardhat/contracts/Fundraiser.sol b/packages/hardhat/contracts/Fundraiser.sol
@@
-        // Transfer tokens from msg.sender (payer)
-        IERC20(quote).safeTransferFrom(msg.sender, address(this), amount);
-
-        // Calculate splits (address(0) redirects that share to treasury)
-        address protocol = ICore(core).protocolFeeAddress();
-        uint256 recipientAmount = recipient != address(0) ? amount * RECIPIENT_BPS / DIVISOR : 0;
-        uint256 teamAmount = team != address(0) ? amount * TEAM_BPS / DIVISOR : 0;
-        uint256 protocolAmount = protocol != address(0) ? amount * PROTOCOL_BPS / DIVISOR : 0;
-        uint256 treasuryAmount = amount - recipientAmount - teamAmount - protocolAmount;
+        // Measure actual received amount to support non-standard ERC20s.
+        uint256 before = IERC20(quote).balanceOf(address(this));
+        IERC20(quote).safeTransferFrom(msg.sender, address(this), amount);
+        uint256 received = IERC20(quote).balanceOf(address(this)) - before;
+        if (received == 0 || received < MIN_DONATION) revert Fundraiser__BelowMinDonation();
+
+        // Calculate splits (address(0) redirects that share to treasury)
+        address protocol = ICore(core).protocolFeeAddress();
+        uint256 recipientAmount = recipient != address(0) ? received * RECIPIENT_BPS / DIVISOR : 0;
+        uint256 teamAmount = team != address(0) ? received * TEAM_BPS / DIVISOR : 0;
+        uint256 protocolAmount = protocol != address(0) ? received * PROTOCOL_BPS / DIVISOR : 0;
+        uint256 treasuryAmount = received - recipientAmount - teamAmount - protocolAmount;

@@
-        epochToTotalDonated[epoch] += amount;
-        epochAccountToDonation[epoch][account] += amount;
-        emit Fundraiser__Funded(msg.sender, account, amount, epoch, _uri);
+        epochToTotalDonated[epoch] += received;
+        epochAccountToDonation[epoch][account] += received;
+        emit Fundraiser__Funded(msg.sender, account, received, epoch, _uri);
```

## Patch 2 — `Multicall.fund` uses actual received token amount

### File
`/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol`

### Required error additions

Add these errors:

```solidity
error Multicall__ReceivedAmountZero();
error Multicall__ReceivedAmountBelowMinimum();
```

### Target
`fund(address fundraiser, address account, uint256 amount, string calldata _uri)`

### Proposed changes

- Measure pre/post balance in `Multicall` around the pull.
- Validate `received` before approval.
- Forward `received` to fundraiser.

```diff
diff --git a/packages/hardhat/contracts/Multicall.sol b/packages/hardhat/contracts/Multicall.sol
@@
         address quoteToken = IFundraiser(fundraiser).quote();
-        IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), amount);
-        IERC20(quoteToken).safeApprove(fundraiser, 0);
-        IERC20(quoteToken).safeApprove(fundraiser, amount);
-        IFundraiser(fundraiser).fund(account, amount, _uri);
+        uint256 before = IERC20(quoteToken).balanceOf(address(this));
+        IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), amount);
+        uint256 received = IERC20(quoteToken).balanceOf(address(this)) - before;
+        if (received == 0) revert Multicall__ReceivedAmountZero();
+        if (received < IFundraiser(fundraiser).MIN_DONATION()) {
+            revert Multicall__ReceivedAmountBelowMinimum();
+        }
+
+        IERC20(quoteToken).safeApprove(fundraiser, 0);
+        IERC20(quoteToken).safeApprove(fundraiser, received);
+        IFundraiser(fundraiser).fund(account, received, _uri);
```

## Patch 3 — `Multicall.launch` forwards received USDC amount

### File
`/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol`

### Required error additions

Add this error:

```solidity
error Multicall__InsufficientReceived();
```

### Target
`launch(ICore.LaunchParams calldata params)`

### Proposed changes

- Measure actual USDC pulled into helper.
- Require actual received >= `ICore(core).minUsdcForLaunch()`.
- Pass observed amount into launch params.

```diff
diff --git a/packages/hardhat/contracts/Multicall.sol b/packages/hardhat/contracts/Multicall.sol
@@
-        IERC20(usdc).safeTransferFrom(msg.sender, address(this), params.usdcAmount);
-        IERC20(usdc).safeApprove(core, 0);
-        IERC20(usdc).safeApprove(core, params.usdcAmount);
+        uint256 minUsdcForLaunch = ICore(core).minUsdcForLaunch();
+        uint256 before = IERC20(usdc).balanceOf(address(this));
+        IERC20(usdc).safeTransferFrom(msg.sender, address(this), params.usdcAmount);
+        uint256 received = IERC20(usdc).balanceOf(address(this)) - before;
+        if (received < minUsdcForLaunch) revert Multicall__InsufficientReceived();
+
+        IERC20(usdc).safeApprove(core, 0);
+        IERC20(usdc).safeApprove(core, received);

@@
-            usdcAmount: params.usdcAmount,
+            usdcAmount: received,
```

## Patch 4 — `Multicall.buy` forwards actual LP payment amount

### File
`/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol`

### Target
`buy(address fundraiser, uint256 epochId, uint256 deadline, uint256 maxPaymentTokenAmount)`

### Proposed changes

- Measure pre/post LP balance in helper.
- Approve exactly observed amount.
- Keep existing refund behavior.

```diff
diff --git a/packages/hardhat/contracts/Multicall.sol b/packages/hardhat/contracts/Multicall.sol
@@
         address lpToken = IAuction(auction).paymentToken();
         uint256 price = IAuction(auction).getPrice();
         address[] memory assets = new address[](1);
         assets[0] = IFundraiser(fundraiser).quote();

-        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), price);
-        IERC20(lpToken).safeApprove(auction, 0);
-        IERC20(lpToken).safeApprove(auction, price);
+        uint256 before = IERC20(lpToken).balanceOf(address(this));
+        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), price);
+        uint256 received = IERC20(lpToken).balanceOf(address(this)) - before;
+        if (received == 0 && price > 0) revert Multicall__ReceivedAmountZero();

+        IERC20(lpToken).safeApprove(auction, 0);
+        IERC20(lpToken).safeApprove(auction, received);
```

## Regression tests (Foundry-style, proposed)

- `test/foundry/poc/FundraiserNonStandardToken.t.sol`
  - `test_multicall_fund_reverts_before_fix`
  - `test_multicall_fund_succeeds_after_fix`
- `test/foundry/poc/CoreLaunchNonStandardUsdc.t.sol`
  - `test_multicall_launch_reverts_before_fix`
  - `test_multicall_launch_succeeds_after_fix`
- `test/foundry/poc/AuctionBuyNonStandardLp.t.sol`
  - `test_multicall_buy_handles_fee_token_lp`

- Invariant suite additions:
  - `test_fuzz_sumDonationsMatchesTotal`
  - `test_fuzz_claimOnlyOncePerEpochAccount`
  - `test_fuzz_splitConservationOverBatchPaths`

## Recommended concrete PoC and invariant files

Add these files under `packages/hardhat/test/foundry/`:

- `test/foundry/poc/NonStandardDonation.t.sol`
  - `testMulticallFundShouldRevertWithFeeOnTransferToken()`
  - `testMulticallFundShouldSucceedAfterHelperReceivesForwardedAmount()` (post-fix)

- `test/foundry/poc/NonStandardLaunch.t.sol`
  - `testMulticallLaunchShouldRevertOnUnderflow()` (current behavior)
  - `testMulticallLaunchShouldLaunchWithExpectedUsdcDelta()` (post-fix)

- `test/foundry/poc/NonStandardAuctionBuy.t.sol`
  - `testMulticallBuyShouldRevertWhenLpTokenSkimmedOnTransfer()` (current behavior)
  - `testMulticallBuyShouldRefundRemainingAfterPriceDecay()` (post-fix)

- `test/foundry/invariants/FundraiserInvariants.t.sol`
  - `invariant_DonationAccountingConserved`
  - `invariant_ClaimOncePerEpochAccount`
  - `invariant_EpochEmissionNeverBelowFloor`
