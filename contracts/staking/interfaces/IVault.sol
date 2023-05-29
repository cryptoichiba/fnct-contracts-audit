// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface IVault {
    struct Lock {
        uint day; // day that lock was created
        address user; // locking user
        uint256 amount; // locked amount of tokens
    }

    struct Unlock {
        uint day; // day that unlock occured
        address user; // unlocking user
        uint256 amount; // unlocked amount of tokens
    }

    /**
     * @notice Return total amount of tokens specified user has locked.
     * @param user Specified user
     * @return Num locked tokens
     */
    function calcLock(address user) external view returns(uint256);

    /**
     * @notice Return total amount of tokens specified user has locked until specific day.
     * @param day Specified day
     * @param user Specified user
     * @return Num currently locked tokens that will still be locked on day
     */
    function calcLockOfDay(uint day, address user) external view returns(uint256);

    /**
     * @notice Return total amount of tokens that specified user can unlock.
     * @param user Specified user
     * @return Num unlockable tokens
     */
    function calcUnlockable(address user) external view returns(uint256);

    /**
     * @notice Return total amount of tokens that all specified users (combined) have locked until specific day.
     * @param day Specified day
     * @param users Array of users
     * @return Total amount of tokens that all specified users (combined) have locked until specific day.
     */
    function calcUsersLock(uint day, address[] calldata users) external view returns(uint256);

    /**
     * @notice Lock user tokens for at least `minimum_holding_period` days
     * @param user Specified user
     * @param amount Amount of tokens to lock
     */
    function addLock(address user, uint256 amount) external;

    /**
     * @notice If possible, will unlock specified amount of tokens from your account.
     * @dev Emits event with your wallet address and chosen validator you unlocked from.
     * @param user Specified user
     * @param amount Amount of tokens to unlock
     */
    function unlock(address user, uint256 amount) external;
}
