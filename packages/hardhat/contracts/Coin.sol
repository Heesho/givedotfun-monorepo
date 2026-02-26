// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

/**
 * @title Coin
 * @author heesho
 * @notice ERC20 token with permit and voting capabilities, minted by a minter contract.
 * @dev Only the minter address can mint new tokens. Includes governance voting functionality.
 *      The minter address can be transferred once by calling setMinter(). Once transferred to a
 *      Fundraiser contract (which has no setMinter function), the minter address becomes effectively immutable.
 *      There is no max supply cap — emissions continue perpetually at the minEmission floor rate.
 */
contract Coin is ERC20, ERC20Permit, ERC20Votes {
    address public minter;
    bool public minterLocked;

    error Coin__NotMinter();
    error Coin__ZeroAddress();
    error Coin__MinterLocked();

    event Coin__Minted(address account, uint256 amount);
    event Coin__Burned(address account, uint256 amount);
    event Coin__MinterSet(address indexed minter);

    /**
     * @notice Deploy a new Coin token.
     * @dev The initial minter can mint tokens and transfer minting rights once via setMinter().
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _initialMinter Address that will have initial minting rights
     */
    constructor(string memory _name, string memory _symbol, address _initialMinter) ERC20(_name, _symbol) ERC20Permit(_name) {
        if (_initialMinter == address(0)) revert Coin__ZeroAddress();
        minter = _initialMinter;
    }

    /**
     * @notice Transfer minting rights to a new minter address (one-time only).
     * @dev Only callable by the current minter. Once called, the minter is permanently locked.
     * @param _minter New minter address
     */
    function setMinter(address _minter) external {
        if (msg.sender != minter) revert Coin__NotMinter();
        if (minterLocked) revert Coin__MinterLocked();
        if (_minter == address(0)) revert Coin__ZeroAddress();
        minter = _minter;
        minterLocked = true;
        emit Coin__MinterSet(_minter);
    }

    /**
     * @notice Mint new tokens to an account.
     * @dev Only callable by the minter address.
     * @param account Recipient address
     * @param amount Amount to mint
     */
    function mint(address account, uint256 amount) external {
        if (msg.sender != minter) revert Coin__NotMinter();
        _mint(account, amount);
        emit Coin__Minted(account, amount);
    }

    /**
     * @notice Burn tokens from the caller's balance.
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit Coin__Burned(msg.sender, amount);
    }

    // Required overrides for ERC20Votes compatibility
    function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }
}
