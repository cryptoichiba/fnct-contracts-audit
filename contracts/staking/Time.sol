/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./interfaces/ITime.sol";

contract TimeContract is ITime {
    uint private immutable _launchTimestamp;
    uint private immutable _timeUnit;
    
    constructor(uint launchTimestamp_, uint timeUnitInSec) {
        if ( block.timestamp > launchTimestamp_ ) {
            require((block.timestamp - launchTimestamp_) / timeUnitInSec < 7);
        } else {
            require((launchTimestamp_ - block.timestamp) / timeUnitInSec < 7);
        }

        _launchTimestamp = launchTimestamp_;
        _timeUnit = timeUnitInSec;
    }

    // Launch Date = 0 Day
    function getCurrentTimeIndex() override external view returns(uint) {
        return (block.timestamp - _launchTimestamp) / _timeUnit;
    }
}
