// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Coin} from "./Coin.sol";

/**
 * @title CoinFactory
 * @author heesho
 * @notice Factory contract for deploying new Coin token instances.
 * @dev Called by Core during the launch process to create new Coin tokens.
 *      The caller (Core) becomes the initial minter and can mint tokens for LP seeding.
 */
contract CoinFactory {
    /**
     * @notice Deploy a new Coin token with caller as initial minter.
     * @dev The caller (Core) receives minting rights and can later transfer them
     *      to a Fundraiser contract via setMinter(), which permanently locks the minter.
     * @param _tokenName Name for the Coin token
     * @param _tokenSymbol Symbol for the Coin token
     * @return Address of the newly deployed Coin token
     */
    function deploy(string calldata _tokenName, string calldata _tokenSymbol) external returns (address) {
        Coin coin = new Coin(_tokenName, _tokenSymbol, msg.sender);
        return address(coin);
    }
}
