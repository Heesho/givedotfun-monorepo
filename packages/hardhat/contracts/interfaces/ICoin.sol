// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/**
 * @title ICoin
 * @author heesho
 * @notice Interface for the Coin token contract.
 */
interface ICoin {
    function minter() external view returns (address);
    function minterLocked() external view returns (bool);
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function setMinter(address _minter) external;
}
