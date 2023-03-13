// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";

contract UnrenounceableOwnable is Ownable {

    function renounceOwnership() override public view onlyOwner {
        revert("UnrenounceableOwnable: Can't renounce ownership");
    }

}