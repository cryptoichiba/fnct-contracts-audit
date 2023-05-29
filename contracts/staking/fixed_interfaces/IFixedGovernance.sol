// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
 * @dev Fixed interface of the Governance.
 * @dev DO NOT EDIT THIS INTERFACE
 */
interface IFixedGovernance {
    function vote(uint256 issue_number, uint[] calldata selection) external;
}
