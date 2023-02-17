/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./interfaces/ITime.sol";

contract TimeContract is ITime {
    // "Day 0" base timestamp (Like the "epoch time" in Unix)
    uint private immutable _launchTimestamp;
    // Number of seconds in each day
    uint private immutable _timeUnit;

    /// @notice Constructor
    /// @param launchTimestamp_ "Day 0" base timestamp
    /// @param timeUnitInSec Number of seconds in each day
    /// @dev By adjusting these two values, developers can create debug environments where time proceeds faster.
    constructor(uint launchTimestamp_, uint timeUnitInSec) {
        if ( block.timestamp > launchTimestamp_ ) {
            require((block.timestamp - launchTimestamp_) / timeUnitInSec < 7);
        } else {
            require((launchTimestamp_ - block.timestamp) / timeUnitInSec < 7);
        }

        _launchTimestamp = launchTimestamp_;
        _timeUnit = timeUnitInSec;
    }

    /// @notice Returns current "day"
    /// @dev Launch Date = 0 Day
    /// @return randNumber Current day index
    function getCurrentTimeIndex() override external view returns(uint) {
        return (block.timestamp - _launchTimestamp) / _timeUnit;
    }
}
