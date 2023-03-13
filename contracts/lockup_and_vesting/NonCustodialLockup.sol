// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../staking/fixed_interfaces/IFixedStaking.sol";
import "../staking/fixed_interfaces/IFixedReward.sol";
import "../staking/fixed_interfaces/IFixedGovernance.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract NonCustodialLockup is AccessControl {
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant RECLAIM_ROLE = keccak256("RECLAIM_ROLE");
    bytes32 public constant BENEFICIARY_ROLE = keccak256("BENEFICIARY_ROLE");

    IERC20 _fnct;
    IFixedStaking _stakingContract;
    address _vaultContract;
    IFixedReward _rewardContract;
    IFixedGovernance _governanceContract;
    uint _limitClaim;
    uint _totalClaimed;
    bool _unclaimed = false;

    modifier checkStakingContracts() {
        require(address(_stakingContract) != address(0x0), "NonCustodialLockup: Not setup contract yet");
        require(_vaultContract != address(0x0), "NonCustodialLockup: Not setup contract yet");
        require(address(_rewardContract) != address(0x0), "NonCustodialLockup: Not setup contract yet");
        _;
    }

    modifier checkGovernanceContract() {
        require(address(_governanceContract) != address(0x0), "NonCustodialLockup: Not setup contract yet");
        _;
    }

    constructor(
        address fnct_,
        address beneficiary,
        address reclaimWallet
    ) {
        require(fnct_ != address(0x0), "NonCustodialLockup: FNCT is zero address");
        require(beneficiary != address(0x0), "NonCustodialLockup: Beneficiary is zero address");
        require(reclaimWallet != address(0x0), "NonCustodialLockup: ReclaimWallet is zero address");

        _fnct = IERC20(fnct_);
        _grantRole(TREASURY_ROLE, msg.sender);
        _grantRole(BENEFICIARY_ROLE, beneficiary);
        _grantRole(RECLAIM_ROLE, reclaimWallet);
    }

    function setupStakingContracts(
        address stakingContract_,
        address vaultContract_,
        address rewardContract_
    ) external onlyRole(TREASURY_ROLE) {
        require(stakingContract_ != address(0x0), "NonCustodialLockup: StakingContract is zero address");
        require(vaultContract_ != address(0x0), "NonCustodialLockup: VaultContract is zero address");
        require(rewardContract_ != address(0x0), "NonCustodialLockup: RewardContract is zero address");

        _stakingContract = IFixedStaking(stakingContract_);
        _vaultContract = vaultContract_;
        _rewardContract = IFixedReward(rewardContract_);
    }

    function setupGovernanceContract(
        address governanceContract_
    ) external onlyRole(TREASURY_ROLE) {
        require(governanceContract_ != address(0x0), "NonCustodialLockup: GovernanceContract is zero address");

        _governanceContract = IFixedGovernance(governanceContract_);
    }

    // Vest tokens
    function vestTokens(uint totalAmount) external onlyRole(TREASURY_ROLE) {
        require(_limitClaim <= totalAmount, "NonCustodialLockup: Already vested higher than specified totalAmount");
        _limitClaim = totalAmount;
    }

    // Claim specific amount of vested tokens / transfer to the beneficiary
    function claimTokens(uint amount) external onlyRole(BENEFICIARY_ROLE) checkStakingContracts() {
        require(!_unclaimed, "NonCustodialLockup: Already unclaimed");
        require(_totalClaimed + amount <= _limitClaim, "NonCustodialLockup: Insufficient vested amount");
        require(_stakingContract.calcUnlockable(address(this)) >= amount, "NonCustodialLockup: Requested amount exceeds unlockable");
        require(amount > 0, "NonCustodialLockup: Amount is zero");

        _stakingContract.unlock(amount);
        _totalClaimed += amount;

        SafeERC20.safeTransfer(_fnct, msg.sender, amount);
    }

    // Unclaim all tokens
    function unclaimTokens() external onlyRole(BENEFICIARY_ROLE) {
        require(!_unclaimed, "NonCustodialLockup: Already unclaimed");
        _unclaimed = true;
    }

    // Withdraw all unlockable tokens if unclaimed
    function withdrawUnclaimedTokens() external onlyRole(RECLAIM_ROLE) checkStakingContracts() {
        require(_unclaimed, "NonCustodialLockup: Not unclaimed yet");

        uint unlockable = _stakingContract.calcUnlockable(address(this));
        _stakingContract.unlock(unlockable);

        SafeERC20.safeTransfer(_fnct, msg.sender, unlockable);
    }

    // Lock all tokens / transfer to the vault contract
    function lock(uint amount) external onlyRole(TREASURY_ROLE) checkStakingContracts() {
        require(_fnct.balanceOf(address(this)) <= amount, "NonCustodialLockup: Insufficient balance");
        require(amount > 0, "NonCustodialLockup: Amount is zero");

        SafeERC20.safeApprove(_fnct, _vaultContract, amount);
        _stakingContract.lockAndDelegate(amount, address(0x0));
    }

    // Change delegator for staking
    function proxyDelegate(address validator) external onlyRole(BENEFICIARY_ROLE) checkStakingContracts() {
        require(!_unclaimed, "NonCustodialLockup: Already unclaimed");

        // @notice validator can be address(0x0) to 'unselect' validator
        _stakingContract.lockAndDelegate(0, validator);
    }

    // Claim staking rewards / transfer to the beneficiary
    function proxyClaimStakingReward() external onlyRole(BENEFICIARY_ROLE) checkStakingContracts() {
        uint amount = _rewardContract.claimStakingReward();
        SafeERC20.safeTransfer(_fnct, msg.sender, amount);
    }

    // Submit a vote to governance issue
    function proxyVote(uint256 issue_number, uint[] calldata selection) external onlyRole(BENEFICIARY_ROLE) checkGovernanceContract() {
        // @notice selection can be empty to 'veto' the issue
        _governanceContract.vote(issue_number, selection);
    }

}
