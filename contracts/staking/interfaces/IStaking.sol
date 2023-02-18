// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../fixed_interfaces/IFixedStaking.sol";

interface IStaking is IFixedStaking {
    struct Selection {
        uint day;
        address validator;
    }

    struct TotalValidationPower {
        uint day;
        uint256 power;
    }

    /**
     * @dev Returns a validator which a `user` delegated to at the `day`.
     * @note `day` is days since launch date.
     */
    function getValidatorOfDay(uint day, address user) external view returns(address);

    /**
     * @dev Returns total delegated tokens to a `validator` at the `day`.
     * @note `day` is days since launch date.
     */
    function getTotalDelegatedTo(uint day, address validator) external view returns(uint256);

    /**
     * @dev Returns all delegators who delegated to a `validator` at the `day`.
     * @note `day` is days since launch date.
     */
    function getDelegators(uint day, address validator) external view returns (address[] memory);

    /**
     * @dev Returns current locked token amount of a `user`.
     */
    function calcLock(address user) external view returns(uint256);

    /**
     * @dev Returns current unlockable token amount of a `user`.
     */
    function calcUnlockable(address user) external view returns(uint256);

    /**
     * @dev Returns current validator which a `user` delegates to.
     */
    function getValidator(address user) external view returns(address);

    /**
     * @dev Returns whether a `user` can change validator now or not.
     */
    function canChangeValidator(address user) external view returns(bool);

    /**
     * @dev Updates internal cache of total delegated amount.
     * @note This function is designed to be idempotent.
     * @note Basically this function should be called by the LogFileHash contract, but whoever can call it.
     */
    function updateTotalDelegated(uint day, address validator) external;

    /**
     * @dev Move `amount` of tokens from the caller to the Vault contract and/or change validator selection.
     * @note Requires `amount` of ERC20-approval from the caller to the Vault contract.
     */
    function lockAndDelegate(uint256 amount, address validator) external;

    /**
     * @dev Move `amount` of tokens from the Vault contract to the caller.
     */
    function unlock(uint256 amount) external;

    /// Events

    /**
     * @dev Emitted when `amount` of tokens locked by the `user` and changed validator selection from `oldValidator` to the `newValidator`.
     */
    event LockedAndDelegated(address indexed user, address indexed newValidator, address indexed oldValidator, uint256 amount);

    /**
     * @dev Emitted when `amount` of tokens unlocked by the `user` with delegated `validator` to at the time.
     */
    event Unlocked(address indexed user, address indexed validator, uint256 amount);
}
