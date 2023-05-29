// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
 * @dev Fixed interface of the Staking.
 * @dev DO NOT EDIT THIS INTERFACE
 */
interface IFixedStaking {
    function calcUnlockable(address user) external view returns(uint256);
    function lockAndDelegate(uint256 amount, address validator) external;
    function unlock(uint256 amount) external;
}
