// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./interfaces/ITime.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IStaking.sol";
import "./interfaces/IReward.sol";
import "./utils/UnrenounceableOwnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

 /**
  * @title Vault contract for locking and unlocking tokens.
  * @notice Contains addLock() & unlock() functionality plus associated view functions.
  * @dev This contract is used to lock tokens that are used in Staking contract.
  */
contract VaultContract is IVault, AccessControl, UnrenounceableOwnable {
    ITime private immutable _timeContract;
    IERC20 private immutable _token;

    // Lock and unlock histories
    mapping(address => Lock[]) _lockHistory;
    mapping(address => Unlock[]) _unlockHistory;

    // Minimum holding period until locked tokens can be unlocked
    uint constant minimum_holding_period = 180;

    bytes32 public constant STAKING_ROLE = keccak256("STAKING_ROLE");
    bool _stakingRoleInitialized = false;

    /**
     * @notice Constructor
     * @param timeContract_ Address of Time contract
     * @param token_ Address of token contract
     */
    constructor(address timeContract_, address token_) {
        require(timeContract_ != address(0x0), "Vault: TimeContract is zero address");
        require(token_ != address(0x0), "Vault: Token is zero address");

        _timeContract = ITime(timeContract_);
        _token = IERC20(token_);
    }

    function setupStakingRole(address stakingContract) external onlyOwner {
        require(stakingContract != address(0x0), "Vault: StakingContract is zero address");
        require(!_stakingRoleInitialized, "Vault: StakingContract already initialized");

        _stakingRoleInitialized = true;
        _grantRole(STAKING_ROLE, stakingContract);

    }

    //////////////////////////////////////////////////////////////////////////////
    // Single user's lock/unlock amount
    //////////////////////////////////////////////////////////////////////////////

    /**
     * @notice Return total amount of tokens specified user has locked.
     * @param user Specified user
     * @return Num locked tokens
     */
    function calcLock(address user) override external view returns (uint256) {
        uint today = _timeContract.getCurrentTimeIndex();
        return uint(int(_calcUserLock(today, user)) - int(_calcUserUnLock(today, user)));
    }

    /**
     * @notice Return total amount of tokens that specified user can unlock.
     * @param user Specified user
     * @return Num unlockable tokens
     */
    function calcUnlockable(address user) override external view returns (uint256) {
        uint today = _timeContract.getCurrentTimeIndex();
        return _calcUserUnlockable(today, user);
    }

    /**
     * @notice Return total amount of tokens specified user has locked until specific day.
     * @param day Specified day
     * @param user Specified user
     * @return Num currently locked tokens that will still be locked on day
     */
    function calcLockOfDay(uint day, address user) override external view returns (uint256) {
        return uint(int(_calcUserLock(day, user)) - int(_calcUserUnLock(day, user)));
    }

    function _calcUserLock(uint day, address user) internal view returns (uint256) {
        uint256 output = 0;

        for ( uint i = 0; i < _lockHistory[user].length; i++ ) {
            if ( _lockHistory[user][i].day > day ) {
                break;
            }
            output += _lockHistory[user][i].amount;
        }
        return output;
    }

    function _calcUserUnLock(uint day, address user) internal view returns (uint256) {
        uint256 output = 0;

        for ( uint i = 0; i < _unlockHistory[user].length; i++ ) {
            if ( _unlockHistory[user][i].day > day ) {
                break;
            }
            output += _unlockHistory[user][i].amount;
        }
        return output;
    }

    function _calcUserUnlockable(uint day, address user) internal view returns (uint256) {
        uint256 totalLocked = 0;
        for ( uint i = 0; i < _lockHistory[user].length; i++ ) {
            if ( int(_lockHistory[user][i].day) >= int(day) - int(minimum_holding_period) ) {
                break;
            }

            totalLocked += _lockHistory[user][i].amount;
        }

        uint256 totalUnlocked = _calcUserUnLock(day, user);

        return totalLocked - totalUnlocked;
    }

    //////////////////////////////////////////////////////////////////////////////
    // Multiple users' lock/unlock amount
    //////////////////////////////////////////////////////////////////////////////

    /**
     * @notice Return total amount of tokens that all specified users (combined) have locked until specific day.
     * @param day Specified day
     * @param users Array of users
     * @return Total amount of tokens that all specified users (combined) have locked until specific day.
     */
    function calcUsersLock(uint day, address[] calldata users) override external view returns (uint256) {
        return uint256(int(_calcUsersLock(day, users)) - int(_calcUsersUnLock(day, users)));
    }

    function _calcUsersLock(uint day, address[] calldata users) internal view returns (uint256) {
        uint256 output = 0;

        for ( uint i = 0; i < users.length; i++ ) {
            for ( uint j = 0; j < _lockHistory[users[i]].length; j++ ) {
                if ( _lockHistory[users[i]][j].day > day ) {
                    break;
                }

                output += _lockHistory[users[i]][j].amount;
            }
        }

        return output;
    }

    function _calcUsersUnLock(uint day, address[] calldata users) internal view returns (uint256) {
        uint256 output = 0;

        for ( uint i = 0; i < users.length; i++ ) {
            for ( uint j = 0; j < _unlockHistory[users[i]].length; j++ ) {
                if ( _unlockHistory[users[i]][j].day > day ) {
                    break;
                }

                output += _unlockHistory[users[i]][j].amount;
            }
        }

        return output;
    }

    //////////////////////////////////////////////////////////////////////////////
    // Operation
    //////////////////////////////////////////////////////////////////////////////

    /**
     * @notice Lock user tokens for at least `minimum_holding_period` days
     * @param user Specified user
     * @param amount Amount of tokens to lock
     */
    function addLock(address user, uint256 amount)
        onlyRole(STAKING_ROLE)
        override external {
        require(amount > 0, "Vault: Amount is zero");

        uint today = _timeContract.getCurrentTimeIndex();
        _lockHistory[user].push(Lock(today, user, amount));

        SafeERC20.safeTransferFrom(_token, user, address(this), amount);
    }

    /**
     * @notice If possible, will unlock specified amount of tokens from your account.
     * @dev Emits event with your wallet address and chosen validator you unlocked from.
     * @param user Specified user
     * @param amount Amount of tokens to unlock
     */
    function unlock(address user, uint256 amount)
        onlyRole(STAKING_ROLE)
        override external {
        require(amount > 0, "Vault: Amount is zero");

        uint today = _timeContract.getCurrentTimeIndex();
        uint256 unlockable = _calcUserUnlockable(today, user);
        require(amount <= unlockable, "Vault: Requested amount exceeds unlockable");

        _unlockHistory[user].push(Unlock(today, user, amount));

        SafeERC20.safeTransfer(_token, user, amount);
    }
}
