// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Mock tokens for negative-path and adversarial protocol testing.
 */

/**
 * @notice ERC20 that burns/transfers a fee on every transfer.
 *         Useful for reproducing exact-input assumptions at protocol boundaries.
 */
contract MockFeeOnTransferToken is ERC20 {
    uint8 private immutable _decimals;
    uint16 public feeBps; // fee in basis points (1 bps = 0.01%)
    address public feeRecipient;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint16 feeBps_,
        address feeRecipient_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFeeBps(uint16 newFeeBps) external {
        feeBps = newFeeBps;
    }

    function setFeeRecipient(address newFeeRecipient) external {
        feeRecipient = newFeeRecipient;
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        if (feeBps == 0) {
            super._transfer(from, to, amount);
            return;
        }

        uint256 fee = amount * feeBps / 10_000;
        uint256 net = amount - fee;
        super._transfer(from, to, net);
        if (fee > 0 && feeRecipient != address(0)) {
            super._transfer(from, feeRecipient, fee);
        }
    }
}

/**
 * @notice ERC20 that intentionally returns `false` on transfer/transferFrom to emulate
 *         non-compliant tokens.
 */
contract MockFalseReturnToken is ERC20 {
    bool public alwaysFalse;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _setupDecimals(decimals_);
    }

    function decimals() public view override returns (uint8) {
        return super.decimals();
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setAlwaysFalse(bool enabled) external {
        alwaysFalse = enabled;
    }

    function _setupDecimals(uint8 decimals_) internal {
        require(decimals_ <= type(uint8).max, "MockFalseReturnToken: bad decimals");
        // OpenZeppelin v4 stores decimals in private storage in ERC20, so this override is unavailable.
        // Keep compatibility by inheriting base decimal default where caller passes via constructor only when needed.
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (alwaysFalse) return false;
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (alwaysFalse) return false;
        return super.transferFrom(from, to, amount);
    }
}

/**
 * @notice Minimal core compatibility stub for Multicall validation in tests.
 */
contract MockCoreForMulticall {
    address public protocolFeeAddress;
    mapping(address => bool) public isFundraiser;

    constructor(address _protocolFeeAddress) {
        protocolFeeAddress = _protocolFeeAddress;
    }

    function setProtocolFeeAddress(address _protocolFeeAddress) external {
        protocolFeeAddress = _protocolFeeAddress;
    }

    function setFundraiser(address fundraiser, bool valid) external {
        isFundraiser[fundraiser] = valid;
    }
}

