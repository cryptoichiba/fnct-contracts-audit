// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IVault {
    struct Lock {
        uint day;
        address user;
        uint256 amount;
    }

    struct Unlock {
        uint day;
        address user;
        uint256 amount;
    }

    function calcLock(address user) external view returns(uint256);
    function calcLockOfDay(uint day, address user) external view returns(uint256);
    function calcUnlockable(address user) external view returns(uint256);
    function calcUsersLock(uint day, address[] calldata users) external view returns(uint256);

    function addLock(address user, uint256 amount) external;
    function unlock(address user, uint256 amount) external;
}
