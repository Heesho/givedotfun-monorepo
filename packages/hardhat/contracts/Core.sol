// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Fundraiser} from "./Fundraiser.sol";
import {ICoin} from "./interfaces/ICoin.sol";
import {ICoinFactory} from "./interfaces/ICoinFactory.sol";
import {IAuctionFactory} from "./interfaces/IAuctionFactory.sol";
import {IFundraiserFactory} from "./interfaces/IFundraiserFactory.sol";
import {IUniswapV2Factory, IUniswapV2Router} from "./interfaces/IUniswapV2.sol";

/**
 * @title Core
 * @author heesho
 * @notice The launchpad contract for deploying new Fundraiser instances.
 *         Users provide USDC tokens to launch a new donation-based token distribution.
 *         The Core contract:
 *         1. Deploys a new Coin token via CoinFactory
 *         2. Mints initial Coin tokens for liquidity
 *         3. Creates a Coin/USDC liquidity pool on Uniswap V2
 *         4. Burns the initial LP tokens
 *         5. Deploys an Auction contract to collect and auction treasury fees
 *         6. Deploys a Fundraiser contract
 *         7. Transfers Coin minting rights to the Fundraiser (permanently locked)
 *         8. Transfers ownership of the Fundraiser to the launcher
 */
contract Core is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*----------  CONSTANTS  --------------------------------------------*/

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /*----------  IMMUTABLES  -------------------------------------------*/

    address public immutable usdcToken; // token required to launch
    address public immutable uniswapV2Factory; // Uniswap V2 factory
    address public immutable uniswapV2Router; // Uniswap V2 router
    address public immutable coinFactory; // factory for deploying Coin tokens
    address public immutable auctionFactory; // factory for deploying Auctions
    address public immutable fundraiserFactory; // factory for deploying Fundraisers

    /*----------  STATE  ------------------------------------------------*/

    address public protocolFeeAddress; // receives protocol fees
    uint256 public minUsdcForLaunch; // minimum USDC required to launch

    address[] public fundraisers; // enumerable list of deployed fundraisers
    mapping(address => bool) public isFundraiser; // fundraiser => is valid
    mapping(address => uint256) public fundraiserToIndex; // fundraiser => index in fundraisers[]
    mapping(address => address) public fundraiserToAuction; // fundraiser => Auction contract
    mapping(address => address) public fundraiserToLP; // fundraiser => LP token address

    /*----------  STRUCTS  ----------------------------------------------*/

    /**
     * @notice Parameters for launching a new Fundraiser.
     * @dev quoteToken must be a standard ERC20 (no rebasing or fee-on-transfer tokens).
     */
    struct LaunchParams {
        address launcher; // address to receive ownership
        address quoteToken; // ERC20 payment token for donations (e.g., USDC, WETH)
        address recipient; // address to receive 50% of donations (required)
        string tokenName; // Coin token name
        string tokenSymbol; // Coin token symbol
        string uri; // metadata URI for the fundraiser
        uint256 usdcAmount; // USDC to provide for LP
        uint256 coinAmount; // Coin tokens minted for initial LP
        uint256 initialEmission; // starting Coin emission per epoch
        uint256 minEmission; // minimum Coin emission per epoch (floor)
        uint256 halvingPeriod; // number of epochs between emission halvings
        uint256 epochDuration; // epoch duration in seconds (1 hour - 7 days)
        uint256 auctionInitPrice; // auction starting price
        uint256 auctionEpochPeriod; // auction epoch duration
        uint256 auctionPriceMultiplier; // auction price multiplier
        uint256 auctionMinInitPrice; // auction minimum starting price
    }

    /*----------  ERRORS  -----------------------------------------------*/

    error Core__InsufficientUsdc();
    error Core__EmptyTokenName();
    error Core__EmptyTokenSymbol();
    error Core__EmptyUri();
    error Core__ZeroCoinAmount();
    error Core__ZeroAddress();

    /*----------  EVENTS  -----------------------------------------------*/

    event Core__Launched(
        address indexed launcher,
        address indexed fundraiser,
        address indexed coin,
        address recipient,
        address auction,
        address lpToken,
        address quoteToken,
        string tokenName,
        string tokenSymbol,
        string uri,
        uint256 usdcAmount,
        uint256 coinAmount,
        uint256 initialEmission,
        uint256 minEmission,
        uint256 halvingPeriod,
        uint256 epochDuration,
        uint256 auctionInitPrice,
        uint256 auctionEpochPeriod,
        uint256 auctionPriceMultiplier,
        uint256 auctionMinInitPrice
    );
    event Core__ProtocolFeeAddressSet(address protocolFeeAddress);
    event Core__MinUsdcForLaunchSet(uint256 minUsdcForLaunch);

    /*----------  CONSTRUCTOR  ------------------------------------------*/

    /**
     * @notice Deploy the Core launchpad contract.
     * @param _usdcToken USDC token address
     * @param _uniswapV2Factory Uniswap V2 factory address
     * @param _uniswapV2Router Uniswap V2 router address
     * @param _coinFactory CoinFactory contract address
     * @param _auctionFactory AuctionFactory contract address
     * @param _fundraiserFactory FundraiserFactory contract address
     * @param _protocolFeeAddress Address to receive protocol fees
     * @param _minUsdcForLaunch Minimum USDC required to launch
     */
    constructor(
        address _usdcToken,
        address _uniswapV2Factory,
        address _uniswapV2Router,
        address _coinFactory,
        address _auctionFactory,
        address _fundraiserFactory,
        address _protocolFeeAddress,
        uint256 _minUsdcForLaunch
    ) {
        if (
            _usdcToken == address(0) || _uniswapV2Factory == address(0)
                || _uniswapV2Router == address(0) || _coinFactory == address(0)
                || _auctionFactory == address(0) || _fundraiserFactory == address(0)
                || _protocolFeeAddress == address(0)
        ) {
            revert Core__ZeroAddress();
        }

        usdcToken = _usdcToken;
        uniswapV2Factory = _uniswapV2Factory;
        uniswapV2Router = _uniswapV2Router;
        coinFactory = _coinFactory;
        auctionFactory = _auctionFactory;
        fundraiserFactory = _fundraiserFactory;
        protocolFeeAddress = _protocolFeeAddress;
        minUsdcForLaunch = _minUsdcForLaunch;
    }

    /*----------  EXTERNAL FUNCTIONS  -----------------------------------*/

    /**
     * @notice Launch a new Fundraiser with associated Coin token, LP, and Auction.
     * @dev Caller must approve USDC tokens before calling.
     * @param params Launch parameters struct
     * @return coin Address of deployed Coin token
     * @return fundraiser Address of deployed Fundraiser contract
     * @return auction Address of deployed Auction contract
     * @return lpToken Address of Coin/USDC LP token
     */
    function launch(LaunchParams calldata params)
        external
        nonReentrant
        returns (address coin, address fundraiser, address auction, address lpToken)
    {
        // Validate ALL inputs upfront (fail fast before any state changes)
        _validateLaunchParams(params);

        // Transfer USDC from launcher
        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), params.usdcAmount);

        // Deploy Coin token via factory (Core becomes initial minter)
        coin = ICoinFactory(coinFactory).deploy(params.tokenName, params.tokenSymbol);

        // Mint initial Coin tokens for LP seeding
        ICoin(coin).mint(address(this), params.coinAmount);

        // Create Coin/USDC LP via Uniswap V2
        IERC20(coin).safeApprove(uniswapV2Router, 0);
        IERC20(coin).safeApprove(uniswapV2Router, params.coinAmount);
        IERC20(usdcToken).safeApprove(uniswapV2Router, 0);
        IERC20(usdcToken).safeApprove(uniswapV2Router, params.usdcAmount);

        (,, uint256 liquidity) = IUniswapV2Router(uniswapV2Router).addLiquidity(
            coin,
            usdcToken,
            params.coinAmount,
            params.usdcAmount,
            params.coinAmount,
            params.usdcAmount,
            address(this),
            block.timestamp + 20 minutes
        );

        // Get LP token address and burn initial liquidity
        lpToken = IUniswapV2Factory(uniswapV2Factory).getPair(coin, usdcToken);
        IERC20(lpToken).safeTransfer(DEAD_ADDRESS, liquidity);

        // Deploy Auction with LP as payment token (receives treasury fees, burns LP)
        auction = IAuctionFactory(auctionFactory).deploy(
            lpToken,
            DEAD_ADDRESS,
            params.auctionInitPrice,
            params.auctionEpochPeriod,
            params.auctionPriceMultiplier,
            params.auctionMinInitPrice
        );

        // Deploy Fundraiser via factory
        // Recipient receives 50% of donations
        // Treasury is the Auction contract (receives 45% of donations)
        // Team is the launcher (receives 4% of donations)
        Fundraiser.Config memory fundraiserConfig = Fundraiser.Config({
            initialEmission: params.initialEmission,
            minEmission: params.minEmission,
            halvingPeriod: params.halvingPeriod,
            epochDuration: params.epochDuration
        });

        fundraiser = IFundraiserFactory(fundraiserFactory).deploy(
            coin,
            params.quoteToken,
            address(this), // core
            auction, // treasury (45%)
            params.launcher, // team (4%)
            params.recipient, // recipient (50%)
            fundraiserConfig,
            params.uri,
            params.launcher // owner
        );

        // Transfer Coin minting rights to Fundraiser (permanently locked)
        ICoin(coin).setMinter(fundraiser);

        // Update registry
        isFundraiser[fundraiser] = true;
        fundraiserToIndex[fundraiser] = fundraisers.length;
        fundraisers.push(fundraiser);
        fundraiserToLP[fundraiser] = lpToken;
        fundraiserToAuction[fundraiser] = auction;

        emit Core__Launched(
            params.launcher,
            fundraiser,
            coin,
            params.recipient,
            auction,
            lpToken,
            params.quoteToken,
            params.tokenName,
            params.tokenSymbol,
            params.uri,
            params.usdcAmount,
            params.coinAmount,
            params.initialEmission,
            params.minEmission,
            params.halvingPeriod,
            params.epochDuration,
            params.auctionInitPrice,
            params.auctionEpochPeriod,
            params.auctionPriceMultiplier,
            params.auctionMinInitPrice
        );

        return (coin, fundraiser, auction, lpToken);
    }

    /*----------  RESTRICTED FUNCTIONS  ---------------------------------*/

    /**
     * @notice Update the protocol fee recipient address.
     * @dev Can be set to address(0) to disable protocol fees.
     * @param _protocolFeeAddress New protocol fee address
     */
    function setProtocolFeeAddress(address _protocolFeeAddress) external onlyOwner {
        protocolFeeAddress = _protocolFeeAddress;
        emit Core__ProtocolFeeAddressSet(_protocolFeeAddress);
    }

    /**
     * @notice Update the minimum USDC required to launch.
     * @param _minUsdcForLaunch New minimum amount
     */
    function setMinUsdcForLaunch(uint256 _minUsdcForLaunch) external onlyOwner {
        minUsdcForLaunch = _minUsdcForLaunch;
        emit Core__MinUsdcForLaunchSet(_minUsdcForLaunch);
    }

    /*----------  INTERNAL FUNCTIONS  -----------------------------------*/

    /**
     * @notice Validate launch parameters.
     * @dev Fundraiser and Auction parameters are validated by their respective constructors.
     * @param params Launch parameters to validate
     */
    function _validateLaunchParams(LaunchParams calldata params) internal view {
        if (params.launcher == address(0)) revert Core__ZeroAddress();
        if (params.quoteToken == address(0)) revert Core__ZeroAddress();
        // recipient can be address(0) — donations go to treasury instead
        if (params.usdcAmount < minUsdcForLaunch) revert Core__InsufficientUsdc();
        if (bytes(params.tokenName).length == 0) revert Core__EmptyTokenName();
        if (bytes(params.tokenSymbol).length == 0) revert Core__EmptyTokenSymbol();
        if (bytes(params.uri).length == 0) revert Core__EmptyUri();
        if (params.coinAmount == 0) revert Core__ZeroCoinAmount();
    }

    /*----------  VIEW FUNCTIONS  ---------------------------------------*/

    /**
     * @notice Returns the number of deployed fundraisers.
     * @return The length of the fundraisers array
     */
    function fundraisersLength() external view returns (uint256) {
        return fundraisers.length;
    }

}
