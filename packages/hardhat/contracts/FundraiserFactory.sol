// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Fundraiser} from "./Fundraiser.sol";

/**
 * @title FundraiserFactory
 * @author heesho
 * @notice Factory contract for deploying new Fundraiser instances.
 * @dev Called by Core during the launch process to create new Fundraiser contracts.
 *      The caller (Core) becomes the initial owner and can later transfer ownership
 *      to the launcher.
 */
contract FundraiserFactory {
    /**
     * @notice Deploy a new Fundraiser contract.
     * @param _coin Coin token address
     * @param _quote Payment token address (e.g., USDC)
     * @param _core Core contract address
     * @param _treasury Treasury address for fee collection
     * @param _team Team address for fee collection
     * @param _recipient Address to receive 50% of donations
     * @param _config Configuration struct with emission parameters
     * @param _uri Metadata URI for the fundraiser
     * @return Address of the newly deployed Fundraiser
     */
    function deploy(
        address _coin,
        address _quote,
        address _core,
        address _treasury,
        address _team,
        address _recipient,
        Fundraiser.Config memory _config,
        string memory _uri
    ) external returns (address) {
        Fundraiser fundraiser = new Fundraiser(_coin, _quote, _core, _treasury, _team, _recipient, _config, _uri);
        fundraiser.transferOwnership(msg.sender);
        return address(fundraiser);
    }
}
