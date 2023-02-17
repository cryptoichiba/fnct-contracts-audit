// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../interfaces/IStaking.sol";

contract MockStakingContract is IStaking {
    uint launchDate;
    address validatorAddress;

    constructor() {
        launchDate = block.timestamp;
        validatorAddress = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    }

    // view functions
    function getValidatorOfDay(uint day, address user) override external view returns(address) {
        day; user;
        return validatorAddress;
    }

    function getDelegators(uint day, address validator) public view returns (address[] memory) {
        day; validator;

        address[] memory output = new address[](1);
        output[0] = validatorAddress;

        return output;
    }

    function getTotalDelegatedTo(uint day, address validator) override external pure returns(uint) {
        day; validator;

        return 0;
    }

    function updateTotalDelegated(uint day, address validator) override external pure {
        day; validator;
    }

    function calcLock(address user) override public pure returns (uint) {
        user;
        return 3521 ether;
    }

    function calcUnlockable(address user) override public pure returns (uint) {
        user;
        return 3521 ether;
    }

    function getValidator(address user) override external view returns (address) {
        user;
        return validatorAddress;
    }

    function canChangeValidator(address user) override external pure returns (bool) {
        user;
        return true;
    }

    function lockAndDelegate(uint amount, address validator) override external {
        emit LockedAndDelegated(msg.sender, validator, validator, amount);
    }

    function unlock(uint amount) override public {
        emit Unlocked(msg.sender, 0x70997970C51812dc3A010C7d01b50e0d17dc79C8, amount);
    }
}
