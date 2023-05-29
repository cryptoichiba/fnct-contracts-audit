// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract NonCustodialVesting is AccessControl {
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant BENEFICIARY_ROLE = keccak256("BENEFICIARY_ROLE");

    IERC20 _fnct;
    uint _limitClaim;
    uint _totalClaimed;

    constructor(
        address fnct_,
        address beneficiary
    ) {
        _fnct = IERC20(fnct_);
        _grantRole(TREASURY_ROLE, msg.sender);
        _grantRole(BENEFICIARY_ROLE, beneficiary);
    }

    // Vest tokens
    function vestTokens(uint totalAmount) external onlyRole(TREASURY_ROLE) {
        require(_limitClaim <= totalAmount, "NonCustodialVesting: Already vested higher than specified totalAmount");
        require(totalAmount > 0, "NonCustodialVesting: TotalAmount is zero");
        _limitClaim = totalAmount;
    }

    // Claim specific amount of vested tokens / transfer to the beneficiary
    function claimTokens(uint amount) external onlyRole(BENEFICIARY_ROLE) {
        require(_totalClaimed + amount <= _limitClaim, "NonCustodialVesting: Insufficient vested amount");
        require(amount > 0, "NonCustodialVesting: Amount is zero");

        _totalClaimed += amount;

        SafeERC20.safeTransfer(_fnct, msg.sender, amount);
    }

}
