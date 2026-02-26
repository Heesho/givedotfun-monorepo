// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IFundraiser} from "./interfaces/IFundraiser.sol";
import {ICore} from "./interfaces/ICore.sol";
import {IAuction} from "./interfaces/IAuction.sol";

/**
 * @title Multicall
 * @author heesho
 * @notice Helper contract for batched operations and aggregated view functions for Fundraiser.
 * @dev Provides donation batching, claim batching, and comprehensive state queries.
 *      Payment token is read from each fundraiser - users must approve this contract for the fundraiser's payment token.
 */
contract Multicall {
    using SafeERC20 for IERC20;

    /*----------  ERRORS  -----------------------------------------------*/

    error Multicall__ZeroAddress();
    error Multicall__InvalidFundraiser();
    error Multicall__EmptyArray();

    /*----------  IMMUTABLES  -------------------------------------------*/

    address public immutable core;
    address public immutable usdc;

    /*----------  STRUCTS  ----------------------------------------------*/

    /**
     * @notice Aggregated state for a Fundraiser.
     */
    struct FundraiserState {
        // Fundraiser state
        uint256 currentEpoch;
        uint256 currentEpochEmission;
        uint256 currentEpochTotalDonated;
        uint256 startTime;
        address recipient;
        address treasury;
        address team;
        // Global fundraiser state
        uint256 coinPrice;
        string fundraiserUri;
        // User balances
        uint256 accountQuoteBalance;
        uint256 accountUsdcBalance;
        uint256 accountCoinBalance;
        uint256 accountCurrentEpochDonation;
    }

    /**
     * @notice Claimable epoch info for a user.
     */
    struct ClaimableEpoch {
        uint256 epoch;
        uint256 donation;
        uint256 pendingReward;
        bool hasClaimed;
    }

    /**
     * @notice Aggregated state for an Auction contract.
     */
    struct AuctionState {
        uint256 epochId;
        uint256 initPrice;
        uint256 startTime;
        address lpToken;
        uint256 price;
        uint256 lpTokenPrice;
        uint256 quoteAccumulated;
        uint256 accountQuoteBalance;
        uint256 accountLpTokenBalance;
    }

    /*----------  CONSTRUCTOR  ------------------------------------------*/

    /**
     * @notice Deploy the Multicall helper contract.
     * @param _core Core contract address
     * @param _usdc USDC token address
     */
    constructor(address _core, address _usdc) {
        if (_core == address(0) || _usdc == address(0)) revert Multicall__ZeroAddress();
        core = _core;
        usdc = _usdc;
    }

    /*----------  EXTERNAL FUNCTIONS  -----------------------------------*/

    /**
     * @notice Fund a fundraiser using the fundraiser's payment token.
     * @dev User must approve the payment token to this contract.
     * @param fundraiser Fundraiser contract address
     * @param account The account to credit for this funding
     * @param amount The amount of payment tokens to fund
     */
    function fund(
        address fundraiser,
        address account,
        uint256 amount,
        string calldata _uri
    ) external {
        if (!ICore(core).isFundraiser(fundraiser)) revert Multicall__InvalidFundraiser();

        address quoteToken = IFundraiser(fundraiser).quote();
        IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(quoteToken).safeApprove(fundraiser, 0);
        IERC20(quoteToken).safeApprove(fundraiser, amount);
        IFundraiser(fundraiser).fund(account, amount, _uri);
    }

    /**
     * @notice Claim rewards for a single epoch.
     * @param fundraiser Fundraiser contract address
     * @param account The account to claim for
     * @param epoch The epoch to claim
     */
    function claim(address fundraiser, address account, uint256 epoch) external {
        if (!ICore(core).isFundraiser(fundraiser)) revert Multicall__InvalidFundraiser();
        IFundraiser(fundraiser).claim(account, epoch);
    }

    /**
     * @notice Claim rewards for multiple epochs in a single transaction.
     * @dev Skips epochs that are already claimed, have no donation, or haven't ended.
     * @param fundraiser Fundraiser contract address
     * @param account The account to claim for
     * @param epochIds Array of epochs to claim
     */
    function claimMultiple(address fundraiser, address account, uint256[] calldata epochIds) external {
        if (!ICore(core).isFundraiser(fundraiser)) revert Multicall__InvalidFundraiser();
        uint256 length = epochIds.length;
        if (length == 0) revert Multicall__EmptyArray();

        uint256 currentEpoch = IFundraiser(fundraiser).currentEpoch();
        for (uint256 i = 0; i < length;) {
            // Skip if already claimed, no donation, or epoch hasn't ended
            if (
                !IFundraiser(fundraiser).epochAccountToHasClaimed(epochIds[i], account) &&
                IFundraiser(fundraiser).epochAccountToDonation(epochIds[i], account) > 0 &&
                epochIds[i] < currentEpoch
            ) {
                IFundraiser(fundraiser).claim(account, epochIds[i]);
            }
            unchecked { ++i; }
        }
    }

    /**
     * @notice Buy from an auction using LP tokens.
     * @dev Transfers LP tokens from caller, approves auction, and executes buy.
     * @param fundraiser Fundraiser contract address (used to look up auction)
     * @param epochId Expected epoch ID
     * @param deadline Transaction deadline
     * @param maxPaymentTokenAmount Maximum LP tokens willing to pay
     */
    function buy(address fundraiser, uint256 epochId, uint256 deadline, uint256 maxPaymentTokenAmount) external {
        if (!ICore(core).isFundraiser(fundraiser)) revert Multicall__InvalidFundraiser();
        address auction = ICore(core).fundraiserToAuction(fundraiser);
        address lpToken = IAuction(auction).paymentToken();
        uint256 price = IAuction(auction).getPrice();
        address[] memory assets = new address[](1);
        assets[0] = IFundraiser(fundraiser).quote();

        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), price);
        IERC20(lpToken).safeApprove(auction, 0);
        IERC20(lpToken).safeApprove(auction, price);
        IAuction(auction).buy(assets, msg.sender, epochId, deadline, maxPaymentTokenAmount);

        // Refund any excess LP tokens (price may have decayed between read and execution)
        uint256 remaining = IERC20(lpToken).balanceOf(address(this));
        if (remaining > 0) {
            IERC20(lpToken).safeTransfer(msg.sender, remaining);
        }
    }

    /**
     * @notice Launch a new fundraiser via Core.
     * @dev Transfers USDC from caller, approves Core, and calls launch with caller as launcher.
     * @param params Launch parameters (launcher field is overwritten with msg.sender)
     * @return coin Address of deployed Coin token
     * @return fundraiser Address of deployed Fundraiser contract
     * @return auction Address of deployed Auction contract
     * @return lpToken Address of Coin/USDC LP token
     */
    function launch(ICore.LaunchParams calldata params)
        external
        returns (address coin, address fundraiser, address auction, address lpToken)
    {
        // Transfer USDC from user
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), params.usdcAmount);
        IERC20(usdc).safeApprove(core, 0);
        IERC20(usdc).safeApprove(core, params.usdcAmount);

        // Build params with msg.sender as launcher
        ICore.LaunchParams memory launchParams = ICore.LaunchParams({
            launcher: msg.sender,
            quoteToken: params.quoteToken,
            recipient: params.recipient,
            tokenName: params.tokenName,
            tokenSymbol: params.tokenSymbol,
            uri: params.uri,
            usdcAmount: params.usdcAmount,
            coinAmount: params.coinAmount,
            initialEmission: params.initialEmission,
            minEmission: params.minEmission,
            halvingPeriod: params.halvingPeriod,
            epochDuration: params.epochDuration,
            auctionInitPrice: params.auctionInitPrice,
            auctionEpochPeriod: params.auctionEpochPeriod,
            auctionPriceMultiplier: params.auctionPriceMultiplier,
            auctionMinInitPrice: params.auctionMinInitPrice
        });

        return ICore(core).launch(launchParams);
    }

    /*----------  VIEW FUNCTIONS  ---------------------------------------*/

    /**
     * @notice Get aggregated state for a Fundraiser and user balances.
     * @param fundraiser Fundraiser contract address
     * @param account User address (or address(0) to skip balance queries)
     * @return state Aggregated fundraiser state
     */
    function getFundraiser(address fundraiser, address account) external view returns (FundraiserState memory state) {
        uint256 epoch = IFundraiser(fundraiser).currentEpoch();

        state.currentEpoch = epoch;
        state.currentEpochEmission = IFundraiser(fundraiser).getEpochEmission(epoch);
        state.currentEpochTotalDonated = IFundraiser(fundraiser).epochToTotalDonated(epoch);
        state.startTime = IFundraiser(fundraiser).startTime();
        state.recipient = IFundraiser(fundraiser).recipient();
        state.treasury = IFundraiser(fundraiser).treasury();
        state.team = IFundraiser(fundraiser).team();

        address coinToken = IFundraiser(fundraiser).coin();

        // Calculate Coin price in USDC from LP reserves
        // USDC has 6 decimals, Coin has 18. Multiply by 1e30 (= 1e12 normalization * 1e18 precision)
        address lpToken = ICore(core).fundraiserToLP(fundraiser);
        if (lpToken != address(0)) {
            uint256 usdcInLP = IERC20(usdc).balanceOf(lpToken);
            uint256 coinInLP = IERC20(coinToken).balanceOf(lpToken);
            state.coinPrice = coinInLP == 0 ? 0 : usdcInLP * 1e30 / coinInLP;
        }

        // Fundraiser metadata
        state.fundraiserUri = IFundraiser(fundraiser).uri();

        // User balances
        address quoteToken = IFundraiser(fundraiser).quote();
        state.accountQuoteBalance = account == address(0) ? 0 : IERC20(quoteToken).balanceOf(account);
        state.accountUsdcBalance = account == address(0) ? 0 : IERC20(usdc).balanceOf(account);
        state.accountCoinBalance = account == address(0) ? 0 : IERC20(coinToken).balanceOf(account);
        state.accountCurrentEpochDonation = account == address(0) ? 0 : IFundraiser(fundraiser).epochAccountToDonation(epoch, account);

        return state;
    }

    /**
     * @notice Get claimable epochs for a user within a range.
     * @param fundraiser Fundraiser contract address
     * @param account User address
     * @param startEpoch First epoch to check (inclusive)
     * @param endEpoch Last epoch to check (exclusive)
     * @return claimableEpochs Array of claimable epoch info
     */
    function getClaimableEpochs(
        address fundraiser,
        address account,
        uint256 startEpoch,
        uint256 endEpoch
    ) external view returns (ClaimableEpoch[] memory claimableEpochs) {
        if (endEpoch <= startEpoch) {
            return new ClaimableEpoch[](0);
        }

        uint256 count = endEpoch - startEpoch;
        claimableEpochs = new ClaimableEpoch[](count);

        for (uint256 i = 0; i < count;) {
            uint256 epoch = startEpoch + i;
            claimableEpochs[i] = ClaimableEpoch({
                epoch: epoch,
                donation: IFundraiser(fundraiser).epochAccountToDonation(epoch, account),
                pendingReward: IFundraiser(fundraiser).getPendingReward(epoch, account),
                hasClaimed: IFundraiser(fundraiser).epochAccountToHasClaimed(epoch, account)
            });
            unchecked { ++i; }
        }

        return claimableEpochs;
    }

    /**
     * @notice Get total pending rewards across a range of epochs.
     * @param fundraiser Fundraiser contract address
     * @param account User address
     * @param startEpoch First epoch to check (inclusive)
     * @param endEpoch Last epoch to check (exclusive)
     * @return totalPending Total unclaimed Coin tokens across all checked epochs
     * @return unclaimedEpochs Array of epoch numbers that have unclaimed rewards
     */
    function getTotalPendingRewards(
        address fundraiser,
        address account,
        uint256 startEpoch,
        uint256 endEpoch
    ) external view returns (uint256 totalPending, uint256[] memory unclaimedEpochs) {
        if (endEpoch <= startEpoch) {
            return (0, new uint256[](0));
        }

        // Single pass: collect unclaimed epochs into oversized array
        uint256[] memory temp = new uint256[](endEpoch - startEpoch);
        uint256 count = 0;
        for (uint256 epoch = startEpoch; epoch < endEpoch;) {
            uint256 pending = IFundraiser(fundraiser).getPendingReward(epoch, account);
            if (pending > 0) {
                totalPending += pending;
                temp[count] = epoch;
                unchecked { ++count; }
            }
            unchecked { ++epoch; }
        }

        // Copy to correctly-sized array
        unclaimedEpochs = new uint256[](count);
        for (uint256 i = 0; i < count;) {
            unclaimedEpochs[i] = temp[i];
            unchecked { ++i; }
        }

        return (totalPending, unclaimedEpochs);
    }

    /**
     * @notice Get emission schedule for upcoming epochs.
     * @param fundraiser Fundraiser contract address
     * @param numEpochs Number of epochs to project
     * @return emissions Array of epoch emissions starting from current epoch
     */
    function getEmissionSchedule(address fundraiser, uint256 numEpochs)
        external
        view
        returns (uint256[] memory emissions)
    {
        uint256 currentEpoch = IFundraiser(fundraiser).currentEpoch();
        emissions = new uint256[](numEpochs);

        for (uint256 i = 0; i < numEpochs;) {
            emissions[i] = IFundraiser(fundraiser).getEpochEmission(currentEpoch + i);
            unchecked { ++i; }
        }

        return emissions;
    }

    /**
     * @notice Get the recipient address for a Fundraiser.
     * @param fundraiser Fundraiser contract address
     * @return recipient The recipient address that receives 50% of donations
     */
    function getRecipient(address fundraiser) external view returns (address) {
        return IFundraiser(fundraiser).recipient();
    }

    /**
     * @notice Get aggregated state for an Auction and user balances.
     * @param fundraiser Fundraiser contract address (used to look up auction)
     * @param account User address (or address(0) to skip balance queries)
     * @return state Aggregated auction state
     */
    function getAuction(address fundraiser, address account) external view returns (AuctionState memory state) {
        address auction = ICore(core).fundraiserToAuction(fundraiser);

        state.epochId = IAuction(auction).epochId();
        state.initPrice = IAuction(auction).initPrice();
        state.startTime = IAuction(auction).startTime();
        state.lpToken = IAuction(auction).paymentToken();
        state.price = IAuction(auction).getPrice();

        // LP price in USDC = (USDC in LP * 2) / LP total supply
        // USDC has 6 decimals, LP has 18. Multiply by 2e30 (= 2 * 1e12 normalization * 1e18 precision)
        uint256 lpTotalSupply = IERC20(state.lpToken).totalSupply();
        state.lpTokenPrice =
            lpTotalSupply == 0 ? 0 : IERC20(usdc).balanceOf(state.lpToken) * 2e30 / lpTotalSupply;

        address quoteToken = IFundraiser(fundraiser).quote();
        state.quoteAccumulated = IERC20(quoteToken).balanceOf(auction);
        state.accountQuoteBalance = account == address(0) ? 0 : IERC20(quoteToken).balanceOf(account);
        state.accountLpTokenBalance = account == address(0) ? 0 : IERC20(state.lpToken).balanceOf(account);

        return state;
    }
}
