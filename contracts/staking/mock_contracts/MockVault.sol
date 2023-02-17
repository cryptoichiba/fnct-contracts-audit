// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../interfaces/IVault.sol";

contract MockVaultContract is IVault {
    uint launchDate;

    constructor() {
        launchDate = block.timestamp;
    }

    function calcLock(address user) external pure returns(uint) {
        user;
        return 1302 ether;
    }

    function calcLockOfDay(uint day, address user) external pure returns(uint) {
        day; user;
        return 1302 ether;
    }

    function calcUnlockable(address user) override external pure returns (uint) {
        user;
        return 1332 ether;
    }

    function calcUsersLock(uint day, address[] memory users) override public pure returns(uint) {
        day; users;
        return 12442 ether;
    }


    function addLock(address user, uint amount) override external pure {
        user; amount;
    }

    function unlock(address user, uint amount) override external pure {
        user; amount;
    }
}
