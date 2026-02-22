// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/**
 * @title ICore
 * @author heesho
 * @notice Interface for the Core launchpad contract.
 */
interface ICore {
    struct LaunchParams {
        address launcher;
        address quoteToken;
        address recipient;
        string tokenName;
        string tokenSymbol;
        string uri;
        uint256 usdcAmount;
        uint256 coinAmount;
        uint256 initialEmission;
        uint256 minEmission;
        uint256 halvingPeriod;
        uint256 epochDuration;
        uint256 auctionInitPrice;
        uint256 auctionEpochPeriod;
        uint256 auctionPriceMultiplier;
        uint256 auctionMinInitPrice;
    }

    // Constants
    function DEAD_ADDRESS() external view returns (address);

    // Immutables
    function usdcToken() external view returns (address);
    function uniswapV2Factory() external view returns (address);
    function uniswapV2Router() external view returns (address);
    function coinFactory() external view returns (address);
    function auctionFactory() external view returns (address);
    function fundraiserFactory() external view returns (address);

    // State
    function protocolFeeAddress() external view returns (address);
    function minUsdcForLaunch() external view returns (uint256);
    function isFundraiser(address fundraiser) external view returns (bool);
    function fundraiserToAuction(address fundraiser) external view returns (address);
    function fundraisers(uint256 index) external view returns (address);
    function fundraisersLength() external view returns (uint256);
    function fundraiserToIndex(address fundraiser) external view returns (uint256);
    function fundraiserToLP(address fundraiser) external view returns (address);

    // External functions
    function launch(LaunchParams calldata params)
        external
        returns (address coin, address fundraiser, address auction, address lpToken);

    // Restricted functions
    function setProtocolFeeAddress(address _protocolFeeAddress) external;
    function setMinUsdcForLaunch(uint256 _minUsdcForLaunch) external;
}
