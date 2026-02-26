// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Fundraiser} from "../Fundraiser.sol";

/**
 * @title IFundraiserFactory
 * @author heesho
 * @notice Interface for the FundraiserFactory contract.
 */
interface IFundraiserFactory {
    function deploy(
        address _coin,
        address _quote,
        address _core,
        address _treasury,
        address _team,
        address _recipient,
        Fundraiser.Config memory _config,
        string memory _uri,
        address _owner
    ) external returns (address);
}
