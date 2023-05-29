// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../interfaces/ITime.sol";

contract MockTimeContract is ITime {

    uint _currentTimeIndex;

    constructor(uint launchTimestamp_, uint timeUnitInSec) {
        launchTimestamp_;
        timeUnitInSec;
    }

    function setCurrentTimeIndex(uint currentTimeIndex_) public {
        _currentTimeIndex = currentTimeIndex_;
    }

    function getCurrentTimeIndex() override public view returns(uint) {
        return _currentTimeIndex;
    }
    
}
