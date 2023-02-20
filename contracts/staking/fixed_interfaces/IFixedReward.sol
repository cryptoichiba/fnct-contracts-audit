// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @dev Fixed interface of the Reward.
 * @dev DO NOT EDIT THIS INTERFACE
 */
interface IFixedReward {
    function claimStakingReward() external returns(uint256);
}
