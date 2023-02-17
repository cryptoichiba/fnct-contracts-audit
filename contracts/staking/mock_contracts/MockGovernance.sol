// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../fixed_interfaces/IFixedGovernance.sol";
import "hardhat/console.sol";

contract MockGovernance is IFixedGovernance {

    function vote(uint256 issue_number, uint[] calldata selection) external view {
        console.log("-- Voted --");
        console.log(msg.sender);
        console.log(issue_number);
        console.log("Selection: ");
        for ( uint i = 0; i < selection.length; i++ ) {
            console.log(selection[i]);
        }
        console.log("-- Voted --");
    }
    
}
