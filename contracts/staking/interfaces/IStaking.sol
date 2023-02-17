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

    event LockedAndDelegated(address indexed user, address indexed newValidator, address indexed oldValidator, uint256 amount);
    event Unlocked(address indexed user, address indexed validator, uint256 amount);

    function getValidatorOfDay(uint day, address user) external view returns(address);
    function getTotalDelegatedTo(uint day, address validator) external view returns(uint256);
    function getDelegators(uint day, address validator) external view returns (address[] memory);
    function calcLock(address user) external view returns(uint256);
    function calcUnlockable(address user) external view returns(uint256);
    function getValidator(address user) external view returns(address);
    function canChangeValidator(address user) external view returns(bool);

    function updateTotalDelegated(uint day, address validator) external;

    function lockAndDelegate(uint256 amount, address validator) external;
    function unlock(uint256 amount) external;
    }
